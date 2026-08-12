import { type Context, Hono, type Next } from "hono";
import { cors } from "hono/cors";
import type { LogFilter } from "../db/repository";
import * as 库 from "../db/repository";
import { runEvaluation } from "../llm/evaluation";
import { budgetState, circuitBreakerState, samplingState } from "../llm/fault-tolerance";
import { clearHistoryLogs, createSSEStream, getHistoryLogs } from "../logger";
import {
    abortAnalysis,
    analyzePendingComments,
    collectAll,
    collectComments,
    collectDynamics,
    collectVideos,
    reanalyzeAllComments,
} from "../scheduler";
import { aiProvidersRouter } from "./modules/ai-providers";
import { biliRouter } from "./modules/bili";

const app = new Hono();

// ===== CORS 白名单 =====
// 前端 dev（Vite 5173）与生产均通过同源代理（/api）访问后端，正常流程不需要 CORS；
// 仅当需要跨端口直连（如绕过代理直连 SSE）时才生效。
// 不在白名单的跨域来源不返回 Access-Control-Allow-Origin 头，浏览器会拦截。
// 生产环境如有独立前端域名，用环境变量「ALLOWED_ORIGINS」以逗号分隔配置。
const allowedOrigins = (
    process.env["ALLOWED_ORIGINS"] ??
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5160,http://127.0.0.1:5160"
)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    "*",
    cors({
        origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
        credentials: true,
    }),
);

// ===== 访问令牌认证 =====
// 在「系统配置」中设置"访问令牌"后启用；未配置则放行（兼容首次部署/本地开发）
// 三种携带方式：Authorization: Bearer <token>、x-access-token 头、SSE 的 ?token= 查询参数
async function accessTokenMiddleware(c: Context, next: Next): Promise<Response | void> {
    const accessToken = await 库.getConfigValue("访问令牌");
    if (!accessToken) return next();
    // 豁免：读取系统配置（已脱敏，仅返回非敏感项 + "已配置"标记）无需令牌。
    // 否则客户端一旦丢失令牌，连设置页都打不开，无法重新配置 —— 形成死锁。
    // 保存配置（PUT）同样豁免，路由内做精细校验：遗忘令牌时允许"留空清除认证"逃生。
    if ((c.req.method === "GET" || c.req.method === "PUT") && c.req.path === "/api/config")
        return next();
    const header = c.req.header("Authorization") ?? c.req.header("x-access-token") ?? "";
    const sentToken =
        (header.startsWith("Bearer ") ? header.slice(7) : header) || c.req.query("token") || "";
    if (sentToken && sentToken === accessToken) return next();
    return c.json({ error: "未授权：访问令牌缺失或无效，请在「系统配置」中核对" }, 401);
}
app.use("*", accessTokenMiddleware);

// ===== 任务管理 =====
app.get("/api/tasks", async (c) => c.json(await 库.listTasks()));

app.post("/api/tasks", async (c) => {
    const body = await c.req.json<{ type: string; target: string }>();
    try {
        const row = await 库.createTask(body.type, body.target);
        return c.json(row, 201);
    } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
});

app.patch("/api/tasks/:id", async (c) => {
    const body = await c.req.json<{ enabled: boolean }>();
    await 库.updateTask(Number(c.req.param("id")), body.enabled);
    return c.json({ ok: true });
});

app.delete("/api/tasks/:id", async (c) => {
    await 库.deleteTask(Number(c.req.param("id")));
    return c.json({ ok: true });
});

// ===== 内容查询 =====
app.get("/api/videos", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const size = Number(c.req.query("size") ?? 20);
    const [list, total] = await Promise.all([库.queryVideos(page, size), 库.countVideos()]);
    return c.json({ list, total });
});

app.get("/api/comments", async (c) => {
    const videoId = c.req.query("videoId") ? Number(c.req.query("videoId")) : undefined;
    const sentiment = c.req.query("sentiment") ?? undefined;
    const keyword = c.req.query("keyword") ?? undefined;
    const deleted =
        c.req.query("deleted") === "true"
            ? true
            : c.req.query("deleted") === "false"
              ? false
              : undefined;
    const page = Number(c.req.query("page") ?? 1);
    const size = Number(c.req.query("size") ?? 20);
    const [list, total] = await Promise.all([
        库.queryComments({ videoId, sentiment, keyword, deleted, page, size }),
        库.countComments({ videoId, sentiment, keyword, deleted }),
    ]);
    return c.json({ list, total });
});

// 危险操作需显式确认：清空全量数据不可恢复，必须携带 ?confirm=1（防误触/恶意调用）
app.delete("/api/comments", async (c) => {
    if (c.req.query("confirm") !== "1") {
        return c.json(
            { error: "危险操作：清空全部评论及情感分析不可恢复，请携带 confirm=1 确认" },
            400,
        );
    }
    const result = await 库.clearComments();
    return c.json({
        message: `已清空 ${result.comments} 条评论及 ${result.sentimentAnalysis} 条情感分析记录`,
        ...result,
    });
});

app.get("/api/dynamics", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const size = Number(c.req.query("size") ?? 20);
    const [list, total] = await Promise.all([库.queryDynamics(page, size), 库.countDynamics()]);
    return c.json({ list, total });
});

app.get("/api/logs", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const size = Number(c.req.query("size") ?? 20);
    const stage = c.req.query("stage");
    const status = c.req.query("status");
    const filter: LogFilter | undefined = stage || status ? { stage, status } : undefined;
    const [list, total] = await Promise.all([
        库.queryLogs(page, size, filter),
        库.countLogs(filter),
    ]);
    return c.json({ list, total });
});

app.get("/api/logs/stats", async (c) => c.json(await 库.logStats()));

app.delete("/api/logs", async (c) => {
    if (c.req.query("confirm") !== "1") {
        return c.json({ error: "危险操作：清空全部采集日志不可恢复，请携带 confirm=1 确认" }, 400);
    }
    const count = await 库.clearLogs();
    return c.json({ message: `已清空 ${count} 条日志`, clearedCount: count });
});

// ===== 统计 =====
app.get("/api/stats/overview", async (c) => c.json(await 库.overviewStats()));
app.get("/api/stats/sentiment-dist", async (c) => c.json(await 库.sentimentDistribution()));
app.get("/api/stats/trend", async (c) =>
    c.json(await 库.sentimentTrend(Number(c.req.query("days") ?? 7))),
);
// 舆论分析：热门话题（话题×情感交叉）与舆情预警
app.get("/api/stats/topics", async (c) =>
    c.json(await 库.topicStats(Number(c.req.query("limit") ?? 20))),
);
app.get("/api/stats/risk-alerts", async (c) =>
    c.json(await 库.riskAlerts(Number(c.req.query("limit") ?? 10))),
);
// 加权情感指数：点赞×讨论热度加权（区别于简单计数）
app.get("/api/stats/weighted-sentiment", async (c) => c.json(await 库.weightedSentimentIndex()));

// ===== 系统配置 =====

/** 敏感键集合：这些键的值不返回明文，仅返回是否已配置 */
const sensitiveConfigKeys = new Set(["DeepSeek密钥", "Gemini密钥", "访问令牌"]);

app.get("/api/config", async (c) => {
    const all = await 库.getAllConfig();
    // 脱敏：密钥类字段仅返回"已配置"标记，前端无需明文
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(all)) {
        if (sensitiveConfigKeys.has(key)) {
            masked[key] = value ? "已配置" : "";
        } else {
            masked[key] = value;
        }
    }
    return c.json(masked);
});

app.put("/api/config", async (c) => {
    const body = await c.req.json<Record<string, string>>();
    // 精细认证（中间件已豁免本路由）：读取已配置令牌并校验请求携带值
    const configuredToken = await 库.getConfigValue("访问令牌");
    const header = c.req.header("Authorization") ?? c.req.header("x-access-token") ?? "";
    const sentToken =
        (header.startsWith("Bearer ") ? header.slice(7) : header) || c.req.query("token") || "";
    const isVerified = !configuredToken || (sentToken && sentToken === configuredToken);
    if (!isVerified) {
        // 未携带有效令牌：仅允许"清除访问令牌"这一逃生操作（防遗忘令牌后死锁）。
        // 此时只写入令牌字段，忽略其余配置，避免绕过认证篡改其它配置。
        if (body["访问令牌"] !== "") {
            return c.json(
                {
                    error: "未授权：访问令牌缺失或无效。若遗忘令牌，可将「访问令牌」留空保存以停用认证，再重新设置新令牌",
                },
                401,
            );
        }
        await 库.setConfigValue("访问令牌", "");
        return c.json({ ok: true, message: "访问令牌已清除，接口认证已停用（可重新设置新令牌）" });
    }
    // 敏感键传空串时跳过不覆盖（"留空保留原值"语义，避免把令牌覆盖成空/占位符）
    await 库.setConfigValues(body, [...sensitiveConfigKeys]);
    return c.json({ ok: true, message: "配置已保存" });
});

// ===== 手动采集（细分，不含分析）=====
const trigger = (fn: () => Promise<unknown>, name: string) => {
    fn().catch((e) => console.error(`[API] ${name}失败：`, e));
};

app.post("/api/collect/videos", (c) => {
    trigger(collectVideos, "采集视频");
    return c.json({ message: "已触发采集视频，详见服务端日志" });
});
app.post("/api/collect/comments", (c) => {
    trigger(collectComments, "采集评论");
    return c.json({ message: "已触发采集评论，详见服务端日志" });
});
app.post("/api/collect/dynamics", (c) => {
    trigger(collectDynamics, "采集动态");
    return c.json({ message: "已触发采集动态，详见服务端日志" });
});
app.post("/api/collect/all", (c) => {
    trigger(collectAll, "采集全部");
    return c.json({ message: "已触发采集全部（不含分析），详见服务端日志" });
});
// 兼容旧接口：改为只采集不分析
app.post("/api/collect/trigger", (c) => {
    trigger(collectAll, "采集(trigger)");
    return c.json({ message: "已触发采集（不含分析），详见服务端日志" });
});

// ===== 手动分析 =====
// 分析是长任务，用 fire-and-forget 模式：立即返回，进度通过 SSE 推送
app.post("/api/analyze/pending", (c) => {
    trigger(analyzePendingComments, "分析未处理");
    return c.json({ message: "已触发分析未处理评论，进度见概览页" });
});
app.post("/api/analyze/reanalyze-all", (c) => {
    trigger(reanalyzeAllComments, "分析重新全部");
    return c.json({ message: "已触发重新分析全部评论，进度见概览页" });
});

/** 中止正在运行的分析 */
app.post("/api/analyze/abort", (c) => {
    abortAnalysis();
    return c.json({ message: "已发送中止请求，当前批完成后停止" });
});

/** 情感分析评测（人工标注集 + 一致性对比）——显式触发，结果返回报告 */
app.post("/api/analyze/evaluate", async (c) => {
    try {
        const report = await runEvaluation();
        return c.json(report);
    } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
});

/** LLM 容错状态：熔断 / 预算 / 采样（供概览页展示） */
app.get("/api/analyze/fault-tolerance", async (c) => {
    return c.json({
        circuitBreaker: circuitBreakerState(),
        budget: budgetState(),
        sampling: samplingState(),
    });
});

// ===== AI 提供者管理（挂载子路由）=====
app.route("/api/ai-providers", aiProvidersRouter);

// ===== B站服务诊断（挂载子路由）=====
app.route("/api/bili", biliRouter);

// ===== 控制台日志（SSE 实时推送）=====
app.get("/api/console-logs/history", async (c) => {
    const limit = Number(c.req.query("limit") ?? 200);
    return c.json(getHistoryLogs(limit));
});

app.get("/api/console-logs/stream", () => {
    return createSSEStream();
});

app.delete("/api/console-logs", async (c) => {
    clearHistoryLogs();
    return c.json({ ok: true });
});

export default app;
