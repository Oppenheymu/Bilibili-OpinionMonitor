import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { 获取客户端, 诊断状态 } from "../../bili/client";
import { db } from "../../db";
import { 动态, 情感分析, 视频, 评论, 采集日志 } from "../../db/schema";

/** B站服务诊断路由 */
export const B站路由 = new Hono();

B站路由.get("/状态", async (c) => {
    const b站状态 = 诊断状态();
    const [视频行] = await db.select({ 数: sql<number>`count(*)` }).from(视频);
    const [评论行] = await db.select({ 数: sql<number>`count(*)` }).from(评论);
    const [动态行] = await db.select({ 数: sql<number>`count(*)` }).from(动态);
    const [日志行] = await db.select({ 数: sql<number>`count(*)` }).from(采集日志);
    const [分析行] = await db.select({ 数: sql<number>`count(*)` }).from(情感分析);

    // 尝试获取登录用户信息
    let 用户信息: {
        mid: number;
        昵称: string;
        头像: string;
        等级: number;
        性别: string;
        签名: string;
        VIP: boolean;
    } | null = null;
    try {
        const client = await 获取客户端();
        const info = await client.user.getMyInfo();
        // @renmu/bili-api 不同版本返回结构不一：可能已解包（含 profile）或未解包（直接是用户信息）
        const 原始 = info as { profile?: Record<string, unknown> } & Record<string, unknown>;
        const p = 原始.profile ?? 原始;
        用户信息 = {
            mid: Number(p["mid"] ?? 0),
            昵称: String(p["name"] ?? ""),
            头像: String(p["face"] ?? ""),
            等级: Number(p["level"] ?? 0),
            性别: String(p["sex"] ?? ""),
            签名: String(p["sign"] ?? ""),
            VIP: (p["vip"] as { status?: number } | undefined)?.status === 1,
        };
    } catch (e) {
        console.warn("[B站] 获取用户信息失败：", e instanceof Error ? e.message : String(e));
    }

    return c.json({
        ...b站状态,
        用户信息,
        数据摘要: {
            视频数: 视频行?.数 ?? 0,
            评论数: 评论行?.数 ?? 0,
            动态数: 动态行?.数 ?? 0,
            日志数: 日志行?.数 ?? 0,
            情感分析数: 分析行?.数 ?? 0,
        },
    });
});
