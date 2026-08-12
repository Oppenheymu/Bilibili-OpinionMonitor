/**
 * 调度器聚合出口（barrel）
 * - params.ts:  读取采集参数 / 初始化客户端
 * - collection.ts:  采集视频 / 评论 / 动态 / 全部
 * - analysis.ts:  分析未处理 / 重新全部 / 中止分析
 * - index.ts: 启动调度（循环采集）
 */

import { collectAll } from "./collection";
import { readCollectParams } from "./params";

export * from "./analysis";
export * from "./collection";
export * from "./params";

/**
 * 启动调度器：立即采集一次，之后按配置间隔循环采集（每次循环重新读取配置）
 */
export function startScheduler(): void {
    const runLoop = async () => {
        const params = await readCollectParams();
        const intervalMs = params.intervalMinutes * 60 * 1000;
        console.log(`[调度] 已启动，间隔 ${params.intervalMinutes} 分钟（仅采集，分析需手动触发）`);
        try {
            await collectAll();
        } catch (e) {
            console.error("[调度] 采集异常：", e);
        }
        // 用 setTimeout 替代 setInterval，每次循环重新读取配置
        setTimeout(runLoop, intervalMs);
    };
    // biome-ignore lint/nursery/noFloatingPromises: 调度循环启动为后台任务，内部已捕获异常
    runLoop();
}
