import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { 采集日志, 监控任务, 评论, 情感分析, 视频 } from "./schema";

const 当前时间戳 = () => Math.floor(Date.now() / 1000);

// ===== 任务 CRUD =====

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

/**
 * 删除任务：先解除关联引用，再删除
 * 数据库已启用外键约束（PRAGMA foreign_keys=ON），直接删任务会因
 * 视频.来源任务ID / 采集日志.任务ID 引用而抛约束错误
 */
export async function 删除任务(任务ID: number): Promise<void> {
    await db.update(视频).set({ 来源任务ID: null }).where(eq(视频.来源任务ID, 任务ID));
    await db.update(采集日志).set({ 任务ID: null }).where(eq(采集日志.任务ID, 任务ID));
    await db.delete(监控任务).where(eq(监控任务.任务ID, 任务ID));
}

export async function 更新任务(任务ID: number, 启用: boolean): Promise<void> {
    await db
        .update(监控任务)
        .set({ 启用 })
        .where(eq(监控任务.任务ID, 任务ID));
}

// ===== 数据清理 =====

export async function 清空评论(): Promise<{ 评论: number; 情感分析: number }> {
    // 用 .returning() 统计实际删除的行数
    const 删除评论 = await db.delete(评论).returning({ id: 评论.评论ID });
    const 删除情感 = await db.delete(情感分析).where(eq(情感分析.来源类型, "评论")).returning({ id: 情感分析.分析ID });
    return {
        评论: 删除评论.length,
        情感分析: 删除情感.length,
    };
}

/** 仅删除评论类情感分析记录（用于重新分析） */
export async function 删除评论情感分析(): Promise<number> {
    const 删除 = await db.delete(情感分析).where(eq(情感分析.来源类型, "评论")).returning({ id: 情感分析.分析ID });
    return 删除.length;
}
