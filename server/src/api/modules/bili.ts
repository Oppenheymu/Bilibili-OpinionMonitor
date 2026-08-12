import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getClient, getDiagnostics } from "../../bili/client";
import { db } from "../../db";
import { collectionLogs, comments, dynamics, sentimentAnalysis, videos } from "../../db/schema";

/** B站服务诊断路由 */
export const biliRouter = new Hono();

biliRouter.get("/status", async (c) => {
    const biliState = getDiagnostics();
    const [videoRow] = await db.select({ count: sql<number>`count(*)` }).from(videos);
    const [commentRow] = await db.select({ count: sql<number>`count(*)` }).from(comments);
    const [dynamicRow] = await db.select({ count: sql<number>`count(*)` }).from(dynamics);
    const [logRow] = await db.select({ count: sql<number>`count(*)` }).from(collectionLogs);
    const [analysisRow] = await db.select({ count: sql<number>`count(*)` }).from(sentimentAnalysis);

    // 尝试获取登录用户信息
    let userInfo: {
        mid: number;
        nickname: string;
        avatar: string;
        level: number;
        gender: string;
        signature: string;
        vip: boolean;
    } | null = null;
    try {
        const client = await getClient();
        const info = await client.user.getMyInfo();
        // @renmu/bili-api 不同版本返回结构不一：可能已解包（含 profile）或未解包（直接是用户信息）
        const raw = info as { profile?: Record<string, unknown> } & Record<string, unknown>;
        const p = raw.profile ?? raw;
        userInfo = {
            mid: Number(p["mid"] ?? 0),
            nickname: String(p["name"] ?? ""),
            avatar: String(p["face"] ?? ""),
            level: Number(p["level"] ?? 0),
            gender: String(p["sex"] ?? ""),
            signature: String(p["sign"] ?? ""),
            vip: (p["vip"] as { status?: number } | undefined)?.status === 1,
        };
    } catch (e) {
        console.warn("[B站] 获取用户信息失败：", e instanceof Error ? e.message : String(e));
    }

    return c.json({
        ...biliState,
        userInfo,
        dataSummary: {
            videoCount: videoRow?.count ?? 0,
            commentCount: commentRow?.count ?? 0,
            dynamicCount: dynamicRow?.count ?? 0,
            logCount: logRow?.count ?? 0,
            sentimentAnalysisCount: analysisRow?.count ?? 0,
        },
    });
});
