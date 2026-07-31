import { Hono } from "hono";
import * as 库 from "../db/repository";
import { 采集视频, 采集评论, 采集动态, 采集全部, 分析未处理评论, 重新分析全部评论 } from "../scheduler";

const app = new Hono();

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
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    const [列表, 总数] = await Promise.all([
        库.查询评论({ 视频ID, 情感, 搜索, 页, 大小 }),
        库.评论计数({ 视频ID, 情感, 搜索 }),
    ]);
    return c.json({ 列表, 总数 });
});

app.delete("/api/评论", async (c) => {
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
    const [列表, 总数] = await Promise.all([
        库.查询日志(页, 大小),
        库.日志计数(),
    ]);
    return c.json({ 列表, 总数 });
});

// ===== 统计 =====
app.get("/api/统计/概览", async (c) => c.json(await 库.统计概览()));
app.get("/api/统计/情感分布", async (c) => c.json(await 库.情感分布()));
app.get("/api/统计/趋势", async (c) =>
    c.json(await 库.情感趋势(Number(c.req.query("天数") ?? 7))),
);

// ===== 系统配置（密钥加密存储，API 不回显明文）=====
const 敏感键 = new Set(["DeepSeek密钥", "Gemini密钥"]);

app.get("/api/配置", async (c) => {
    const 全部 = await 库.读取所有配置();
    const 结果: Record<string, unknown> = { ...全部 };
    for (const k of 敏感键) {
        结果[`${k}已配置`] = !!全部[k];
        delete 结果[k];
    }
    return c.json(结果);
});

app.put("/api/配置", async (c) => {
    const body = await c.req.json<Record<string, string>>();
    // 密钥类字段传空串则保留原值（跳过覆盖）
    await 库.批量写入配置(body, [...敏感键]);
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
app.post("/api/分析/未处理", (c) => {
    触发(分析未处理评论, "分析未处理");
    return c.json({ 消息: "已触发分析未处理评论，详见服务端日志" });
});
app.post("/api/分析/重新全部", (c) => {
    触发(重新分析全部评论, "分析重新全部");
    return c.json({ 消息: "已触发重新分析全部评论，详见服务端日志" });
});

export default app;
