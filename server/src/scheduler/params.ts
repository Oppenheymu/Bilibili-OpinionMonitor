import { getClient } from "../bili/client";
import * as repo from "../db/repository";

/** 读取采集参数（DB 优先，缺省回退代码默认） */
export async function readCollectParams(): Promise<{
    intervalMinutes: number;
    commentLimit: number;
    videoPages: number;
    dynamicPages: number;
    analysisBatch: number;
    commentCollectIntervalHours: number;
    requestIntervalMs: number;
    maxRetries: number;
    analysisBudget: number;
}> {
    const readNumber = async (key: string, defaultValue: number) => {
        const v = await repo.getConfigValue(key);
        const n = Number(v);
        return v === "" || Number.isNaN(n) ? defaultValue : n;
    };
    return {
        intervalMinutes: await readNumber("采集间隔分钟", 30),
        commentLimit: await readNumber("单视频评论上限", 500),
        videoPages: await readNumber("视频采集页数", 3),
        dynamicPages: await readNumber("动态采集页数", 5),
        analysisBatch: await readNumber("分析批量大小", 20),
        // 同一视频两次评论采集的最小间隔（小时），避免每次全量拉取触发 B站风控
        commentCollectIntervalHours: await readNumber("评论采集间隔小时", 6),
        // B站 API 请求间隔（毫秒）：所有采集请求全局串行限速 + 随机抖动
        requestIntervalMs: await readNumber("请求间隔毫秒", 1200),
        // 失败重试次数：指数退避重试（1s→2s→4s...上限 30s）
        maxRetries: await readNumber("最大重试次数", 3),
        // 每轮 LLM 分析预算（调用次数）：0=不限。现象级舆情 5 万评论时防止费用爆炸，
        // 超出预算的评论留待下一轮（按点赞降序自动优先分析高影响力评论 = 优先级采样）
        analysisBudget: await readNumber("分析预算", 500),
    };
}

/** 初始化 B站客户端，失败抛出 */
export async function initClient(): Promise<void> {
    await getClient();
}
