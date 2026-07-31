import { and, count, eq, isNull } from "drizzle-orm";
import type { 动态摘要, 评论条目, 视频详情, 视频摘要 } from "../bili/types";
import type { 情感结果 } from "../llm/analyzer";
import { db } from "./index";
import { 采集日志, 动态, 监控任务, 评论, 情感分析, 视频, 视频统计 } from "./schema";

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
