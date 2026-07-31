import { and, count, desc, eq, isNull, like, sql } from "drizzle-orm";
import type { 动态摘要, 评论条目, 视频详情, 视频摘要 } from "../bili/types";
import type { 情感结果 } from "../llm/analyzer";
import { db } from "./index";
import { 采集日志, 动态, 监控任务, 评论, 情感分析, 视频, 视频统计, 系统配置, AI提供者 } from "./schema";

const 当前时间戳 = () => Math.floor(Date.now() / 1000);

// ===== 采集相关写入 =====

export async function 获取启用任务() {
    return db.select().from(监控任务).where(eq(监控任务.启用, true));
}

export async function 更新最后采集时间(任务ID: number): Promise<void> {
    await db
        .update(监控任务)
        .set({ 最后采集时间: 当前时间戳() })
        .where(eq(监控任务.任务ID, 任务ID));
}

export async function 保存视频(摘要: 视频摘要, 任务ID: number | null) {
    const 已有 = await db
        .select({ 视频ID: 视频.视频ID })
        .from(视频)
        .where(eq(视频.BV号, 摘要.bvid))
        .limit(1);
    if (已有.length > 0) {
        return { 视频ID: 已有[0].视频ID, 是否新增: false };
    }
    const [插入] = await db
        .insert(视频)
        .values({
            BV号: 摘要.bvid,
            AV号: 摘要.aid,
            标题: 摘要.标题,
            描述: 摘要.描述,
            UP主UID: 摘要.UP主UID,
            UP主名: 摘要.UP主名,
            发布时间: 摘要.发布时间,
            封面: 摘要.封面,
            来源任务ID: 任务ID,
            采集时间: 当前时间戳(),
        })
        .returning({ 视频ID: 视频.视频ID });
    return { 视频ID: 插入.视频ID, 是否新增: true };
}

export async function 保存视频统计(视频ID: number, 详情: 视频详情): Promise<void> {
    await db.insert(视频统计).values({
        视频ID,
        播放量: 详情.统计.播放量,
        弹幕数: 详情.统计.弹幕数,
        评论数: 详情.统计.评论数,
        收藏数: 详情.统计.收藏数,
        硬币数: 详情.统计.硬币数,
        分享数: 详情.统计.分享数,
        点赞数: 详情.统计.点赞数,
        记录时间: 当前时间戳(),
    });
}

export async function 保存评论(视频ID: number, 主评论: 评论条目[]): Promise<number> {
    const 采集时间 = 当前时间戳();
    const 行: (typeof 评论.$inferInsert)[] = [];
    for (const c of 主评论) {
        行.push({
            rpid: c.rpid,
            视频ID,
            根rpid: 0,
            上级rpid: 0,
            用户UID: c.mid,
            用户名: c.uname,
            内容: c.message,
            点赞数: c.like,
            回复数: c.rcount,
            发布时间: c.ctime,
            采集时间,
            是否楼中楼: false,
        });
        for (const r of c.replies ?? []) {
            行.push({
                rpid: r.rpid,
                视频ID,
                根rpid: c.rpid,
                上级rpid: r.parent,
                用户UID: r.mid,
                用户名: r.uname,
                内容: r.message,
                点赞数: r.like,
                回复数: r.rcount,
                发布时间: r.ctime,
                采集时间,
                是否楼中楼: true,
            });
        }
    }
    if (行.length === 0) return 0;
    await db.insert(评论).values(行).onConflictDoNothing({ target: 评论.rpid });
    return 行.length;
}

export async function 保存动态(UP主UID: number, 动态列表: 动态摘要[]): Promise<number> {
    if (动态列表.length === 0) return 0;
    const 采集时间 = 当前时间戳();
    const 行: (typeof 动态.$inferInsert)[] = 动态列表.map((d) => ({
        动态ID_str: d.动态ID,
        UP主UID,
        类型: d.类型,
        正文: d.正文,
        发布时间: d.发布时间,
        采集时间,
    }));
    await db.insert(动态).values(行).onConflictDoNothing({ target: 动态.动态ID_str });
    return 行.length;
}

export async function 保存情感(
    来源类型: "评论" | "动态",
    来源ID: number,
    结果: 情感结果,
    模型: string,
): Promise<void> {
    await db.insert(情感分析).values({
        来源类型,
        来源ID,
        情感倾向: 结果.情感倾向,
        情感分数: 结果.情感分数,
        关键词: 结果.关键词,
        摘要: 结果.摘要,
        模型,
        分析时间: 当前时间戳(),
    });
}

export async function 记录日志(
    任务ID: number | null,
    阶段: string,
    状态: "成功" | "失败" | "进行中",
    采集数量: number,
    耗时毫秒: number,
    错误信息: string | null,
): Promise<void> {
    await db.insert(采集日志).values({
        任务ID,
        阶段,
        状态,
        采集数量,
        耗时毫秒,
        错误信息,
        时间: 当前时间戳(),
    });
}

export async function 查未分析评论(批量: number) {
    return db
        .select({ 评论ID: 评论.评论ID, 内容: 评论.内容 })
        .from(评论)
        .leftJoin(
            情感分析,
            and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")),
        )
        .where(isNull(情感分析.分析ID))
        .limit(批量);
}

/** 查询尚未分析的评论总数（用于进度展示） */
export async function 查未分析评论总数(): Promise<number> {
    const [行] = await db
        .select({ 数: count() })
        .from(评论)
        .leftJoin(
            情感分析,
            and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")),
        )
        .where(isNull(情感分析.分析ID));
    return 行?.数 ?? 0;
}

// ===== API 查询 =====

export async function 列出任务() {
    return db.select().from(监控任务).orderBy(desc(监控任务.创建时间));
}

export async function 创建任务(类型: string, 目标: string) {
    if (类型 !== "up主" && 类型 !== "关键词") {
        throw new Error("任务类型必须为 up主 或 关键词");
    }
    const [行] = await db
        .insert(监控任务)
        .values({
            类型,
            目标: 目标.trim(),
            启用: true,
            创建时间: 当前时间戳(),
        })
        .returning();
    return 行;
}

export async function 删除任务(任务ID: number): Promise<void> {
    await db.delete(监控任务).where(eq(监控任务.任务ID, 任务ID));
}

export async function 更新任务(任务ID: number, 启用: boolean): Promise<void> {
    await db
        .update(监控任务)
        .set({ 启用 })
        .where(eq(监控任务.任务ID, 任务ID));
}

export async function 清空评论(): Promise<{ 评论: number; 情感分析: number }> {
    const 删除评论 = await db.delete(评论);
    const 删除情感 = await db.delete(情感分析).where(eq(情感分析.来源类型, "评论"));
    return {
        评论: 删除评论.changes ?? 0,
        情感分析: 删除情感.changes ?? 0,
    };
}

/** 仅删除评论类情感分析记录（用于重新分析） */
export async function 删除评论情感分析(): Promise<number> {
    const r = await db.delete(情感分析).where(eq(情感分析.来源类型, "评论"));
    return r.changes ?? 0;
}

export async function 视频评论数(视频ID: number): Promise<number> {
    const [行] = await db.select({ 数: count() }).from(评论).where(eq(评论.视频ID, 视频ID));
    return 行?.数 ?? 0;
}

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

/** 视频总数 */
export async function 视频计数(): Promise<number> {
    const [行] = await db.select({ 数: count() }).from(视频);
    return 行?.数 ?? 0;
}

/** 动态总数 */
export async function 动态计数(): Promise<number> {
    const [行] = await db.select({ 数: count() }).from(动态);
    return 行?.数 ?? 0;
}

/** 采集日志筛选参数 */
export interface 日志筛选 {
    阶段?: string;
    状态?: string;
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

/** 清空所有采集日志 */
export async function 清空日志(): Promise<number> {
    const 结果 = await db.delete(采集日志).returning({ 日志ID: 采集日志.日志ID });
    return 结果.length;
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

// ===== 系统配置（键值对，值列已加密）=====

const 配置缓存 = new Map<string, string>();

/** 读取单个配置项（已自动解密），缺省返回空串 */
export async function 读取配置项(键: string): Promise<string> {
    if (配置缓存.has(键)) return 配置缓存.get(键)!;
    const [行] = await db.select({ 值: 系统配置.值 }).from(系统配置).where(eq(系统配置.键, 键)).limit(1);
    const 值 = 行?.值 ?? "";
    配置缓存.set(键, 值);
    return 值;
}

/** 读取所有配置（已自动解密），返回键值对象 */
export async function 读取所有配置(): Promise<Record<string, string>> {
    const 行 = await db.select().from(系统配置);
    const 结果: Record<string, string> = {};
    配置缓存.clear();
    for (const r of 行) {
        结果[r.键] = r.值;
        配置缓存.set(r.键, r.值);
    }
    return 结果;
}

/** 写入单个配置项（值自动加密） */
export async function 写入配置(键: string, 值: string): Promise<void> {
    const 现在 = 当前时间戳();
    await db
        .insert(系统配置)
        .values({ 键, 值, 更新时间: 现在 })
        .onConflictDoUpdate({ target: 系统配置.键, set: { 值, 更新时间: 现在 } });
    配置缓存.set(键, 值);
}

/**
 * 批量写入配置；指定键的空串将被跳过（用于密钥字段"留空保留原值"语义）
 * @param 跳过空值键 这些键若传入空串则跳过不覆盖
 */
export async function 批量写入配置(项: Record<string, string>, 跳过空值键: string[] = []): Promise<void> {
    const 现在 = 当前时间戳();
    const 跳过集合 = new Set(跳过空值键);
    for (const [键, 值] of Object.entries(项)) {
        if (跳过集合.has(键) && 值 === "") continue;
        await db
            .insert(系统配置)
            .values({ 键, 值, 更新时间: 现在 })
            .onConflictDoUpdate({ target: 系统配置.键, set: { 值, 更新时间: 现在 } });
        配置缓存.set(键, 值);
    }
}

/** 清空配置缓存（写入后自动失效，此函数供调试用） */
export function 清空配置缓存(): void {
    配置缓存.clear();
}

// ===== AI 提供者管理（通用 LLM 服务商 CRUD）=====

export interface AI提供者行 {
    提供者ID: number;
    名称: string;
    提供商标识: string;
    API密钥: string;
    API地址: string;
    模型: string;
    温度: number;
    最大令牌: number | null;
    启用: boolean;
    是否默认: boolean;
    排序: number;
    创建时间: number;
}

export async function 列出AI提供者(): Promise<AI提供者行[]> {
    return db.select().from(AI提供者).orderBy(desc(AI提供者.排序), desc(AI提供者.创建时间));
}

export async function 获取默认AI提供者(): Promise<AI提供者行 | undefined> {
    const [行] = await db
        .select()
        .from(AI提供者)
        .where(and(eq(AI提供者.启用, true), eq(AI提供者.是否默认, true)))
        .limit(1);
    if (行) return 行;
    // 没有设定默认时，返回第一个启用的
    const [第一个] = await db
        .select()
        .from(AI提供者)
        .where(eq(AI提供者.启用, true))
        .limit(1);
    return 第一个;
}

export async function 创建AI提供者(数据: Omit<AI提供者行, "提供者ID" | "创建时间">) {
    const [行] = await db.insert(AI提供者).values({
        ...数据,
        创建时间: 当前时间戳(),
    }).returning();
    return 行;
}

export async function 更新AI提供者(提供者ID: number, 数据: Partial<Omit<AI提供者行, "提供者ID" | "创建时间">>) {
    await db.update(AI提供者).set(数据).where(eq(AI提供者.提供者ID, 提供者ID));
}

export async function 删除AI提供者(提供者ID: number) {
    await db.delete(AI提供者).where(eq(AI提供者.提供者ID, 提供者ID));
}

/** 设定默认提供者（先清除旧默认，再设置新默认） */
export async function 设定默认AI提供者(提供者ID: number) {
    await db.update(AI提供者).set({ 是否默认: false }).where(eq(AI提供者.是否默认, true));
    await db.update(AI提供者).set({ 是否默认: true }).where(eq(AI提供者.提供者ID, 提供者ID));
}
