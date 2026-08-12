import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { encryptedText } from "./encrypted";

/**
 * 监控任务：记录要监控的 UP 主或关键词
 */
export const 监控任务 = sqliteTable("监控任务", {
    任务ID: integer("任务ID").primaryKey({ autoIncrement: true }),
    类型: text("类型").notNull(), // "up主" | "关键词"
    目标: text("目标").notNull(), // UP 主 uid 字符串 或 关键词文本
    启用: integer("启用", { mode: "boolean" }).notNull().default(true),
    创建时间: integer("创建时间").notNull(),
    最后采集时间: integer("最后采集时间"),
});

/**
 * 视频：采集到的视频元信息
 */
export const 视频 = sqliteTable("视频", {
    视频ID: integer("视频ID").primaryKey({ autoIncrement: true }),
    BV号: text("BV号").notNull().unique(),
    AV号: integer("AV号").notNull(),
    标题: text("标题").notNull(),
    描述: text("描述").default(""),
    UP主UID: integer("UP主UID").notNull(),
    UP主名: text("UP主名").notNull(),
    分区ID: integer("分区ID").default(0),
    分区名: text("分区名").default(""),
    发布时间: integer("发布时间"),
    时长: integer("时长").default(0),
    封面: text("封面").default(""),
    字幕: text("字幕").default(""), // B站 AI 字幕转纯文本（视频上下文，供情感分析参考）
    来源任务ID: integer("来源任务ID").references(() => 监控任务.任务ID),
    采集时间: integer("采集时间").notNull(),
});

/**
 * 视频统计快照：记录每次采集时的指标，用于观察趋势
 */
export const 视频统计 = sqliteTable(
    "视频统计",
    {
        记录ID: integer("记录ID").primaryKey({ autoIncrement: true }),
        视频ID: integer("视频ID")
            .notNull()
            .references(() => 视频.视频ID),
        播放量: integer("播放量").default(0),
        弹幕数: integer("弹幕数").default(0),
        评论数: integer("评论数").default(0),
        收藏数: integer("收藏数").default(0),
        硬币数: integer("硬币数").default(0),
        分享数: integer("分享数").default(0),
        点赞数: integer("点赞数").default(0),
        记录时间: integer("记录时间").notNull(),
    },
    (表) => ({
        视频时间索引: index("视频统计_视频ID_记录时间").on(表.视频ID, 表.记录时间),
    }),
);

/**
 * 评论：含楼中楼，通过 根rpid 关联
 * 墓碑机制：评论可能被 UP 主删除 / 平台封禁 / 精选过滤，接口不再返回。
 * 通过「是否已删除」标记保留历史事实（情感分析记录不可丢——被删本身是舆情信号）。
 */
export const 评论 = sqliteTable(
    "评论",
    {
        评论ID: integer("评论ID").primaryKey({ autoIncrement: true }),
        rpid: integer("rpid").notNull().unique(),
        视频ID: integer("视频ID")
            .notNull()
            .references(() => 视频.视频ID),
        根rpid: integer("根rpid").default(0), // 0 表示主评论，否则为楼中楼根评论 rpid
        上级rpid: integer("上级rpid").default(0),
        用户UID: integer("用户UID").notNull(),
        用户名: text("用户名").notNull(),
        内容: text("内容").notNull(),
        点赞数: integer("点赞数").default(0),
        回复数: integer("回复数").default(0),
        发布时间: integer("发布时间").notNull(),
        采集时间: integer("采集时间").notNull(),
        是否楼中楼: integer("是否楼中楼", { mode: "boolean" }).notNull().default(false),
        是否已删除: integer("是否已删除", { mode: "boolean" }).notNull().default(false), // 墓碑标记
        删除时间: integer("删除时间"), // 检测到删除的时间戳
        最后更新时间: integer("最后更新时间"), // 点赞/回复数最后更新（热度追踪）
    },
    (表) => ({
        视频索引: index("评论_视频ID").on(表.视频ID),
        根评论索引: index("评论_根rpid").on(表.根rpid),
        删除标记索引: index("评论_是否已删除").on(表.是否已删除),
    }),
);

/**
 * 动态：UP 主发布的动态正文
 */
export const 动态 = sqliteTable("动态", {
    动态ID: integer("动态ID").primaryKey({ autoIncrement: true }),
    动态ID_str: text("动态ID_str").notNull().unique(),
    UP主UID: integer("UP主UID").notNull(),
    类型: text("类型").notNull(), // DYNAMIC_TYPE_WORD / DYNAMIC_TYPE_AV / ...
    正文: text("正文").default(""),
    原始数据: text("原始数据", { mode: "json" }),
    发布时间: integer("发布时间"),
    采集时间: integer("采集时间").notNull(),
});

/**
 * 情感分析：LLM 对评论/动态的分析结果
 */
export const 情感分析 = sqliteTable(
    "情感分析",
    {
        分析ID: integer("分析ID").primaryKey({ autoIncrement: true }),
        来源类型: text("来源类型").notNull(), // "评论" | "动态"
        来源ID: integer("来源ID").notNull(),
        情感倾向: text("情感倾向").notNull(), // "正面" | "负面" | "中性"
        情感分数: integer("情感分数").default(0), // -100 ~ 100 的整数，避免浮点存储
        关键词: text("关键词", { mode: "json" }).$type<string[]>(),
        摘要: text("摘要").default(""),
        模型: text("模型").notNull(),
        分析时间: integer("分析时间").notNull(),
    },
    (表) => ({
        // 复合索引：评论查询/未分析查询/情感统计均按 (来源类型, 来源ID) 关联，避免全表扫描
        来源索引: index("情感分析_来源类型_来源ID").on(表.来源类型, 表.来源ID),
        倾向索引: index("情感分析_来源类型_倾向").on(表.来源类型, 表.情感倾向),
    }),
);

/**
 * 采集日志：记录每次采集的执行情况
 */
export const 采集日志 = sqliteTable("采集日志", {
    日志ID: integer("日志ID").primaryKey({ autoIncrement: true }),
    任务ID: integer("任务ID").references(() => 监控任务.任务ID),
    阶段: text("阶段").notNull(), // 如 "采集评论" / "采集动态"
    状态: text("状态").notNull(), // "成功" | "失败" | "进行中"
    采集数量: integer("采集数量").default(0),
    耗时毫秒: integer("耗时毫秒").default(0),
    错误信息: text("错误信息"),
    时间: integer("时间").notNull(),
});

/**
 * 系统配置：键值对存储（值列加密，承载 LLM 配置与采集参数）
 */
export const 系统配置 = sqliteTable("系统配置", {
    键: text("键").primaryKey(),
    值: encryptedText("值").notNull().default(""),
    更新时间: integer("更新时间").notNull(),
});

/**
 * AI 提供者：通用 LLM 服务商配置，支持任意 OpenAI 兼容接口
 * 每条记录代表一个可用的 AI 服务，前端可动态增删
 */
export const AI提供者 = sqliteTable("AI提供者", {
    提供者ID: integer("提供者ID").primaryKey({ autoIncrement: true }),
    名称: text("名称").notNull(), // 用户自定义名称，如 "我的DeepSeek"
    提供商标识: text("提供商标识").notNull(), // "deepseek" | "gemini" | "openai" | "custom"
    API密钥: encryptedText("API密钥").notNull().default(""),
    API地址: text("API地址").notNull().default(""), // OpenAI 兼容 base URL
    模型: text("模型").notNull().default(""),
    系统提示词: text("系统提示词"), // 情感分析 system prompt（可空，回退内置默认）
    温度: integer("温度").notNull().default(20), // 存整数 0-100，实际 /100
    最大令牌: integer("最大令牌").default(4096),
    启用: integer("启用", { mode: "boolean" }).notNull().default(true),
    是否默认: integer("是否默认", { mode: "boolean" }).notNull().default(false),
    排序: integer("排序").notNull().default(0),
    创建时间: integer("创建时间").notNull(),
});

// 静默引用 sql，保留以便未来默认值使用 now()
void sql;
