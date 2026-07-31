import { Hono } from "hono";
import * as 库 from "../db/repository";
import { 诊断状态, 获取客户端 } from "../bili/client";
import { 采集视频, 采集评论, 采集动态, 采集全部, 分析未处理评论, 重新分析全部评论 } from "../scheduler";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { 评论, 视频, 动态, 采集日志, 情感分析 } from "../db/schema";

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
    const 阶段 = c.req.query("阶段") ?? undefined;
    const 状态 = c.req.query("状态") ?? undefined;
    const 筛选: 库.日志筛选 | undefined = (阶段 || 状态) ? { 阶段, 状态 } : undefined;
    const [列表, 总数] = await Promise.all([
        库.查询日志(页, 大小, 筛选),
        库.日志计数(筛选),
    ]);
    return c.json({ 列表, 总数 });
});

app.get("/api/日志/统计", async (c) => c.json(await 库.日志统计()));

app.delete("/api/日志", async (c) => {
    const 数 = await 库.清空日志();
    return c.json({ 消息: `已清空 ${数} 条日志`, 清空数: 数 });
});

// ===== 统计 =====
app.get("/api/统计/概览", async (c) => c.json(await 库.统计概览()));
app.get("/api/统计/情感分布", async (c) => c.json(await 库.情感分布()));
app.get("/api/统计/趋势", async (c) =>
    c.json(await 库.情感趋势(Number(c.req.query("天数") ?? 7))),
);

// ===== 系统配置 =====

app.get("/api/配置", async (c) => {
    const 全部 = await 库.读取所有配置();
    return c.json(全部);
});

app.put("/api/配置", async (c) => {
    const body = await c.req.json<Record<string, string>>();
    await 库.批量写入配置(body, []);
    return c.json({ ok: true, 消息: "配置已保存" });
});

// ===== B站服务诊断 =====
app.get("/api/B站/状态", async (c) => {
    const b站状态 = 诊断状态();
    const [视频行] = await db.select({ 数: sql<number>`count(*)` }).from(视频);
    const [评论行] = await db.select({ 数: sql<number>`count(*)` }).from(评论);
    const [动态行] = await db.select({ 数: sql<number>`count(*)` }).from(动态);
    const [日志行] = await db.select({ 数: sql<number>`count(*)` }).from(采集日志);
    const [分析行] = await db.select({ 数: sql<number>`count(*)` }).from(情感分析);

    // 尝试获取登录用户信息
    let 用户信息: { mid: number; 昵称: string; 头像: string; 等级: number; 性别: string; 签名: string; VIP: boolean } | null = null;
    try {
        const client = await 获取客户端();
        const info = await client.user.getMyInfo();
        const p = (info as any).profile ?? info;
        用户信息 = {
            mid: p.mid,
            昵称: p.name,
            头像: p.face,
            等级: p.level,
            性别: p.sex,
            签名: p.sign,
            VIP: p.vip?.status === 1,
        };
    } catch (e) {
        console.warn("[B站] 获取用户信息失败：", e instanceof Error ? e.message : String(e));
    }

    return c.json({
        ...b站状态,
        用户信息,
        数据摘要: {
            视频数: 视频行.数,
            评论数: 评论行.数,
            动态数: 动态行.数,
            日志数: 日志行.数,
            情感分析数: 分析行.数,
        },
    });
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

// ===== AI 提供者管理（通用 LLM 服务商 CRUD）=====

app.get("/api/AI提供者", async (c) => c.json(await 库.列出AI提供者()));

app.post("/api/AI提供者", async (c) => {
    const body = await c.req.json<{
        名称: string; 提供商标识: string; API密钥: string;
        API地址: string; 模型: string; 温度: number;
        最大令牌?: number; 启用: boolean; 是否默认: boolean; 排序: number;
    }>();
    try {
        const 行 = await 库.创建AI提供者({
            名称: body.名称,
            提供商标识: body.提供商标识,
            API密钥: body.API密钥,
            API地址: body.API地址,
            模型: body.模型,
            温度: Math.round(body.温度 * 100),  // 前端传 0-1，库中存 0-100
            最大令牌: body.最大令牌 ?? null,
            启用: body.启用,
            是否默认: body.是否默认,
            排序: body.排序 ?? 0,
        });
        // 如果设为默认，清除其他默认标记
        if (body.是否默认) await 库.设定默认AI提供者(行.提供者ID);
        return c.json(行, 201);
    } catch (e) {
        return c.json({ 错误: e instanceof Error ? e.message : String(e) }, 400);
    }
});

app.put("/api/AI提供者/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json<{
        名称?: string; 提供商标识?: string; API密钥?: string;
        API地址?: string; 模型?: string; 温度?: number;
        最大令牌?: number; 启用?: boolean; 是否默认?: boolean; 排序?: number;
    }>();
    const 更新数据: Record<string, unknown> = {};
    if (body.名称 !== undefined) 更新数据["名称"] = body.名称;
    if (body.提供商标识 !== undefined) 更新数据["提供商标识"] = body.提供商标识;
    if (body.API密钥 !== undefined && body.API密钥 !== "") 更新数据["API密钥"] = body.API密钥; // 空串保留原值
    if (body.API地址 !== undefined) 更新数据["API地址"] = body.API地址;
    if (body.模型 !== undefined) 更新数据["模型"] = body.模型;
    if (body.温度 !== undefined) 更新数据["温度"] = Math.round(body.温度 * 100);
    if (body.最大令牌 !== undefined) 更新数据["最大令牌"] = body.最大令牌;
    if (body.启用 !== undefined) 更新数据["启用"] = body.启用;
    if (body.是否默认 !== undefined) 更新数据["是否默认"] = body.是否默认;
    if (body.排序 !== undefined) 更新数据["排序"] = body.排序;
    await 库.更新AI提供者(id, 更新数据 as any);
    if (body.是否默认) await 库.设定默认AI提供者(id);
    return c.json({ ok: true });
});

app.delete("/api/AI提供者/:id", async (c) => {
    await 库.删除AI提供者(Number(c.req.param("id")));
    return c.json({ ok: true });
});

app.post("/api/AI提供者/:id/设为默认", async (c) => {
    await 库.设定默认AI提供者(Number(c.req.param("id")));
    return c.json({ ok: true });
});

export default app;
