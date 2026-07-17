import { Hono } from "hono";
import * as 库 from "../db/repository";
import { 执行一次采集 } from "../scheduler";

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
    return c.json(await 库.查询视频(页, 大小));
});

app.get("/api/评论", async (c) => {
    const 视频ID = c.req.query("视频ID") ? Number(c.req.query("视频ID")) : undefined;
    const 情感 = c.req.query("情感") ?? undefined;
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    return c.json(await 库.查询评论({ 视频ID, 情感, 页, 大小 }));
});

app.get("/api/动态", async (c) => {
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    return c.json(await 库.查询动态(页, 大小));
});

app.get("/api/日志", async (c) => {
    const 页 = Number(c.req.query("页") ?? 1);
    const 大小 = Number(c.req.query("大小") ?? 20);
    return c.json(await 库.查询日志(页, 大小));
});

// ===== 统计 =====
app.get("/api/统计/概览", async (c) => c.json(await 库.统计概览()));
app.get("/api/统计/情感分布", async (c) => c.json(await 库.情感分布()));
app.get("/api/统计/趋势", async (c) =>
    c.json(await 库.情感趋势(Number(c.req.query("天数") ?? 7))),
);

// ===== 手动触发采集 =====
app.post("/api/采集/触发", async (c) => {
    执行一次采集().catch((e) => console.error("[API] 手动采集失败：", e));
    return c.json({ 消息: "已触发采集，详见服务端日志" });
});

export default app;
