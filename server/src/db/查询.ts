import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { 采集日志, 动态, 评论, 情感分析, 视频 } from "./schema";
import { 停用词列表 } from "./停用词";

// ===== 分页查询 =====

export async function 查询视频(页 = 1, 大小 = 20) {
    return db
        .select()
        .from(视频)
        .orderBy(desc(视频.发布时间))
        .limit(大小)
        .offset((页 - 1) * 大小);
}

export async function 查询评论(条件: {
    视频ID?: number | undefined;
    情感?: string | undefined;
    搜索?: string | undefined;
    已删除?: boolean | undefined;
    页: number;
    大小: number;
}) {
    const { 视频ID, 情感, 搜索, 已删除, 页, 大小 } = 条件;
    const 条件数组 = [];
    if (视频ID !== undefined) 条件数组.push(eq(评论.视频ID, 视频ID));
    if (情感) 条件数组.push(eq(情感分析.情感倾向, 情感));
    if (搜索) 条件数组.push(like(评论.内容, `%${搜索}%`));
    if (已删除 !== undefined) 条件数组.push(eq(评论.是否已删除, 已删除));
    const where = 条件数组.length > 0 ? and(...条件数组) : undefined;

    return db
        .select({
            评论ID: 评论.评论ID,
            rpid: 评论.rpid,
            视频ID: 评论.视频ID,
            视频标题: 视频.标题,
            BV号: 视频.BV号,
            用户UID: 评论.用户UID,
            用户名: 评论.用户名,
            内容: 评论.内容,
            点赞数: 评论.点赞数,
            回复数: 评论.回复数,
            发布时间: 评论.发布时间,
            是否楼中楼: 评论.是否楼中楼,
            是否已删除: 评论.是否已删除,
            删除时间: 评论.删除时间,
            情感倾向: 情感分析.情感倾向,
            情感分数: 情感分析.情感分数,
        })
        .from(评论)
        .leftJoin(视频, eq(视频.视频ID, 评论.视频ID))
        .leftJoin(
            情感分析,
            and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")),
        )
        .where(where ?? undefined)
        .orderBy(desc(评论.发布时间))
        .limit(大小)
        .offset((页 - 1) * 大小);
}

export async function 查询动态(页 = 1, 大小 = 20) {
    return db
        .select()
        .from(动态)
        .orderBy(desc(动态.发布时间))
        .limit(大小)
        .offset((页 - 1) * 大小);
}

/** 采集日志筛选参数 */
export interface 日志筛选 {
    阶段?: string | undefined;
    状态?: string | undefined;
}

/** 查询采集日志（支持筛选与分页） */
export async function 查询日志(页 = 1, 大小 = 20, 筛选?: 日志筛选) {
    const 条件: ReturnType<typeof sql>[] = [];
    if (筛选?.阶段) 条件.push(sql`${采集日志.阶段} = ${筛选.阶段}`);
    if (筛选?.状态) 条件.push(sql`${采集日志.状态} = ${筛选.状态}`);
    const 查询 = db.select().from(采集日志).$dynamic();
    if (条件.length > 0) 查询.where(sql.join(条件, " AND "));
    return 查询
        .orderBy(desc(采集日志.时间))
        .limit(大小)
        .offset((页 - 1) * 大小);
}

// ===== 计数 =====

/** 带筛选条件的评论总数（用于分页） */
export async function 评论计数(条件: {
    视频ID?: number | undefined;
    情感?: string | undefined;
    搜索?: string | undefined;
    已删除?: boolean | undefined;
}): Promise<number> {
    const { 视频ID, 情感, 搜索, 已删除 } = 条件;
    const 条件数组 = [];
    if (视频ID !== undefined) 条件数组.push(eq(评论.视频ID, 视频ID));
    if (搜索) 条件数组.push(like(评论.内容, `%${搜索}%`));
    if (已删除 !== undefined) 条件数组.push(eq(评论.是否已删除, 已删除));
    const where = 条件数组.length > 0 ? and(...条件数组) : undefined;
    const 查询 = db.select({ 数: count() }).from(评论);
    if (情感) {
        查询.leftJoin(情感分析, and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")))
            .where(where ? and(where, eq(情感分析.情感倾向, 情感)) : eq(情感分析.情感倾向, 情感));
    } else {
        if (where) 查询.where(where);
    }
    const [行] = await 查询;
    return 行?.数 ?? 0;
}

export async function 视频计数(): Promise<number> {
    const [行] = await db.select({ 数: count() }).from(视频);
    return 行?.数 ?? 0;
}

export async function 动态计数(): Promise<number> {
    const [行] = await db.select({ 数: count() }).from(动态);
    return 行?.数 ?? 0;
}

/** 采集日志总数（支持筛选） */
export async function 日志计数(筛选?: 日志筛选): Promise<number> {
    const 条件: ReturnType<typeof sql>[] = [];
    if (筛选?.阶段) 条件.push(sql`${采集日志.阶段} = ${筛选.阶段}`);
    if (筛选?.状态) 条件.push(sql`${采集日志.状态} = ${筛选.状态}`);
    const 查询 = 条件.length > 0
        ? db.select({ 数: count() }).from(采集日志).where(sql.join(条件, " AND "))
        : db.select({ 数: count() }).from(采集日志);
    const [行] = await 查询;
    return 行?.数 ?? 0;
}

/** 清空所有采集日志 */
export async function 清空日志(): Promise<number> {
    const 结果 = await db.delete(采集日志).returning({ 日志ID: 采集日志.日志ID });
    return 结果.length;
}

// ===== 统计 =====

/** 日志统计：按阶段和状态汇总（单次 groupBy 聚合，避免逐阶段 N+1 查询） */
export async function 日志统计(): Promise<{
    总计: number;
    成功数: number;
    失败数: number;
    进行中数: number;
    按阶段: { 阶段: string; 数: number; 成功: number; 失败: number }[];
}> {
    const [总计行] = await db.select({ 数: count() }).from(采集日志);
    const 分组行 = await db
        .select({ 阶段: 采集日志.阶段, 状态: 采集日志.状态, 数: count() })
        .from(采集日志)
        .groupBy(采集日志.阶段, 采集日志.状态);

    let 成功数 = 0;
    let 失败数 = 0;
    let 进行中数 = 0;
    const 按阶段映射 = new Map<string, { 阶段: string; 数: number; 成功: number; 失败: number }>();

    for (const r of 分组行) {
        if (r.状态 === "成功") 成功数 += r.数;
        else if (r.状态 === "失败") 失败数 += r.数;
        else if (r.状态 === "进行中") 进行中数 += r.数;
        const 项 = 按阶段映射.get(r.阶段) ?? { 阶段: r.阶段, 数: 0, 成功: 0, 失败: 0 };
        项.数 += r.数;
        if (r.状态 === "成功") 项.成功 += r.数;
        else if (r.状态 === "失败") 项.失败 += r.数;
        按阶段映射.set(r.阶段, 项);
    }

    return {
        总计: 总计行?.数 ?? 0,
        成功数,
        失败数,
        进行中数,
        按阶段: [...按阶段映射.values()].sort((a, b) => b.数 - a.数),
    };
}

export async function 统计概览() {
    const [视频行] = await db.select({ 数: count() }).from(视频);
    const [评论行] = await db.select({ 数: count() }).from(评论);
    const [动态行] = await db.select({ 数: count() }).from(动态);
    const [已删除行] = await db
        .select({ 数: count() })
        .from(评论)
        .where(eq(评论.是否已删除, true));
    const [已分析行] = await db
        .select({ 数: count() })
        .from(情感分析)
        .where(eq(情感分析.来源类型, "评论"));
    const 分布 = await db
        .select({ 倾向: 情感分析.情感倾向, 数: count() })
        .from(情感分析)
        .where(eq(情感分析.来源类型, "评论"))
        .groupBy(情感分析.情感倾向);

    const 情感分布: Record<string, number> = {};
    for (const r of 分布) {
        情感分布[r.倾向] = r.数;
    }
    return {
        视频总数: 视频行?.数 ?? 0,
        评论总数: 评论行?.数 ?? 0,
        动态总数: 动态行?.数 ?? 0,
        已删除评论: 已删除行?.数 ?? 0, // 墓碑机制：被删/封禁/精选过滤的评论数（舆情信号）
        已分析评论: 已分析行?.数 ?? 0,
        情感分布,
    };
}

export async function 情感分布() {
    return db
        .select({ 倾向: 情感分析.情感倾向, 数: count() })
        .from(情感分析)
        .where(eq(情感分析.来源类型, "评论"))
        .groupBy(情感分析.情感倾向);
}

export async function 情感趋势(天数 = 7) {
    const 日期表达式 = sql`date(${评论.发布时间}, 'unixepoch', 'localtime')`;
    return db
        .select({
            日期: sql<string>`date(${评论.发布时间}, 'unixepoch', 'localtime')`.as("日期"),
            评论数: count(),
            平均分数: sql<number>`coalesce(round(avg(${情感分析.情感分数}), 1), 0)`,
        })
        .from(评论)
        .leftJoin(
            情感分析,
            and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")),
        )
        .groupBy(日期表达式)
        .orderBy(desc(日期表达式))
        .limit(天数);
}

// ===== 舆论分析（话题维度）=====

export interface 话题统计项 {
    话题: string;
    数: number;
    正面数: number;
    负面数: number;
    中性数: number;
    负面占比: number; // 0~1
}

/**
 * 热门话题统计：展开情感分析.关键词（json 数组），按话题聚合频率与正负分布
 * 噪音过滤：停用词表 + 单字 + 纯数字/符号 + 长句（见 停用词.ts）
 * 这是"舆论分析"区别于"情感分析"的核心——回答"大家在讨论什么"
 */
export async function 话题统计(限制 = 20): Promise<话题统计项[]> {
    // 停用词是代码内常量（无用户输入），转义后内联拼入，避免运行时参数传递
    const 停用词SQL = 停用词列表.map((w) => `'${w.replace(/'/g, "''")}'`).join(",");
    const 行 = db.all<Record<string, unknown>>(sql`
        SELECT
            k.value AS 话题,
            COUNT(*) AS 数,
            SUM(CASE WHEN 情感分析.情感倾向 = '正面' THEN 1 ELSE 0 END) AS 正面数,
            SUM(CASE WHEN 情感分析.情感倾向 = '负面' THEN 1 ELSE 0 END) AS 负面数,
            SUM(CASE WHEN 情感分析.情感倾向 = '中性' THEN 1 ELSE 0 END) AS 中性数
        FROM 情感分析
        JOIN json_each(情感分析.关键词) AS k
        WHERE 情感分析.来源类型 = '评论'
          AND length(k.value) > 1                 -- 过滤单字
          AND length(k.value) <= 20               -- 过滤长句摘要
          AND k.value NOT GLOB '*[0-9]*'          -- 过滤含数字
          AND k.value NOT IN (${sql.raw(停用词SQL)})
        GROUP BY k.value
        ORDER BY 数 DESC
        LIMIT ${限制}
    `);
    return 行.map((r) => {
        const 数 = Number(r["数"] ?? 0);
        const 负面数 = Number(r["负面数"] ?? 0);
        return {
            话题: String(r["话题"] ?? ""),
            数,
            正面数: Number(r["正面数"] ?? 0),
            负面数,
            中性数: Number(r["中性数"] ?? 0),
            负面占比: 数 > 0 ? Math.round((负面数 / 数) * 100) / 100 : 0,
        };
    });
}

/**
 * 舆情预警：负面占比高且讨论量达标的话题 = 潜在舆情风险
 * 阈值：讨论 ≥ 5 条且负面占比 ≥ 60%；按负面数降序
 */
export async function 舆情预警(限制 = 10): Promise<话题统计项[]> {
    const 全部 = await 话题统计(100);
    return 全部
        .filter((t) => t.负面数 >= 5 && t.负面占比 >= 0.6)
        .sort((a, b) => b.负面数 - a.负面数)
        .slice(0, 限制);
}

// ===== 加权情感指数（热度加权，区别于简单计数）=====

export interface 加权情感报告 {
    加权情感指数: number; // -100 ~ 100，点赞×讨论热度加权
    简单情感指数: number; // -100 ~ 100，纯计数对比值
    参与加权评论数: number;
    高赞评论数: number; // 点赞 >= 1000 的评论数（顶流信号）
    极端负面高赞数: number; // 点赞 >= 1000 且分数 <= -60（危机信号）
    加权分布: Record<string, number>; // 按倾向的加权计数
}

/**
 * 加权情感指数：
 * 每条评论的权重 = (点赞数 + 1) × (1 + log(1 + 回复数))
 *   - 点赞数 + 1：保底权重 1，0 赞评论不归零
 *   - log(1 + 回复数)：楼中楼讨论热度，log 平滑避免热帖压倒性支配
 * 指数 = Σ(情感分数 × 权重) / Σ(权重)，映射到 -100~100
 * 对比 简单情感指数 = Σ(情感分数) / N（纯计数，导师指出的失真基准）
 */
export async function 加权情感指数(): Promise<加权情感报告> {
    const 行 = db.all<Record<string, unknown>>(sql`
        SELECT
            COALESCE(SUM(情感分析.情感分数 * (评论.点赞数 + 1) * (1 + log(1 + 评论.回复数))), 0) / NULLIF(SUM((评论.点赞数 + 1) * (1 + log(1 + 评论.回复数))), 0) AS 加权指数,
            COALESCE(AVG(情感分析.情感分数), 0) AS 简单指数,
            COUNT(*) AS 总数,
            SUM(CASE WHEN 评论.点赞数 >= 1000 THEN 1 ELSE 0 END) AS 高赞数,
            SUM(CASE WHEN 评论.点赞数 >= 1000 AND 情感分析.情感分数 <= -60 THEN 1 ELSE 0 END) AS 极端负面高赞,
            SUM(CASE WHEN 情感分析.情感倾向 = '正面' THEN (评论.点赞数 + 1) * (1 + log(1 + 评论.回复数)) ELSE 0 END) AS 正面加权,
            SUM(CASE WHEN 情感分析.情感倾向 = '负面' THEN (评论.点赞数 + 1) * (1 + log(1 + 评论.回复数)) ELSE 0 END) AS 负面加权,
            SUM(CASE WHEN 情感分析.情感倾向 = '中性' THEN (评论.点赞数 + 1) * (1 + log(1 + 评论.回复数)) ELSE 0 END) AS 中性加权
        FROM 评论
        JOIN 情感分析
          ON 情感分析.来源ID = 评论.评论ID
         AND 情感分析.来源类型 = '评论'
        WHERE 评论.是否已删除 = false
    `);
    const r = 行[0] ?? {};
    const 总数 = Number(r["总数"] ?? 0);
    const 正面加权 = Number(r["正面加权"] ?? 0);
    const 负面加权 = Number(r["负面加权"] ?? 0);
    const 中性加权 = Number(r["中性加权"] ?? 0);
    const 权重和 = 正面加权 + 负面加权 + 中性加权;
    const 加权指数 = Number(r["加权指数"] ?? 0);
    const 简单指数 = Number(r["简单指数"] ?? 0);
    return {
        加权情感指数: Math.round(加权指数 * 10) / 10,
        简单情感指数: Math.round(简单指数 * 10) / 10,
        参与加权评论数: 总数,
        高赞评论数: Number(r["高赞数"] ?? 0),
        极端负面高赞数: Number(r["极端负面高赞"] ?? 0),
        加权分布: {
            正面: Math.round(正面加权),
            负面: Math.round(负面加权),
            中性: Math.round(中性加权),
        },
    };
}
