/**
 * 调度器聚合出口（barrel）
 * - 参数.ts:  读取采集参数 / 初始化客户端
 * - 采集.ts:  采集视频 / 评论 / 动态 / 全部
 * - 分析.ts:  分析未处理 / 重新全部 / 中止分析
 * - index.ts: 启动调度（循环采集）
 */

import { 读取采集参数 } from "./参数";
import { 采集全部 } from "./采集";

export * from "./分析";
export * from "./参数";
export * from "./采集";

/**
 * 启动调度器：立即采集一次，之后按配置间隔循环采集（每次循环重新读取配置）
 */
export function 启动调度(): void {
    const 执行循环 = async () => {
        const 参数 = await 读取采集参数();
        const 间隔毫秒 = 参数.间隔分钟 * 60 * 1000;
        console.log(`[调度] 已启动，间隔 ${参数.间隔分钟} 分钟（仅采集，分析需手动触发）`);
        try {
            await 采集全部();
        } catch (e) {
            console.error("[调度] 采集异常：", e);
        }
        // 用 setTimeout 替代 setInterval，每次循环重新读取配置
        setTimeout(执行循环, 间隔毫秒);
    };
    // biome-ignore lint/nursery/noFloatingPromises: 调度循环启动为后台任务，内部已捕获异常
    执行循环();
}
