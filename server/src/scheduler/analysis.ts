import * as repo from "../db/repository";
import { analyzeBatch, analyzeText, NEUTRAL_DEFAULT } from "../llm/analyzer";
import { currentModel } from "../llm/client";
import * as ft from "../llm/fault-tolerance";
import { broadcastAnalysisProgress } from "../logger";
import { readCollectParams } from "./params";

/** 预算/熔断停止信号正则（模块顶层） */
const STOP_SIGNAL_PATTERN = /预算|熔断/;

/** 待分析评论（含视频上下文，由 getUnanalyzedComments 返回） */
type PendingComment = {
    commentId: number;
    content: string;
    likes: number | null;
    replies: number | null;
    videoTitle: string | null;
    videoDescription: string | null;
    partitionName: string | null;
    subtitle: string | null;
};

/** 全局分析中止标志 */
let analysisAborted = false;

/** 设置中止标志 */
export function abortAnalysis(): void {
    analysisAborted = true;
    console.log("[分析] 收到中止请求，将在当前批次完成后停止");
}

/**
 * 分析未处理评论：循环分批处理，直到所有未分析评论处理完毕
 * 通过 SSE 实时推送进度
 *
 * 容错与成本控制（本轮加入）：
 * - 熔断：连续 5 次失败熔断 60s，期间快速失败（保护 API 配额）
 * - 预算：每轮最多调用「分析预算上限」次（成本控制），耗尽自动停止
 * - 采样：评论涌入超预算时按"点赞×讨论热度"采样，优先分析高影响力评论
 *   （现象级舆情 5 万条 → 只分析预算内高热度子集，趋势代表性仍在）
 * - 重试：批量失败降级逐条；逐条也带指数退避重试
 *
 * @param batchLimit 每批最多分析条数，缺省取配置"分析批量大小"或 20
 */
export async function analyzePendingComments(
    batchLimit?: number,
): Promise<{ analyzed: number; failed: number }> {
    const params = await readCollectParams();
    const batchSize = batchLimit ?? params.analysisBatch;
    const model = await currentModel();
    let totalAnalyzed = 0;
    let totalFailed = 0;
    let batch = 0;
    analysisAborted = false; // 重置标志

    // 本轮容错状态初始化：预算（0=不限）+ 采样统计
    const budget = params.analysisBudget > 0 ? params.analysisBudget : null;
    ft.resetBudget(budget);
    ft.resetSampling();
    if (budget) console.log(`[分析] 本轮预算：${budget} 次调用（成本控制），超出将按影响力采样`);

    // 查询未分析总数（用于进度百分比）
    const totalPending = await repo.countUnanalyzedComments();

    while (true) {
        if (analysisAborted) {
            console.log(`[分析] 已中止，已分析 ${totalAnalyzed} 条，失败 ${totalFailed} 条`);
            break;
        }
        // 预算耗尽 / 熔断 → 停止本轮
        if (shouldStopBatch(budget)) break;
        batch++;
        const pending = await repo.getUnanalyzedComments(batchSize);
        if (pending.length === 0) break;

        console.log(`[分析] 第${batch}批：${pending.length} 条，模型 ${model}`);
        const outcome = await processBatch(pending, model);
        totalAnalyzed += outcome.analyzed;
        totalFailed += outcome.failed;

        // 广播进度：已分析 = 成功数 + 失败数（失败的中性默认也已入库，算"已处理"），
        // 保证 已分析 >= 总数 时代表全部处理完毕，前端进度面板据此关闭
        broadcastAnalysisProgress({
            analyzed: totalAnalyzed + totalFailed,
            total: totalPending,
            failed: totalFailed,
            batch,
            model,
            thinking: outcome.thinking,
        });

        console.log(`[分析] 进度 ${totalAnalyzed}/${totalPending}，完成 ${pending.length} 条`);
    }
    // 采样/预算提示
    if (ft.samplingTriggered()) {
        const sampling = ft.samplingState();
        console.warn(
            `[分析] 触发优先级采样：采 ${sampling.sampled} 条 / 跳过 ${sampling.skipped} 条（预算内优先高影响力评论）`,
        );
    }
    if (totalAnalyzed === 0 && totalFailed === 0) {
        console.log("[分析] 无待分析评论");
    }
    return { analyzed: totalAnalyzed, failed: totalFailed };
}

/** 预算耗尽 / 熔断 → 本轮停止 */
function shouldStopBatch(budget: number | null): boolean {
    if (ft.isCircuitOpen()) {
        console.error(
            `[分析] 熔断中（剩余 ${ft.circuitBreakerState().remainingSeconds} 秒），本轮停止，请稍后重试`,
        );
        return true;
    }
    if (budget !== null && ft.budgetState().used >= budget) {
        console.log(`[分析] 预算已用完（${budget} 次），本轮停止`);
        return true;
    }
    return false;
}

/**
 * 处理一批：先批量分析（携带视频上下文），失败降级逐条
 * @returns 成功/失败条数与思维链
 */
async function processBatch(
    pending: PendingComment[],
    model: string,
): Promise<{ analyzed: number; failed: number; thinking: string }> {
    let thinking = "";
    try {
        // 预算放行检查（耗尽抛出 → 停止本轮）
        ft.checkPass();
        ft.recordCall();
        // 携带视频上下文（标题/描述/分区/字幕）供 LLM 结合视频内容判断
        const contexts = pending.map((r) => ({
            title: r.videoTitle ?? "",
            description: r.videoDescription ?? "",
            partitionName: r.partitionName ?? "",
            subtitle: r.subtitle ?? "",
        }));
        const { results, thinking: batchThinking } = await ft.withRetry(
            () =>
                analyzeBatch(
                    pending.map((r) => r.content),
                    contexts,
                ),
            "批量分析",
        );
        thinking = batchThinking;
        // 批量写入情感结果（一批 1 条 SQL，替代逐条 insert）
        await repo.saveSentimentsBatch(
            "评论",
            pending.map((r, i) => ({
                sourceId: r.commentId,
                result: results[i] ?? NEUTRAL_DEFAULT,
            })),
            model,
        );
        return { analyzed: pending.length, failed: 0, thinking };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (STOP_SIGNAL_PATTERN.test(message)) {
            console.log(`[分析] 停止本轮：${message}`);
            throw e;
        }
        console.error(`[分析] 第批失败，降级逐条：`, message);
        return fallbackIndividual(pending, model);
    }
}

/** 降级逐条：一条条分析（带容错重试与中止检查） */
async function fallbackIndividual(
    pending: PendingComment[],
    model: string,
): Promise<{ analyzed: number; failed: number; thinking: string }> {
    let analyzed = 0;
    let failed = 0;
    let thinking = "";
    for (const r of pending) {
        if (ft.isCircuitOpen()) {
            console.error(`[分析] 熔断中，停止降级逐条`);
            break;
        }
        const outcome = await analyzeOneWithRetry(r, model);
        if (outcome === "stopped") break;
        if (outcome === "failed") failed++;
        else {
            analyzed++;
            if (outcome.thinking) thinking += (thinking ? "\n" : "") + outcome.thinking;
        }
    }
    return { analyzed, failed, thinking };
}

/**
 * 逐条分析单条评论（带容错重试）
 * @returns "stopped"（预算/熔断停止）| "failed"（入库中性默认）| { thinking }
 */
async function analyzeOneWithRetry(
    r: PendingComment,
    model: string,
): Promise<"stopped" | "failed" | { thinking: string }> {
    try {
        ft.checkPass();
        ft.recordCall();
        const { result, thinking: itemThinking } = await ft.withRetry(
            () =>
                analyzeText(r.content, {
                    title: r.videoTitle ?? "",
                    description: r.videoDescription ?? "",
                    partitionName: r.partitionName ?? "",
                    subtitle: r.subtitle ?? "",
                }),
            "逐条分析",
        );
        await repo.saveSentiment("评论", r.commentId, result, model);
        return { thinking: itemThinking };
    } catch (itemError) {
        const itemMessage = itemError instanceof Error ? itemError.message : String(itemError);
        if (STOP_SIGNAL_PATTERN.test(itemMessage)) {
            console.log(`[分析] 降级中停止：${itemMessage}`);
            return "stopped";
        }
        await repo.saveSentiment("评论", r.commentId, NEUTRAL_DEFAULT, model);
        return "failed";
    }
}

/**
 * 重新分析全部评论：先清空评论类情感记录，再全量重新分析
 */
export async function reanalyzeAllComments(): Promise<{ analyzed: number; failed: number }> {
    const deletedCount = await repo.deleteCommentSentiments();
    console.log(`[分析] 已清空 ${deletedCount} 条旧评论情感记录，开始重新分析`);
    return analyzePendingComments();
}
