import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { collectionLogs, comments, monitorTasks, sentimentAnalysis, videos } from "./schema";

const now = () => Math.floor(Date.now() / 1000);

// ===== 任务 CRUD =====

export async function listTasks() {
    return db.select().from(monitorTasks).orderBy(desc(monitorTasks.createdAt));
}

export async function createTask(type: string, target: string) {
    if (type !== "up主" && type !== "关键词") {
        throw new Error("任务类型必须为 up主 或 关键词");
    }
    const [row] = await db
        .insert(monitorTasks)
        .values({
            type,
            target: target.trim(),
            enabled: true,
            createdAt: now(),
        })
        .returning();
    return row;
}

/**
 * 删除任务：先解除关联引用，再删除
 * 数据库已启用外键约束（PRAGMA foreign_keys=ON），直接删任务会因
 * 视频.sourceTaskId / 采集日志.taskId 引用而抛约束错误
 */
export async function deleteTask(taskId: number): Promise<void> {
    await db.update(videos).set({ sourceTaskId: null }).where(eq(videos.sourceTaskId, taskId));
    await db.update(collectionLogs).set({ taskId: null }).where(eq(collectionLogs.taskId, taskId));
    await db.delete(monitorTasks).where(eq(monitorTasks.id, taskId));
}

export async function updateTask(taskId: number, enabled: boolean): Promise<void> {
    await db.update(monitorTasks).set({ enabled }).where(eq(monitorTasks.id, taskId));
}

// ===== 数据清理 =====

export async function clearComments(): Promise<{ comments: number; sentimentAnalysis: number }> {
    // 用 .returning() 统计实际删除的行数
    const deletedComments = await db.delete(comments).returning({ id: comments.id });
    const deletedSentiments = await db
        .delete(sentimentAnalysis)
        .where(eq(sentimentAnalysis.sourceType, "评论"))
        .returning({ id: sentimentAnalysis.id });
    return {
        comments: deletedComments.length,
        sentimentAnalysis: deletedSentiments.length,
    };
}

/** 仅删除评论类情感分析记录（用于重新分析） */
export async function deleteCommentSentiments(): Promise<number> {
    const deleted = await db
        .delete(sentimentAnalysis)
        .where(eq(sentimentAnalysis.sourceType, "评论"))
        .returning({ id: sentimentAnalysis.id });
    return deleted.length;
}
