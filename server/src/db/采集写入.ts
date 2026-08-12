import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { 动态摘要, 视频摘要, 视频详情, 评论条目 } from "../bili/types";
import type { 情感结果 } from "../llm/analyzer";
import { db } from "./index";
import { 动态, 情感分析, 监控任务, 视频, 视频统计, 评论, 采集日志 } from "./schema";

const 当前时间戳 = () => Math.floor(Date.now() / 1000);

// ===== 任务 =====

export async function 获取启用任务() {
    return db.select().from(监控任务).where(eq(监控任务.启用, true));
}

export async function 更新最后采集时间(任务ID: number): Promise<void> {
    await db
        .update(监控任务)
        .set({ 最后采集时间: 当前时间戳() })
        .where(eq(监控任务.任务ID, 任务ID));
}

// ===== 采集内容写入 =====

/**
 * 批量保存视频（消除 N+1：每任务 1 次 in 查询 + 1 次批量插入，替代逐条 select+insert）
 * 已存在的 BV 号自动跳过（onConflictDoNothing，兼顾跨任务重复采集）
 * @returns BV号 → 视频ID 映射（含已存在的）
 */
export async function 批量保存视频(
    摘要列表: 视频摘要[],
    任务ID: number | null,
): Promise<Map<string, number>> {
    if (摘要列表.length === 0) return new Map();
    const BV集合 = 摘要列表.map((v) => v.bvid);
    // 一次查清已存在的视频
    const 已有行 = await db
        .select({ BV号: 视频.BV号, 视频ID: 视频.视频ID })
        .from(视频)
        .where(inArray(视频.BV号, BV集合));
    const 结果 = new Map(已有行.map((r) => [r.BV号, r.视频ID]));

    // 只插入新视频（一条语句批量插入）
    const 新列表 = 摘要列表.filter((v) => !结果.has(v.bvid));
    if (新列表.length > 0) {
        const 采集时间 = 当前时间戳();
        const 插入 = await db
            .insert(视频)
            .values(
                新列表.map((v) => ({
                    BV号: v.bvid,
                    AV号: v.aid,
                    标题: v.标题,
                    描述: v.描述,
                    UP主UID: v.UP主UID,
                    UP主名: v.UP主名,
                    发布时间: v.发布时间,
                    封面: v.封面,
                    来源任务ID: 任务ID,
                    采集时间,
                })),
            )
            .onConflictDoNothing({ target: 视频.BV号 })
            .returning({ BV号: 视频.BV号, 视频ID: 视频.视频ID });
        for (const r of 插入) 结果.set(r.BV号, r.视频ID);
    }
    return 结果;
}

export async function 保存视频统计(视频ID: number, 详情: 视频详情): Promise<void> {
    // 同步 AI 字幕（视频内容上下文，供情感分析参考）
    if (详情.字幕) {
        await db.update(视频).set({ 字幕: 详情.字幕 }).where(eq(视频.视频ID, 视频ID));
    }
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

/**
 * 增量保存评论（UPSERT）：新评论插入，已存在的更新点赞/回复数与最后更新时间
 * 支持热度追踪（热评升降）与删除检测（重新出现的评论清除墓碑标记）
 * @returns 新增评论数
 */
export async function 增量保存评论(视频ID: number, 主评论: 评论条目[]): Promise<number> {
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
    // upsert 前统计该视频已有评论数（用于计算新增数）
    const [前数] = await db.select({ 数: count() }).from(评论).where(eq(评论.视频ID, 视频ID));
    // UPSERT：新评论插入；已存在则更新点赞/回复数 + 最后更新时间 + 清除删除标记（复活）
    await db
        .insert(评论)
        .values(行)
        .onConflictDoUpdate({
            target: 评论.rpid,
            set: {
                点赞数: sql`excluded.点赞数`,
                回复数: sql`excluded.回复数`,
                最后更新时间: 采集时间,
                是否已删除: false,
                删除时间: null,
            },
        });
    const [后数] = await db.select({ 数: count() }).from(评论).where(eq(评论.视频ID, 视频ID));
    return Math.max(0, (后数?.数 ?? 0) - (前数?.数 ?? 0));
}

/**
 * 标记已删除评论（墓碑机制核心）
 * 对「完整采集」的视频：本次接口返回的 rpid 集合 vs 库中已有主评论 rpid 集合，
 * 差集 = 已被删除/封禁/精选过滤的评论 → 标记 是否已删除 + 删除时间
 * @param 完整采集 该视频本次是否完整拉取（未截断），只有完整快照才能做删除检测，
 *                  否则漏采的评论会被误判为"已删除"
 */
export async function 标记已删除评论(
    视频ID: number,
    本次rpid集合: number[],
    完整采集: boolean,
): Promise<number> {
    if (!完整采集 || 本次rpid集合.length === 0) return 0;
    const 采集时间 = 当前时间戳();
    // 该视频所有未被标记删除的主评论 rpid（根rpid=0 且非楼中楼）
    const 库中行 = await db
        .select({ rpid: 评论.rpid })
        .from(评论)
        .where(
            and(eq(评论.视频ID, 视频ID), eq(评论.是否楼中楼, false), eq(评论.是否已删除, false)),
        );
    const 库中集合 = new Set(库中行.map((r) => r.rpid));
    const 本次集合 = new Set(本次rpid集合);
    const 已删rpid = [...库中集合].filter((r) => !本次集合.has(r));
    if (已删rpid.length === 0) return 0;
    await db
        .update(评论)
        .set({ 是否已删除: true, 删除时间: 采集时间, 最后更新时间: 采集时间 })
        .where(
            and(eq(评论.视频ID, 视频ID), eq(评论.是否已删除, false), inArray(评论.rpid, 已删rpid)),
        );
    console.log(`[采集] 视频 ${视频ID} 检测到 ${已删rpid.length} 条评论被删除/隐藏`);
    return 已删rpid.length;
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

/**
 * 批量保存情感结果（一次插入多条，避免逐条 insert）
 * 用于批量分析：一批 20 条评论只发 1 条 SQL
 */
export async function 批量保存情感(
    来源类型: "评论" | "动态",
    项: { 来源ID: number; 结果: 情感结果 }[],
    模型: string,
): Promise<void> {
    if (项.length === 0) return;
    const 分析时间 = 当前时间戳();
    await db.insert(情感分析).values(
        项.map(({ 来源ID, 结果 }) => ({
            来源类型,
            来源ID,
            情感倾向: 结果.情感倾向,
            情感分数: 结果.情感分数,
            关键词: 结果.关键词,
            摘要: 结果.摘要,
            模型,
            分析时间,
        })),
    );
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

/**
 * 查询每个视频最近一次评论采集时间（秒时间戳）
 * 用于评论增量采集的间隔判断：刚采集过的视频跳过，避免每次全量拉取触发 B站风控
 */
export async function 视频最近评论采集时间(): Promise<Map<number, number>> {
    const 行 = await db
        .select({ 视频ID: 评论.视频ID, 最新采集: sql<number>`max(${评论.采集时间})` })
        .from(评论)
        .groupBy(评论.视频ID);
    return new Map(行.map((r) => [r.视频ID, r.最新采集]));
}

/**
 * 查询未分析评论（按"影响力"降序：点赞数为主、楼中楼讨论热度为辅）
 * 预算有限时优先分析高影响力评论，保证采样代表性
 * 附带所属视频上下文（标题/描述/分区/字幕），供 LLM 结合视频内容判断情感
 */
export async function 查未分析评论(批量: number) {
    return db
        .select({
            评论ID: 评论.评论ID,
            内容: 评论.内容,
            点赞数: 评论.点赞数,
            回复数: 评论.回复数,
            视频标题: 视频.标题,
            视频描述: 视频.描述,
            分区名: 视频.分区名,
            字幕: 视频.字幕,
        })
        .from(评论)
        .leftJoin(视频, eq(评论.视频ID, 视频.视频ID))
        .leftJoin(情感分析, and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")))
        .where(isNull(情感分析.分析ID))
        .orderBy(desc(评论.点赞数), desc(评论.回复数))
        .limit(批量);
}

/** 查询尚未分析的评论总数（用于进度展示） */
export async function 查未分析评论总数(): Promise<number> {
    const [行] = await db
        .select({ 数: count() })
        .from(评论)
        .leftJoin(情感分析, and(eq(情感分析.来源ID, 评论.评论ID), eq(情感分析.来源类型, "评论")))
        .where(isNull(情感分析.分析ID));
    return 行?.数 ?? 0;
}
