import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { 采集日志, 动态, 评论, 情感分析, 视频 } from "./schema";

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
    页: number;
    大小: number;
}) {
    const { 视频ID, 情感, 搜索, 页, 大小 } = 条件;
    const 条件数组 = [];
    if (视频ID !== undefined) 条件数组.push(eq(评论.视频ID, 视频ID));
    if (情感) 条件数组.push(eq(情感分析.情感倾向, 情感));
    if (搜索) 条件数组.push(like(评论.内容, `%${搜索}%`));
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
}): Promise<number> {
    const { 视频ID, 情感, 搜索 } = 条件;
    const 条件数组 = [];
    if (视频ID !== undefined) 条件数组.push(eq(评论.视频ID, 视频ID));
    if (搜索) 条件数组.push(like(评论.内容, `%${搜索}%`));
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

/** 日志统计：按阶段和状态汇总 */
export async function 日志统计(): Promise<{
    总计: number;
    成功数: number;
    失败数: number;
    进行中数: number;
    按阶段: { 阶段: string; 数: number; 成功: number; 失败: number }[];
}> {
    const [总计行] = await db.select({ 数: count() }).from(采集日志);
    const [成功行] = await db.select({ 数: count() }).from(采集日志).where(eq(采集日志.状态, "成功"));
    const [失败行] = await db.select({ 数: count() }).from(采集日志).where(eq(采集日志.状态, "失败"));
    const [进行中行] = await db.select({ 数: count() }).from(采集日志).where(eq(采集日志.状态, "进行中"));
    const 按阶段行 = await db
        .select({
            阶段: 采集日志.阶段,
            数: count(),
        })
        .from(采集日志)
        .groupBy(采集日志.阶段);

    // 逐阶段查成功/失败数
    const 按阶段 = await Promise.all(
        按阶段行.map(async (p) => {
            const [成功] = await db
                .select({ 数: count() })
                .from(采集日志)
                .where(and(eq(采集日志.阶段, p.阶段), eq(采集日志.状态, "成功")));
            const [失败] = await db
                .select({ 数: count() })
                .from(采集日志)
                .where(and(eq(采集日志.阶段, p.阶段), eq(采集日志.状态, "失败")));
            return { 阶段: p.阶段, 数: p.数, 成功: 成功?.数 ?? 0, 失败: 失败?.数 ?? 0 };
        }),
    );
    return {
        总计: 总计行?.数 ?? 0,
        成功数: 成功行?.数 ?? 0,
        失败数: 失败行?.数 ?? 0,
        进行中数: 进行中行?.数 ?? 0,
        按阶段,
    };
}

export async function 统计概览() {
    const [视频行] = await db.select({ 数: count() }).from(视频);
    const [评论行] = await db.select({ 数: count() }).from(评论);
    const [动态行] = await db.select({ 数: count() }).from(动态);
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
        视频总数: 视频行.数,
        评论总数: 评论行.数,
        动态总数: 动态行.数,
        已分析评论: 已分析行.数,
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
