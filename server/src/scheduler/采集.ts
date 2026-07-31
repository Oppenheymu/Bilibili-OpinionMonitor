import * as 采集 from "../bili/collector";
import * as 库 from "../db/repository";
import { 初始化客户端, 读取采集参数 } from "./参数";

/**
 * 采集视频：遍历启用任务，拉取视频元信息 + 详情统计
 */
export async function 采集视频(): Promise<{ 视频: number }> {
    console.log(`[采集] 开始采集视频 ${new Date().toLocaleString("zh-CN")}`);
    await 初始化客户端();
    const 参数 = await 读取采集参数();
    const 任务列表 = await 库.获取启用任务();
    let 视频数 = 0;

    for (const 任务 of 任务列表) {
        try {
            const 列表 =
                任务.类型 === "up主"
                    ? await 采集.获取UP主视频(Number(任务.目标), 参数.视频页数)
                    : await 采集.关键词搜索视频(任务.目标, 1);
            // 批量保存（内部已按 BV 去重），返回 BV号 → 视频ID 映射
            const ID映射 = await 库.批量保存视频(列表, 任务.任务ID);
            视频数 += 列表.length;
            for (const v of 列表) {
                const 视频ID = ID映射.get(v.bvid);
                if (视频ID === undefined) continue;
                try {
                    await 库.保存视频统计(视频ID, await 采集.获取视频详情(v.aid));
                } catch (e) {
                    console.warn(`[采集] 视频 ${v.bvid} 详情失败：`, e);
                }
            }
            await 库.更新最后采集时间(任务.任务ID);
        } catch (e) {
            const 信息 = e instanceof Error ? e.message : String(e);
            await 库.记录日志(任务.任务ID, "采集视频", "失败", 0, 0, 信息);
            console.error(`[采集] 任务「${任务.目标}」视频失败：`, 信息);
        }
    }
    console.log(`[采集] 视频完成：处理 ${视频数} 条`);
    return { 视频: 视频数 };
}

/**
 * 采集评论：遍历已有视频增量采集新评论
 * 不再"已有评论跳过"——而是按「评论采集间隔小时」跳过刚采过的视频，
 * 其余视频每次都拉取，依靠 rpid 唯一约束 + onConflictDoNothing 去重，只入库新评论
 */
export async function 采集评论(): Promise<{ 评论: number }> {
    console.log(`[采集] 开始采集评论 ${new Date().toLocaleString("zh-CN")}`);
    await 初始化客户端();
    const 参数 = await 读取采集参数();
    const 间隔秒 = 参数.评论采集间隔小时 * 3600;
    const 现在秒 = Math.floor(Date.now() / 1000);
    let 评论数 = 0;
    const 页大小 = 100;
    let 页 = 1;

    // 每个视频最近一次评论采集时间（秒时间戳），用于间隔判断
    const 最近采集 = await 库.视频最近评论采集时间();

    while (true) {
        const 视频列表 = await 库.查询视频(页, 页大小);
        if (视频列表.length === 0) break;
        for (const v of 视频列表) {
            const 上次采集 = 最近采集.get(v.视频ID) ?? 0;
            if (现在秒 - 上次采集 < 间隔秒) continue; // 间隔内跳过，避免频繁全量拉取
            try {
                const { 总数, 主评论 } = await 采集.获取视频评论(v.AV号, 参数.评论上限);
                const 新增 = await 库.保存评论(v.视频ID, 主评论);
                if (新增 > 0) 评论数 += 新增;
                // 覆盖率统计：接口返回的总数 vs 实际采集数，缺口会在下轮（6 小时后）自动补采
                if (总数 > 0) {
                    const 覆盖率 = Math.min(100, Math.round((主评论.length / 总数) * 100));
                    if (覆盖率 < 100) {
                        console.warn(
                            `[采集] 视频 ${v.BV号} 评论覆盖率 ${覆盖率}%（采 ${主评论.length}/${总数}），` +
                            `缺口下轮补采（可能是评论上限截断或接口限制）`,
                        );
                    } else if (总数 > 参数.评论上限) {
                        console.log(`[采集] 视频 ${v.BV号} 评论达上限 ${参数.评论上限}（接口共 ${总数} 条）`);
                    }
                }
            } catch (e) {
                console.warn(`[采集] 视频 ${v.BV号} 评论失败：`, e);
            }
        }
        if (视频列表.length < 页大小) break;
        页++;
    }
    console.log(`[采集] 评论完成：${评论数} 条`);
    return { 评论: 评论数 };
}

/**
 * 采集动态：遍历启用的 up 主任务，拉取动态
 */
export async function 采集动态(): Promise<{ 动态: number }> {
    console.log(`[采集] 开始采集动态 ${new Date().toLocaleString("zh-CN")}`);
    await 初始化客户端();
    const 参数 = await 读取采集参数();
    const 全部任务 = await 库.获取启用任务();
    const 任务列表 = 全部任务.filter((t) => t.类型 === "up主");
    let 动态数 = 0;

    for (const 任务 of 任务列表) {
        try {
            const 列表 = await 采集.获取UP主动态(Number(任务.目标), 参数.动态页数);
            动态数 += await 库.保存动态(Number(任务.目标), 列表);
            await 库.更新最后采集时间(任务.任务ID);
        } catch (e) {
            const 信息 = e instanceof Error ? e.message : String(e);
            await 库.记录日志(任务.任务ID, "采集动态", "失败", 0, 0, 信息);
            console.error(`[采集] 任务「${任务.目标}」动态失败：`, 信息);
        }
    }
    console.log(`[采集] 动态完成：${动态数} 条`);
    return { 动态: 动态数 };
}

/**
 * 一键采集全部：视频 → 评论 → 动态（不含分析）
 */
export async function 采集全部(): Promise<void> {
    console.log(`[调度] 开始本轮采集 ${new Date().toLocaleString("zh-CN")}`);
    try {
        await 初始化客户端();
    } catch (e) {
        console.error("[调度] 客户端初始化失败，跳过本轮：", e);
        return;
    }
    await 采集视频();
    await 采集评论();
    await 采集动态();
    console.log(`[调度] 本轮采集结束 ${new Date().toLocaleString("zh-CN")}`);
}
