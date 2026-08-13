import * as collector from "../bili/collector";
import * as repo from "../db/repository";
import { initClient, readCollectParams } from "./params";

/**
 * 采集视频：遍历启用任务，拉取视频元信息 + 详情统计
 */
export async function collectVideos(): Promise<{ videos: number }> {
    console.log(`[采集] 开始采集视频 ${new Date().toLocaleString("zh-CN")}`);
    await initClient();
    const params = await readCollectParams();
    const tasks = await repo.getEnabledTasks();
    let videoCount = 0;

    for (const task of tasks) {
        try {
            const list =
                task.type === "up主"
                    ? await collector.fetchUpVideos(Number(task.target), params.videoPages)
                    : await collector.searchVideosByKeyword(task.target, 1);
            // 批量保存（内部已按 BV 去重），返回 BV号 → 视频ID 映射
            const idMap = await repo.saveVideosBatch(list, task.id);
            videoCount += list.length;
            for (const v of list) {
                await saveVideoStatsWithDetail(idMap, v);
            }
            await repo.updateLastCollectedAt(task.id);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await repo.writeLog(task.id, "采集视频", "失败", 0, 0, message);
            console.error(`[采集] 任务「${task.target}」视频失败：`, message);
        }
    }
    console.log(`[采集] 视频完成：处理 ${videoCount} 条`);
    return { videos: videoCount };
}

/** 拉取视频详情并保存统计（详情失败仅告警，不阻断主流程） */
async function saveVideoStatsWithDetail(
    idMap: Map<string, number>,
    v: { bvid: string; aid: number },
): Promise<void> {
    const videoId = idMap.get(v.bvid);
    if (videoId === undefined) return;
    try {
        await repo.saveVideoStats(videoId, await collector.fetchVideoDetail(v.aid));
    } catch (e) {
        console.warn(`[采集] 视频 ${v.bvid} 详情失败：`, e);
    }
}

/**
 * 采集评论：遍历已有视频增量采集新评论
 * 不再"已有评论跳过"——而是按「评论采集间隔小时」跳过刚采过的视频，
 * 其余视频每次都拉取，依靠 rpid 唯一约束 + onConflictDoNothing 去重，只入库新评论
 */
export async function collectComments(): Promise<{ comments: number }> {
    console.log(`[采集] 开始采集评论 ${new Date().toLocaleString("zh-CN")}`);
    await initClient();
    const params = await readCollectParams();
    const intervalSeconds = params.commentCollectIntervalHours * 3600;
    const nowSeconds = Math.floor(Date.now() / 1000);
    let commentCount = 0;
    const pageSize = 100;
    let page = 1;

    // 每个视频最近一次评论采集时间（秒时间戳），用于间隔判断
    const lastCollected = await repo.getLastCommentCollectTime();

    while (true) {
        const videoList = await repo.queryVideos(page, pageSize);
        if (videoList.length === 0) break;
        for (const v of videoList) {
            const lastTime = lastCollected.get(v.id) ?? 0;
            if (nowSeconds - lastTime < intervalSeconds) continue; // 间隔内跳过，避免频繁全量拉取
            commentCount += await collectVideoComments(v, params.commentLimit);
        }
        if (videoList.length < pageSize) break;
        page++;
    }
    console.log(`[采集] 评论完成：${commentCount} 条`);
    return { comments: commentCount };
}

/**
 * 采集单个视频的评论：拉取 + 增量入库 + 墓碑删除检测 + 覆盖率告警
 * @returns 新增评论数
 */
async function collectVideoComments(
    v: { id: number; aid: number; bvid: string },
    commentLimit: number,
): Promise<number> {
    let added = 0;
    try {
        const { total, mainComments } = await collector.fetchVideoComments(v.aid, commentLimit);
        // 增量保存（UPSERT 热度）+ 返回新增数
        added = await repo.upsertComments(v.id, mainComments);
        // 完整采集判定：拉到接口总数（未达上限截断）才算完整快照，才能做删除检测
        const isFull = mainComments.length >= total;
        // 墓碑机制：对完整快照对比上次 rpid 集合，标记被删除/封禁/精选过滤的评论
        if (isFull) {
            await repo.markDeletedComments(
                v.id,
                mainComments.map((c) => c.rpid),
                true,
            );
        }
        // 覆盖率统计：接口返回的总数 vs 实际采集数，缺口会在下轮（6 小时后）自动补采
        if (total > 0) {
            const coverage = Math.min(100, Math.round((mainComments.length / total) * 100));
            if (coverage < 100) {
                console.warn(
                    `[采集] 视频 ${v.bvid} 评论覆盖率 ${coverage}%（采 ${mainComments.length}/${total}），` +
                        `缺口下轮补采（可能是评论上限截断或接口限制）`,
                );
            } else if (total > commentLimit) {
                console.log(
                    `[采集] 视频 ${v.bvid} 评论达上限 ${commentLimit}（接口共 ${total} 条）`,
                );
            }
        }
    } catch (e) {
        console.warn(`[采集] 视频 ${v.bvid} 评论失败：`, e);
    }
    return added;
}

/**
 * 采集动态：遍历启用的 up 主任务，拉取动态
 */
export async function collectDynamics(): Promise<{ dynamics: number }> {
    console.log(`[采集] 开始采集动态 ${new Date().toLocaleString("zh-CN")}`);
    await initClient();
    const params = await readCollectParams();
    const allTasks = await repo.getEnabledTasks();
    const tasks = allTasks.filter((t) => t.type === "up主");
    let dynamicCount = 0;

    for (const task of tasks) {
        try {
            const list = await collector.fetchUpDynamics(Number(task.target), params.dynamicPages);
            dynamicCount += await repo.saveDynamics(Number(task.target), list);
            await repo.updateLastCollectedAt(task.id);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await repo.writeLog(task.id, "采集动态", "失败", 0, 0, message);
            console.error(`[采集] 任务「${task.target}」动态失败：`, message);
        }
    }
    console.log(`[采集] 动态完成：${dynamicCount} 条`);
    return { dynamics: dynamicCount };
}

/**
 * 一键采集全部：视频 → 评论 → 动态（不含分析）
 */
export async function collectAll(): Promise<void> {
    console.log(`[调度] 开始本轮采集 ${new Date().toLocaleString("zh-CN")}`);
    try {
        await initClient();
    } catch (e) {
        console.error("[调度] 客户端初始化失败，跳过本轮：", e);
        return;
    }
    await collectVideos();
    await collectComments();
    await collectDynamics();
    console.log(`[调度] 本轮采集结束 ${new Date().toLocaleString("zh-CN")}`);
}
