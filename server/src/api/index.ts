import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import * as 库 from "../db/repository";
import type { 日志筛选 } from "../db/repository";
import { 采集视频, 采集评论, 采集动态, 采集全部, 分析未处理评论, 重新分析全部评论, 中止分析 } from "../scheduler";
import { 运行评测 } from "../llm/评测";
import { 创建SSE流, 获取历史日志, 清空历史日志 } from "../logger";
import { AI提供者路由 } from "./模块/AI提供者";
import { B站路由 } from "./模块/B站";

const app = new Hono();

// ===== CORS 白名单 =====
// 前端 dev（Vite 5173）与生产均通过同源代理（/api）访问后端，正常流程不需要 CORS；
// 仅当需要跨端口直连（如绕过代理直连 SSE）时才生效。
// 不在白名单的跨域来源不返回 Access-Control-Allow-Origin 头，浏览器会拦截。
// 生产环境如有独立前端域名，用环境变量「允许来源」以逗号分隔配置。
const 允许来源 = (
    process.env["允许来源"] ??
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5160,http://127.0.0.1:5160"
)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    "*",
    cors({
        origin: (origin) => (允许来源.includes(origin) ? origin : null),
        credentials: true,
    }),
);

// ===== 访问令牌认证 =====
// 在「系统配置」中设置"访问令牌"后启用；未配置则放行（兼容首次部署/本地开发）
// 三种携带方式：Authorization: Bearer <token>、x-access-token 头、SSE 的 ?token= 查询参数
async function 访问令牌中间件(c: Context, next: Next): Promise<Response | void> {
    const 访问令牌 = await 库.读取配置项("访问令牌");
    if (!访问令牌) return next();
    // 豁免：读取系统配置（已脱敏，仅返回非敏感项 + "已配置"标记）无需令牌。
    // 否则客户端一旦丢失令牌，连设置页都打不开，无法重新配置 —— 形成死锁。
    if (c.req.method === "GET" && c.req.path === "/api/配置") return next();
    const 头 = c.req.header("Authorization") ?? c.req.header("x-access-token") ?? "";
    const 携带令牌 = (头.startsWith("Bearer ") ? 头.slice(7) : 头) || c.req.query("token") || "";
    if (携带令牌 && 携带令牌 === 访问令牌) return next();
    return c.json({ 错误: "未授权：访问令牌缺失或无效，请在「系统配置」中核对" }, 401);
}
app.use("*", 访问令牌中间件);

// ===== 任务管理 =====
app.get("/api/任务", async (c) => c.json(await 库.列出任务()));

app.post("/api/任务", async (c) => {
    const body = await c.req.json<{ 类型: string; 目标: string }>();
    try {
        const 行 = await 库.创建任务(body.类型, body.目标);
        return c.json(行, 201);
    } catch (e) {
        return c.json({ 错误: e instanceof Error ? e.message : String(e) }, 400);
    }
});

app.patch("/api/任务/:id", async (c) => {
    const body = await c.req.json<{ 启用: boolean }>();
    await 库.更新任务(Number(c.req.param("id")), body.启用);
    return c.json({ ok: true });
});

app.delete("/api/任务/:id", async (c) => {
    await 库.删除任务(Number(c.req.param("id")));
    return c.json({ ok: true });
});

// ===== 内容查询 =====
app.get("/api/视频", async (c) => {
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    const [列表, 总数] = await Promise.all([
        库.查询视频(页, 大小),
        库.视频计数(),
    ]);
    return c.json({ 列表, 总数 });
});

app.get("/api/评论", async (c) => {
    const 视频ID = c.req.query("视频ID") ? Number(c.req.query("视频ID")) : undefined;
    const 情感 = c.req.query("情感") ?? undefined;
    const 搜索 = c.req.query("搜索") ?? undefined;
    const 已删除 = c.req.query("已删除") === "true" ? true : c.req.query("已删除") === "false" ? false : undefined;
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    const [列表, 总数] = await Promise.all([
        库.查询评论({ 视频ID, 情感, 搜索, 已删除, 页, 大小 }),
        库.评论计数({ 视频ID, 情感, 搜索, 已删除 }),
    ]);
    return c.json({ 列表, 总数 });
});

// 危险操作需显式确认：清空全量数据不可恢复，必须携带 ?确认=1（防误触/恶意调用）
app.delete("/api/评论", async (c) => {
    if (c.req.query("确认") !== "1") {
        return c.json({ 错误: "危险操作：清空全部评论及情感分析不可恢复，请携带 确认=1 确认" }, 400);
    }
    const 结果 = await 库.清空评论();
    return c.json({ 消息: `已清空 ${结果.评论} 条评论及 ${结果.情感分析} 条情感分析记录`, ...结果 });
});

app.get("/api/动态", async (c) => {
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    const [列表, 总数] = await Promise.all([
        库.查询动态(页, 大小),
        库.动态计数(),
    ]);
    return c.json({ 列表, 总数 });
});

app.get("/api/日志", async (c) => {
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    const 阶段 = c.req.query("阶段");
    const 状态 = c.req.query("状态");
    const 筛选: 日志筛选 | undefined = 阶段 || 状态 ? { 阶段, 状态 } : undefined;
    const [列表, 总数] = await Promise.all([
        库.查询日志(页, 大小, 筛选),
        库.日志计数(筛选),
    ]);
    return c.json({ 列表, 总数 });
});

app.get("/api/日志/统计", async (c) => c.json(await 库.日志统计()));

app.delete("/api/日志", async (c) => {
    if (c.req.query("确认") !== "1") {
        return c.json({ 错误: "危险操作：清空全部采集日志不可恢复，请携带 确认=1 确认" }, 400);
    }
    const 数 = await 库.清空日志();
    return c.json({ 消息: `已清空 ${数} 条日志`, 清空数: 数 });
});

// ===== 统计 =====
app.get("/api/统计/概览", async (c) => c.json(await 库.统计概览()));
app.get("/api/统计/情感分布", async (c) => c.json(await 库.情感分布()));
app.get("/api/统计/趋势", async (c) =>
    c.json(await 库.情感趋势(Number(c.req.query("天数") ?? 7))),
);
// 舆论分析：热门话题（话题×情感交叉）与舆情预警
app.get("/api/统计/话题", async (c) =>
    c.json(await 库.话题统计(Number(c.req.query("限制") ?? 20))),
);
app.get("/api/统计/舆情预警", async (c) =>
    c.json(await 库.舆情预警(Number(c.req.query("限制") ?? 10))),
);

// ===== 系统配置 =====

/** 敏感键集合：这些键的值不返回明文，仅返回是否已配置 */
const 敏感配置键 = new Set(["DeepSeek密钥", "Gemini密钥", "访问令牌"]);

app.get("/api/配置", async (c) => {
    const 全部 = await 库.读取所有配置();
    // 脱敏：密钥类字段仅返回"已配置"标记，前端无需明文
    const 脱敏: Record<string, string> = {};
    for (const [键, 值] of Object.entries(全部)) {
        if (敏感配置键.has(键)) {
            脱敏[键] = 值 ? "已配置" : "";
        } else {
            脱敏[键] = 值;
        }
    }
    return c.json(脱敏);
});

app.put("/api/配置", async (c) => {
    const body = await c.req.json<Record<string, string>>();
    // 敏感键传空串时跳过不覆盖（"留空保留原值"语义，避免把令牌覆盖成空/占位符）
    await 库.批量写入配置(body, [...敏感配置键]);
    return c.json({ ok: true, 消息: "配置已保存" });
});

// ===== 手动采集（细分，不含分析）=====
const 触发 = (fn: () => Promise<unknown>, 名称: string) => {
    fn().catch((e) => console.error(`[API] ${名称}失败：`, e));
};

app.post("/api/采集/视频", (c) => {
    触发(采集视频, "采集视频");
    return c.json({ 消息: "已触发采集视频，详见服务端日志" });
});
app.post("/api/采集/评论", (c) => {
    触发(采集评论, "采集评论");
    return c.json({ 消息: "已触发采集评论，详见服务端日志" });
});
app.post("/api/采集/动态", (c) => {
    触发(采集动态, "采集动态");
    return c.json({ 消息: "已触发采集动态，详见服务端日志" });
});
app.post("/api/采集/全部", (c) => {
    触发(采集全部, "采集全部");
    return c.json({ 消息: "已触发采集全部（不含分析），详见服务端日志" });
});
// 兼容旧接口：改为只采集不分析
app.post("/api/采集/触发", (c) => {
    触发(采集全部, "采集(触发)");
    return c.json({ 消息: "已触发采集（不含分析），详见服务端日志" });
});

// ===== 手动分析 =====
// 分析是长任务，用 fire-and-forget 模式：立即返回，进度通过 SSE 推送
app.post("/api/分析/未处理", (c) => {
    触发(分析未处理评论, "分析未处理");
    return c.json({ 消息: "已触发分析未处理评论，进度见概览页" });
});
app.post("/api/分析/重新全部", (c) => {
    触发(重新分析全部评论, "分析重新全部");
    return c.json({ 消息: "已触发重新分析全部评论，进度见概览页" });
});

/** 中止正在运行的分析 */
app.post("/api/分析/中止", (c) => {
    中止分析();
    return c.json({ 消息: "已发送中止请求，当前批完成后停止" });
});

/** 情感分析评测（人工标注集 + 一致性对比）——显式触发，结果返回报告 */
app.post("/api/分析/评测", async (c) => {
    try {
        const 报告 = await 运行评测();
        return c.json(报告);
    } catch (e) {
        return c.json({ 错误: e instanceof Error ? e.message : String(e) }, 400);
    }
});

// ===== AI 提供者管理（挂载子路由）=====
app.route("/api/AI提供者", AI提供者路由);

// ===== B站服务诊断（挂载子路由）=====
app.route("/api/B站", B站路由);

// ===== 控制台日志（SSE 实时推送）=====
app.get("/api/控制台日志/历史", async (c) => {
    const 限制 = Number(c.req.query("限制") ?? 200);
    return c.json(获取历史日志(限制));
});

app.get("/api/控制台日志/流", (c) => {
    return 创建SSE流();
});

app.delete("/api/控制台日志", async (c) => {
    清空历史日志();
    return c.json({ ok: true });
});

export default app;
