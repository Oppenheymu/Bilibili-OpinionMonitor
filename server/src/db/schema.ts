import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { encryptedText } from "./encrypted";

/**
 * 监控任务：记录要监控的 UP 主或关键词
 */
export const monitorTasks = sqliteTable("monitor_tasks", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(), // "up主" | "关键词"
    target: text("target").notNull(), // UP 主 uid 字符串 或 关键词文本
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    lastCollectedAt: integer("last_collected_at"),
});

/**
 * 视频：采集到的视频元信息
 */
export const videos = sqliteTable("videos", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bvid: text("bvid").notNull().unique(),
    aid: integer("aid").notNull(),
    title: text("title").notNull(),
    description: text("description").default(""),
    upUid: integer("up_uid").notNull(),
    upName: text("up_name").notNull(),
    partitionId: integer("partition_id").default(0),
    partitionName: text("partition_name").default(""),
    publishTime: integer("publish_time"),
    duration: integer("duration").default(0),
    cover: text("cover").default(""),
    subtitle: text("subtitle").default(""), // B站 AI 字幕转纯文本（视频上下文，供情感分析参考）
    sourceTaskId: integer("source_task_id").references(() => monitorTasks.id),
    collectedAt: integer("collected_at").notNull(),
});

/**
 * 视频统计快照：记录每次采集时的指标，用于观察趋势
 */
export const videoStats = sqliteTable(
    "video_stats",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        videoId: integer("video_id")
            .notNull()
            .references(() => videos.id),
        views: integer("views").default(0),
        danmaku: integer("danmaku").default(0),
        comments: integer("comments").default(0),
        favorites: integer("favorites").default(0),
        coins: integer("coins").default(0),
        shares: integer("shares").default(0),
        likes: integer("likes").default(0),
        recordedAt: integer("recorded_at").notNull(),
    },
    (table) => ({
        videoTimeIndex: index("video_stats_video_id_recorded_at").on(
            table.videoId,
            table.recordedAt,
        ),
    }),
);

/**
 * 评论：含楼中楼，通过 根rpid 关联
 * 墓碑机制：评论可能被 UP 主删除 / 平台封禁 / 精选过滤，接口不再返回。
 * 通过「是否已删除」标记保留历史事实（情感分析记录不可丢——被删本身是舆情信号）。
 */
export const comments = sqliteTable(
    "comments",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        rpid: integer("rpid").notNull().unique(),
        videoId: integer("video_id")
            .notNull()
            .references(() => videos.id),
        rootRpid: integer("root_rpid").default(0), // 0 表示主评论，否则为楼中楼根评论 rpid
        parentRpid: integer("parent_rpid").default(0),
        userUid: integer("user_uid").notNull(),
        username: text("username").notNull(),
        content: text("content").notNull(),
        likes: integer("likes").default(0),
        replies: integer("replies").default(0),
        publishTime: integer("publish_time").notNull(),
        collectedAt: integer("collected_at").notNull(),
        isReply: integer("is_reply", { mode: "boolean" }).notNull().default(false),
        isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false), // 墓碑标记
        deletedAt: integer("deleted_at"), // 检测到删除的时间戳
        updatedAt: integer("updated_at"), // 点赞/回复数最后更新（热度追踪）
    },
    (table) => ({
        videoIndex: index("comments_video_id").on(table.videoId),
        rootReplyIndex: index("comments_root_rpid").on(table.rootRpid),
        deletedIndex: index("comments_is_deleted").on(table.isDeleted),
    }),
);

/**
 * 动态：UP 主发布的动态正文
 */
export const dynamics = sqliteTable("dynamics", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dynamicId: text("dynamic_id").notNull().unique(),
    upUid: integer("up_uid").notNull(),
    type: text("type").notNull(), // DYNAMIC_TYPE_WORD / DYNAMIC_TYPE_AV / ...
    content: text("content").default(""),
    rawData: text("raw_data", { mode: "json" }),
    publishTime: integer("publish_time"),
    collectedAt: integer("collected_at").notNull(),
});

/**
 * 情感分析：LLM 对评论/动态的分析结果
 */
export const sentimentAnalysis = sqliteTable(
    "sentiment_analysis",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        sourceType: text("source_type").notNull(), // "评论" | "动态"
        sourceId: integer("source_id").notNull(),
        sentiment: text("sentiment").notNull(), // "正面" | "负面" | "中性"
        sentimentScore: integer("sentiment_score").default(0), // -100 ~ 100 的整数，避免浮点存储
        keywords: text("keywords", { mode: "json" }).$type<string[]>(),
        summary: text("summary").default(""),
        model: text("model").notNull(),
        analyzedAt: integer("analyzed_at").notNull(),
    },
    (table) => ({
        // 复合索引：评论查询/未分析查询/情感统计均按 (来源类型, 来源ID) 关联，避免全表扫描
        sourceIndex: index("sentiment_analysis_source_type_source_id").on(
            table.sourceType,
            table.sourceId,
        ),
        sentimentIndex: index("sentiment_analysis_source_type_sentiment").on(
            table.sourceType,
            table.sentiment,
        ),
    }),
);

/**
 * 采集日志：记录每次采集的执行情况
 */
export const collectionLogs = sqliteTable("collection_logs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").references(() => monitorTasks.id),
    stage: text("stage").notNull(), // 如 "采集评论" / "采集动态"
    status: text("status").notNull(), // "成功" | "失败" | "进行中"
    collectedCount: integer("collected_count").default(0),
    durationMs: integer("duration_ms").default(0),
    errorMessage: text("error_message"),
    createdAt: integer("created_at").notNull(),
});

/**
 * 系统配置：键值对存储（值列加密，承载 LLM 配置与采集参数）
 */
export const systemConfig = sqliteTable("system_config", {
    key: text("key").primaryKey(),
    value: encryptedText("value").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
});

/**
 * AI 提供者：通用 LLM 服务商配置，支持任意 OpenAI 兼容接口
 * 每条记录代表一个可用的 AI 服务，前端可动态增删
 */
export const aiProviders = sqliteTable("ai_providers", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(), // 用户自定义名称，如 "我的DeepSeek"
    providerKey: text("provider_key").notNull(), // "deepseek" | "gemini" | "openai" | "custom"
    apiKey: encryptedText("api_key").notNull().default(""),
    apiBaseUrl: text("api_base_url").notNull().default(""), // OpenAI 兼容 base URL
    model: text("model").notNull().default(""),
    systemPrompt: text("system_prompt"), // 情感分析 system prompt（可空，回退内置默认）
    temperature: integer("temperature").notNull().default(20), // 存整数 0-100，实际 /100
    maxTokens: integer("max_tokens").default(4096),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
});

// 静默引用 sql，保留以便未来默认值使用 now()
void sql;
