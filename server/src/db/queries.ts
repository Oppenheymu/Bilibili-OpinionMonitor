import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { collectionLogs, comments, dynamics, sentimentAnalysis, videos } from "./schema";
import { stopwordList } from "./stopwords";

// ===== 分页查询 =====

export async function queryVideos(page = 1, size = 20) {
    return db
        .select()
        .from(videos)
        .orderBy(desc(videos.publishTime))
        .limit(size)
        .offset((page - 1) * size);
}

export async function queryComments(filters: {
    videoId?: number | undefined;
    sentiment?: string | undefined;
    keyword?: string | undefined;
    deleted?: boolean | undefined;
    page: number;
    size: number;
}) {
    const { videoId, sentiment, keyword, deleted, page, size } = filters;
    const conditions = [];
    if (videoId !== undefined) conditions.push(eq(comments.videoId, videoId));
    if (sentiment) conditions.push(eq(sentimentAnalysis.sentiment, sentiment));
    if (keyword) conditions.push(like(comments.content, `%${keyword}%`));
    if (deleted !== undefined) conditions.push(eq(comments.isDeleted, deleted));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return db
        .select({
            id: comments.id,
            rpid: comments.rpid,
            videoId: comments.videoId,
            videoTitle: videos.title,
            bvid: videos.bvid,
            userUid: comments.userUid,
            username: comments.username,
            content: comments.content,
            likes: comments.likes,
            replies: comments.replies,
            publishTime: comments.publishTime,
            isReply: comments.isReply,
            isDeleted: comments.isDeleted,
            deletedAt: comments.deletedAt,
            sentiment: sentimentAnalysis.sentiment,
            sentimentScore: sentimentAnalysis.sentimentScore,
        })
        .from(comments)
        .leftJoin(videos, eq(videos.id, comments.videoId))
        .leftJoin(
            sentimentAnalysis,
            and(
                eq(sentimentAnalysis.sourceId, comments.id),
                eq(sentimentAnalysis.sourceType, "评论"),
            ),
        )
        .where(where ?? undefined)
        .orderBy(desc(comments.publishTime))
        .limit(size)
        .offset((page - 1) * size);
}

export async function queryDynamics(page = 1, size = 20) {
    return db
        .select()
        .from(dynamics)
        .orderBy(desc(dynamics.publishTime))
        .limit(size)
        .offset((page - 1) * size);
}

/** 采集日志筛选参数 */
export interface LogFilter {
    stage?: string | undefined;
    status?: string | undefined;
}

/** 查询采集日志（支持筛选与分页） */
export async function queryLogs(page = 1, size = 20, filter?: LogFilter) {
    const conditions: ReturnType<typeof sql>[] = [];
    if (filter?.stage) conditions.push(sql`${collectionLogs.stage} = ${filter.stage}`);
    if (filter?.status) conditions.push(sql`${collectionLogs.status} = ${filter.status}`);
    const query = db.select().from(collectionLogs).$dynamic();
    if (conditions.length > 0) query.where(sql.join(conditions, " AND "));
    return query
        .orderBy(desc(collectionLogs.createdAt))
        .limit(size)
        .offset((page - 1) * size);
}

// ===== 计数 =====

/** 带筛选条件的评论总数（用于分页） */
export async function countComments(filters: {
    videoId?: number | undefined;
    sentiment?: string | undefined;
    keyword?: string | undefined;
    deleted?: boolean | undefined;
}): Promise<number> {
    const { videoId, sentiment, keyword, deleted } = filters;
    const conditions = [];
    if (videoId !== undefined) conditions.push(eq(comments.videoId, videoId));
    if (keyword) conditions.push(like(comments.content, `%${keyword}%`));
    if (deleted !== undefined) conditions.push(eq(comments.isDeleted, deleted));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = db.select({ count: count() }).from(comments);
    if (sentiment) {
        query
            .leftJoin(
                sentimentAnalysis,
                and(
                    eq(sentimentAnalysis.sourceId, comments.id),
                    eq(sentimentAnalysis.sourceType, "评论"),
                ),
            )
            .where(
                where
                    ? and(where, eq(sentimentAnalysis.sentiment, sentiment))
                    : eq(sentimentAnalysis.sentiment, sentiment),
            );
    } else {
        if (where) query.where(where);
    }
    const [row] = await query;
    return row?.count ?? 0;
}

export async function countVideos(): Promise<number> {
    const [row] = await db.select({ count: count() }).from(videos);
    return row?.count ?? 0;
}

export async function countDynamics(): Promise<number> {
    const [row] = await db.select({ count: count() }).from(dynamics);
    return row?.count ?? 0;
}

/** 采集日志总数（支持筛选） */
export async function countLogs(filter?: LogFilter): Promise<number> {
    const conditions: ReturnType<typeof sql>[] = [];
    if (filter?.stage) conditions.push(sql`${collectionLogs.stage} = ${filter.stage}`);
    if (filter?.status) conditions.push(sql`${collectionLogs.status} = ${filter.status}`);
    const query =
        conditions.length > 0
            ? db
                  .select({ count: count() })
                  .from(collectionLogs)
                  .where(sql.join(conditions, " AND "))
            : db.select({ count: count() }).from(collectionLogs);
    const [row] = await query;
    return row?.count ?? 0;
}

/** 清空所有采集日志 */
export async function clearLogs(): Promise<number> {
    const result = await db.delete(collectionLogs).returning({ id: collectionLogs.id });
    return result.length;
}

// ===== 统计 =====

/** 日志统计：按阶段和状态汇总（单次 groupBy 聚合，避免逐阶段 N+1 查询） */
export async function logStats(): Promise<{
    total: number;
    successCount: number;
    failureCount: number;
    inProgressCount: number;
    byStage: { stage: string; count: number; success: number; failure: number }[];
}> {
    const [totalRow] = await db.select({ count: count() }).from(collectionLogs);
    const groupedRows = await db
        .select({ stage: collectionLogs.stage, status: collectionLogs.status, count: count() })
        .from(collectionLogs)
        .groupBy(collectionLogs.stage, collectionLogs.status);

    let successCount = 0;
    let failureCount = 0;
    let inProgressCount = 0;
    const byStageMap = new Map<
        string,
        { stage: string; count: number; success: number; failure: number }
    >();

    for (const r of groupedRows) {
        if (r.status === "成功") successCount += r.count;
        else if (r.status === "失败") failureCount += r.count;
        else if (r.status === "进行中") inProgressCount += r.count;
        const item = byStageMap.get(r.stage) ?? {
            stage: r.stage,
            count: 0,
            success: 0,
            failure: 0,
        };
        item.count += r.count;
        if (r.status === "成功") item.success += r.count;
        else if (r.status === "失败") item.failure += r.count;
        byStageMap.set(r.stage, item);
    }

    return {
        total: totalRow?.count ?? 0,
        successCount,
        failureCount,
        inProgressCount,
        byStage: [...byStageMap.values()].sort((a, b) => b.count - a.count),
    };
}

export async function overviewStats() {
    const [videoRow] = await db.select({ count: count() }).from(videos);
    const [commentRow] = await db.select({ count: count() }).from(comments);
    const [dynamicRow] = await db.select({ count: count() }).from(dynamics);
    const [deletedRow] = await db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.isDeleted, true));
    const [analyzedRow] = await db
        .select({ count: count() })
        .from(sentimentAnalysis)
        .where(eq(sentimentAnalysis.sourceType, "评论"));
    const dist = await db
        .select({ sentiment: sentimentAnalysis.sentiment, count: count() })
        .from(sentimentAnalysis)
        .where(eq(sentimentAnalysis.sourceType, "评论"))
        .groupBy(sentimentAnalysis.sentiment);

    const sentimentDist: Record<string, number> = {};
    for (const r of dist) {
        sentimentDist[r.sentiment] = r.count;
    }
    return {
        videoTotal: videoRow?.count ?? 0,
        commentTotal: commentRow?.count ?? 0,
        dynamicTotal: dynamicRow?.count ?? 0,
        deletedComments: deletedRow?.count ?? 0, // 墓碑机制：被删/封禁/精选过滤的评论数（舆情信号）
        analyzedComments: analyzedRow?.count ?? 0,
        sentimentDist,
    };
}

export async function sentimentDistribution() {
    return db
        .select({ sentiment: sentimentAnalysis.sentiment, count: count() })
        .from(sentimentAnalysis)
        .where(eq(sentimentAnalysis.sourceType, "评论"))
        .groupBy(sentimentAnalysis.sentiment);
}

export async function sentimentTrend(days = 7) {
    const dateExpr = sql`date(${comments.publishTime}, 'unixepoch', 'localtime')`;
    return db
        .select({
            date: sql<string>`date(${comments.publishTime}, 'unixepoch', 'localtime')`.as("date"),
            commentCount: count(),
            avgScore: sql<number>`coalesce(round(avg(${sentimentAnalysis.sentimentScore}), 1), 0)`,
        })
        .from(comments)
        .leftJoin(
            sentimentAnalysis,
            and(
                eq(sentimentAnalysis.sourceId, comments.id),
                eq(sentimentAnalysis.sourceType, "评论"),
            ),
        )
        .groupBy(dateExpr)
        .orderBy(desc(dateExpr))
        .limit(days);
}

// ===== 舆论分析（话题维度）=====

export interface TopicStatItem {
    topic: string;
    count: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    negativeRatio: number; // 0~1
}

/**
 * 热门话题统计：展开情感分析.keywords（json 数组），按话题聚合频率与正负分布
 * 噪音过滤：停用词表 + 单字 + 纯数字/符号 + 长句（见 stopwords.ts）
 * 这是"舆论分析"区别于"情感分析"的核心——回答"大家在讨论什么"
 */
export async function topicStats(limit = 20): Promise<TopicStatItem[]> {
    // 停用词是代码内常量（无用户输入），转义后内联拼入，避免运行时参数传递
    const stopwordSql = stopwordList.map((w) => `'${w.replace(/'/g, "''")}'`).join(",");
    const rows = db.all<Record<string, unknown>>(sql`
        SELECT
            k.value AS topic,
            COUNT(*) AS count,
            SUM(CASE WHEN sentiment_analysis.sentiment = '正面' THEN 1 ELSE 0 END) AS positive_count,
            SUM(CASE WHEN sentiment_analysis.sentiment = '负面' THEN 1 ELSE 0 END) AS negative_count,
            SUM(CASE WHEN sentiment_analysis.sentiment = '中性' THEN 1 ELSE 0 END) AS neutral_count
        FROM sentiment_analysis
        JOIN json_each(sentiment_analysis.keywords) AS k
        WHERE sentiment_analysis.source_type = '评论'
          AND length(k.value) > 1                 -- 过滤单字
          AND length(k.value) <= 20               -- 过滤长句摘要
          AND k.value NOT GLOB '*[0-9]*'          -- 过滤含数字
          AND k.value NOT IN (${sql.raw(stopwordSql)})
        GROUP BY k.value
        ORDER BY count DESC
        LIMIT ${limit}
    `);
    return rows.map((r) => {
        const count = Number(r["count"] ?? 0);
        const negativeCount = Number(r["negative_count"] ?? 0);
        return {
            topic: String(r["topic"] ?? ""),
            count,
            positiveCount: Number(r["positive_count"] ?? 0),
            negativeCount,
            neutralCount: Number(r["neutral_count"] ?? 0),
            negativeRatio: count > 0 ? Math.round((negativeCount / count) * 100) / 100 : 0,
        };
    });
}

/**
 * 舆情预警：负面占比高且讨论量达标的话题 = 潜在舆情风险
 * 阈值：讨论 ≥ 5 条且负面占比 ≥ 60%；按负面数降序
 */
export async function riskAlerts(limit = 10): Promise<TopicStatItem[]> {
    const all = await topicStats(100);
    return all
        .filter((t) => t.negativeCount >= 5 && t.negativeRatio >= 0.6)
        .sort((a, b) => b.negativeCount - a.negativeCount)
        .slice(0, limit);
}

// ===== 加权情感指数（热度加权，区别于简单计数）=====

export interface WeightedSentimentReport {
    weightedIndex: number; // -100 ~ 100，点赞×讨论热度加权
    simpleIndex: number; // -100 ~ 100，纯计数对比值
    weightedCommentCount: number;
    highLikeCount: number; // 点赞 >= 1000 的评论数（顶流信号）
    extremeNegativeHighLikeCount: number; // 点赞 >= 1000 且分数 <= -60（危机信号）
    weightedDist: Record<string, number>; // 按倾向的加权计数
}

/**
 * 加权情感指数：
 * 每条评论的权重 = (点赞数 + 1) × (1 + log(1 + 回复数))
 *   - 点赞数 + 1：保底权重 1，0 赞评论不归零
 *   - log(1 + 回复数)：楼中楼讨论热度，log 平滑避免热帖压倒性支配
 * 指数 = Σ(情感分数 × 权重) / Σ(权重)，映射到 -100~100
 * 对比 简单情感指数 = Σ(情感分数) / N（纯计数，导师指出的失真基准）
 */
export async function weightedSentimentIndex(): Promise<WeightedSentimentReport> {
    const rows = db.all<Record<string, unknown>>(sql`
        SELECT
            COALESCE(SUM(sentiment_analysis.sentiment_score * (comments.likes + 1) * (1 + log(1 + comments.replies))), 0) / NULLIF(SUM((comments.likes + 1) * (1 + log(1 + comments.replies))), 0) AS weighted_index,
            COALESCE(AVG(sentiment_analysis.sentiment_score), 0) AS simple_index,
            COUNT(*) AS total,
            SUM(CASE WHEN comments.likes >= 1000 THEN 1 ELSE 0 END) AS high_like,
            SUM(CASE WHEN comments.likes >= 1000 AND sentiment_analysis.sentiment_score <= -60 THEN 1 ELSE 0 END) AS extreme_negative_high_like,
            SUM(CASE WHEN sentiment_analysis.sentiment = '正面' THEN (comments.likes + 1) * (1 + log(1 + comments.replies)) ELSE 0 END) AS positive_weighted,
            SUM(CASE WHEN sentiment_analysis.sentiment = '负面' THEN (comments.likes + 1) * (1 + log(1 + comments.replies)) ELSE 0 END) AS negative_weighted,
            SUM(CASE WHEN sentiment_analysis.sentiment = '中性' THEN (comments.likes + 1) * (1 + log(1 + comments.replies)) ELSE 0 END) AS neutral_weighted
        FROM comments
        JOIN sentiment_analysis
          ON sentiment_analysis.source_id = comments.id
         AND sentiment_analysis.source_type = '评论'
        WHERE comments.is_deleted = false
    `);
    const r = rows[0] ?? {};
    const total = Number(r["total"] ?? 0);
    const positiveWeighted = Number(r["positive_weighted"] ?? 0);
    const negativeWeighted = Number(r["negative_weighted"] ?? 0);
    const neutralWeighted = Number(r["neutral_weighted"] ?? 0);
    const weightedIndex = Number(r["weighted_index"] ?? 0);
    const simpleIndex = Number(r["simple_index"] ?? 0);
    return {
        weightedIndex: Math.round(weightedIndex * 10) / 10,
        simpleIndex: Math.round(simpleIndex * 10) / 10,
        weightedCommentCount: total,
        highLikeCount: Number(r["high_like"] ?? 0),
        extremeNegativeHighLikeCount: Number(r["extreme_negative_high_like"] ?? 0),
        weightedDist: {
            正面: Math.round(positiveWeighted),
            负面: Math.round(negativeWeighted),
            中性: Math.round(neutralWeighted),
        },
    };
}
