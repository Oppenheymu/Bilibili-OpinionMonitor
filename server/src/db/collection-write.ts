import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CommentItem, DynamicSummary, VideoDetail, VideoSummary } from "../bili/types";
import type { SentimentResult } from "../llm/analyzer";
import { db } from "./index";
import {
    collectionLogs,
    comments,
    dynamics,
    monitorTasks,
    sentimentAnalysis,
    videoStats,
    videos,
} from "./schema";

const now = () => Math.floor(Date.now() / 1000);

// ===== 任务 =====

export async function getEnabledTasks() {
    return db.select().from(monitorTasks).where(eq(monitorTasks.enabled, true));
}

export async function updateLastCollectedAt(taskId: number): Promise<void> {
    await db
        .update(monitorTasks)
        .set({ lastCollectedAt: now() })
        .where(eq(monitorTasks.id, taskId));
}

// ===== 采集内容写入 =====

/**
 * 批量保存视频（消除 N+1：每任务 1 次 in 查询 + 1 次批量插入，替代逐条 select+insert）
 * 已存在的 BV 号自动跳过（onConflictDoNothing，兼顾跨任务重复采集）
 * @returns BV号 → 视频ID 映射（含已存在的）
 */
export async function saveVideosBatch(
    summaries: VideoSummary[],
    taskId: number | null,
): Promise<Map<string, number>> {
    if (summaries.length === 0) return new Map();
    const bvidSet = summaries.map((v) => v.bvid);
    // 一次查清已存在的视频
    const existingRows = await db
        .select({ bvid: videos.bvid, id: videos.id })
        .from(videos)
        .where(inArray(videos.bvid, bvidSet));
    const result = new Map(existingRows.map((r) => [r.bvid, r.id]));

    // 只插入新视频（一条语句批量插入）
    const newItems = summaries.filter((v) => !result.has(v.bvid));
    if (newItems.length > 0) {
        const collectedAt = now();
        const inserted = await db
            .insert(videos)
            .values(
                newItems.map((v) => ({
                    bvid: v.bvid,
                    aid: v.aid,
                    title: v.title,
                    description: v.description,
                    upUid: v.upUid,
                    upName: v.upName,
                    publishTime: v.publishTime,
                    cover: v.cover,
                    sourceTaskId: taskId,
                    collectedAt,
                })),
            )
            .onConflictDoNothing({ target: videos.bvid })
            .returning({ bvid: videos.bvid, id: videos.id });
        for (const r of inserted) result.set(r.bvid, r.id);
    }
    return result;
}

export async function saveVideoStats(videoId: number, detail: VideoDetail): Promise<void> {
    // 同步 AI 字幕（视频内容上下文，供情感分析参考）
    if (detail.subtitle) {
        await db.update(videos).set({ subtitle: detail.subtitle }).where(eq(videos.id, videoId));
    }
    await db.insert(videoStats).values({
        videoId,
        views: detail.stats.views,
        danmaku: detail.stats.danmaku,
        comments: detail.stats.comments,
        favorites: detail.stats.favorites,
        coins: detail.stats.coins,
        shares: detail.stats.shares,
        likes: detail.stats.likes,
        recordedAt: now(),
    });
}

export async function saveComments(videoId: number, mainComments: CommentItem[]): Promise<number> {
    const collectedAt = now();
    const rows: (typeof comments.$inferInsert)[] = [];
    for (const c of mainComments) {
        rows.push({
            rpid: c.rpid,
            videoId,
            rootRpid: 0,
            parentRpid: 0,
            userUid: c.mid,
            username: c.uname,
            content: c.message,
            likes: c.like,
            replies: c.rcount,
            publishTime: c.ctime,
            collectedAt,
            isReply: false,
        });
        for (const r of c.replies ?? []) {
            rows.push({
                rpid: r.rpid,
                videoId,
                rootRpid: c.rpid,
                parentRpid: r.parent,
                userUid: r.mid,
                username: r.uname,
                content: r.message,
                likes: r.like,
                replies: r.rcount,
                publishTime: r.ctime,
                collectedAt,
                isReply: true,
            });
        }
    }
    if (rows.length === 0) return 0;
    await db.insert(comments).values(rows).onConflictDoNothing({ target: comments.rpid });
    return rows.length;
}

/**
 * 增量保存评论（UPSERT）：新评论插入，已存在的更新点赞/回复数与最后更新时间
 * 支持热度追踪（热评升降）与删除检测（重新出现的评论清除墓碑标记）
 * @returns 新增评论数
 */
export async function upsertComments(
    videoId: number,
    mainComments: CommentItem[],
): Promise<number> {
    const collectedAt = now();
    const rows: (typeof comments.$inferInsert)[] = [];
    for (const c of mainComments) {
        rows.push({
            rpid: c.rpid,
            videoId,
            rootRpid: 0,
            parentRpid: 0,
            userUid: c.mid,
            username: c.uname,
            content: c.message,
            likes: c.like,
            replies: c.rcount,
            publishTime: c.ctime,
            collectedAt,
            isReply: false,
        });
        for (const r of c.replies ?? []) {
            rows.push({
                rpid: r.rpid,
                videoId,
                rootRpid: c.rpid,
                parentRpid: r.parent,
                userUid: r.mid,
                username: r.uname,
                content: r.message,
                likes: r.like,
                replies: r.rcount,
                publishTime: r.ctime,
                collectedAt,
                isReply: true,
            });
        }
    }
    if (rows.length === 0) return 0;
    // upsert 前统计该视频已有评论数（用于计算新增数）
    const [before] = await db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.videoId, videoId));
    // UPSERT：新评论插入；已存在则更新点赞/回复数 + 最后更新时间 + 清除删除标记（复活）
    await db
        .insert(comments)
        .values(rows)
        .onConflictDoUpdate({
            target: comments.rpid,
            set: {
                likes: sql`excluded.likes`,
                replies: sql`excluded.replies`,
                updatedAt: collectedAt,
                isDeleted: false,
                deletedAt: null,
            },
        });
    const [after] = await db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.videoId, videoId));
    return Math.max(0, (after?.count ?? 0) - (before?.count ?? 0));
}

/**
 * 标记已删除评论（墓碑机制核心）
 * 对「完整采集」的视频：本次接口返回的 rpid 集合 vs 库中已有主评论 rpid 集合，
 * 差集 = 已被删除/封禁/精选过滤的评论 → 标记 是否已删除 + 删除时间
 * @param isFull 该视频本次是否完整拉取（未截断），只有完整快照才能做删除检测，
 *                否则漏采的评论会被误判为"已删除"
 */
export async function markDeletedComments(
    videoId: number,
    currentRpids: number[],
    isFull: boolean,
): Promise<number> {
    if (!isFull || currentRpids.length === 0) return 0;
    const collectedAt = now();
    // 该视频所有未被标记删除的主评论 rpid（根rpid=0 且非楼中楼）
    const dbRows = await db
        .select({ rpid: comments.rpid })
        .from(comments)
        .where(
            and(
                eq(comments.videoId, videoId),
                eq(comments.isReply, false),
                eq(comments.isDeleted, false),
            ),
        );
    const dbSet = new Set(dbRows.map((r) => r.rpid));
    const currentSet = new Set(currentRpids);
    const deletedRpids = [...dbSet].filter((r) => !currentSet.has(r));
    if (deletedRpids.length === 0) return 0;
    await db
        .update(comments)
        .set({ isDeleted: true, deletedAt: collectedAt, updatedAt: collectedAt })
        .where(
            and(
                eq(comments.videoId, videoId),
                eq(comments.isDeleted, false),
                inArray(comments.rpid, deletedRpids),
            ),
        );
    console.log(`[采集] 视频 ${videoId} 检测到 ${deletedRpids.length} 条评论被删除/隐藏`);
    return deletedRpids.length;
}

export async function saveDynamics(upUid: number, dynamicList: DynamicSummary[]): Promise<number> {
    if (dynamicList.length === 0) return 0;
    const collectedAt = now();
    const rows: (typeof dynamics.$inferInsert)[] = dynamicList.map((d) => ({
        dynamicId: d.dynamicId,
        upUid,
        type: d.type,
        content: d.content,
        publishTime: d.publishTime,
        collectedAt,
    }));
    await db.insert(dynamics).values(rows).onConflictDoNothing({ target: dynamics.dynamicId });
    return rows.length;
}

export async function saveSentiment(
    sourceType: "评论" | "动态",
    sourceId: number,
    result: SentimentResult,
    model: string,
): Promise<void> {
    await db.insert(sentimentAnalysis).values({
        sourceType,
        sourceId,
        sentiment: result.sentiment,
        sentimentScore: result.sentimentScore,
        keywords: result.keywords,
        summary: result.summary,
        model,
        analyzedAt: now(),
    });
}

/**
 * 批量保存情感结果（一次插入多条，避免逐条 insert）
 * 用于批量分析：一批 20 条评论只发 1 条 SQL
 */
export async function saveSentimentsBatch(
    sourceType: "评论" | "动态",
    items: { sourceId: number; result: SentimentResult }[],
    model: string,
): Promise<void> {
    if (items.length === 0) return;
    const analyzedAt = now();
    await db.insert(sentimentAnalysis).values(
        items.map(({ sourceId, result }) => ({
            sourceType,
            sourceId,
            sentiment: result.sentiment,
            sentimentScore: result.sentimentScore,
            keywords: result.keywords,
            summary: result.summary,
            model,
            analyzedAt,
        })),
    );
}

export async function writeLog(
    taskId: number | null,
    stage: string,
    status: "成功" | "失败" | "进行中",
    collectedCount: number,
    durationMs: number,
    errorMessage: string | null,
): Promise<void> {
    await db.insert(collectionLogs).values({
        taskId,
        stage,
        status,
        collectedCount,
        durationMs,
        errorMessage,
        createdAt: now(),
    });
}

/**
 * 查询每个视频最近一次评论采集时间（秒时间戳）
 * 用于评论增量采集的间隔判断：刚采集过的视频跳过，避免每次全量拉取触发 B站风控
 */
export async function getLastCommentCollectTime(): Promise<Map<number, number>> {
    const rows = await db
        .select({
            videoId: comments.videoId,
            latest: sql<number>`max(${comments.collectedAt})`,
        })
        .from(comments)
        .groupBy(comments.videoId);
    return new Map(rows.map((r) => [r.videoId, r.latest]));
}

/**
 * 查询未分析评论（按"影响力"降序：点赞数为主、楼中楼讨论热度为辅）
 * 预算有限时优先分析高影响力评论，保证采样代表性
 * 附带所属视频上下文（标题/描述/分区/字幕），供 LLM 结合视频内容判断情感
 */
export async function getUnanalyzedComments(batchSize: number) {
    return db
        .select({
            commentId: comments.id,
            content: comments.content,
            likes: comments.likes,
            replies: comments.replies,
            videoTitle: videos.title,
            videoDescription: videos.description,
            partitionName: videos.partitionName,
            subtitle: videos.subtitle,
        })
        .from(comments)
        .leftJoin(videos, eq(comments.videoId, videos.id))
        .leftJoin(
            sentimentAnalysis,
            and(
                eq(sentimentAnalysis.sourceId, comments.id),
                eq(sentimentAnalysis.sourceType, "评论"),
            ),
        )
        .where(isNull(sentimentAnalysis.id))
        .orderBy(desc(comments.likes), desc(comments.replies))
        .limit(batchSize);
}

/** 查询尚未分析的评论总数（用于进度展示） */
export async function countUnanalyzedComments(): Promise<number> {
    const [row] = await db
        .select({ count: count() })
        .from(comments)
        .leftJoin(
            sentimentAnalysis,
            and(
                eq(sentimentAnalysis.sourceId, comments.id),
                eq(sentimentAnalysis.sourceType, "评论"),
            ),
        )
        .where(isNull(sentimentAnalysis.id));
    return row?.count ?? 0;
}
