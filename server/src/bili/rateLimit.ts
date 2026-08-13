/**
 * B站 API 受控请求层：全局限速 + 指数退避重试 + 风控降速
 *
 * 背景：B站对评论/动态/详情接口有严格频率限制与风控（触发后可能
 * 返回 -412、要求验证码，或静默截断数据）。无节制的连续请求极易
 * 被拦截，导致采集样本不完整，趋势分析失真。
 *
 * 机制：
 * 1. 全局限速：所有 B站请求全局串行，间隔 = 配置的「请求间隔毫秒」
 *    + 30% 随机抖动（打破固定节奏，避免被模式识别）
 * 2. 指数退避：失败重试时等待 base * 2^n（上限 30s），重试次数可配
 * 3. 风控降速：捕获风控信号后进入"降速模式"5 分钟，间隔放大 3 倍，
 *    让风控窗口冷却，之后自动恢复
 */
import { readCollectParams } from "../scheduler/params";

/** 限速参数缓存（30 秒刷新，避免每次请求都读数据库） */
let paramsCache: { requestIntervalMs: number; maxRetries: number } | null = null;
let paramsCacheTime = 0;

async function getRateLimitParams(): Promise<{ requestIntervalMs: number; maxRetries: number }> {
    if (!paramsCache || Date.now() - paramsCacheTime > 30000) {
        const params = await readCollectParams();
        paramsCache = {
            requestIntervalMs: params.requestIntervalMs,
            maxRetries: params.maxRetries,
        };
        paramsCacheTime = Date.now();
    }
    return paramsCache;
}

/** 全局最近一次请求的推进时间戳（含间隔预留） */
let lastRequestAdvanceTime = 0;

/** 风控降速模式 */
let slowingDown = false;
let slowDownUntil = 0;

/** 随机抖动：在基础值上 ±30% */
function jitter(base: number): number {
    return Math.round(base * (0.7 + Math.random() * 0.6));
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 等待限速窗口：保证两次 B站请求之间至少间隔「请求间隔毫秒」
 * 降速模式下间隔放大 3 倍
 */
async function waitRateLimitWindow(requestIntervalMs: number): Promise<void> {
    const now = Date.now();
    let interval = requestIntervalMs;
    if (slowingDown) {
        if (now >= slowDownUntil) {
            slowingDown = false;
        } else {
            interval *= 3;
        }
    }
    const wait = Math.max(0, lastRequestAdvanceTime + interval - now);
    if (wait > 0) await sleep(wait);
    // 用抖动后的间隔推进时间线，避免固定节奏
    lastRequestAdvanceTime = Date.now() + jitter(interval);
}

/** 风控信号关键词正则（模块顶层，避免每次调用重建） */
const RISK_SIGNAL_PATTERN = /412|风控|验证|risk|captcha|频繁|限制/i;

/** 风控信号识别：错误信息命中这些关键词即认为触发风控 */
function isRiskSignal(message: string): boolean {
    return RISK_SIGNAL_PATTERN.test(message);
}

export interface ControlledRequestOptions {
    /** 覆盖全局重试次数（默认为配置值） */
    retries?: number;
}

/**
 * 受控请求：对任意 B站 API 调用包上「限速 + 指数退避重试 + 风控降速」
 * @param execute 实际的 API 调用函数（每次重试都会重新调用）
 * @param description 用于日志的请求描述
 */
export async function controlledRequest<T>(
    execute: () => Promise<T>,
    description: string,
    options: ControlledRequestOptions = {},
): Promise<T> {
    const { requestIntervalMs, maxRetries } = await getRateLimitParams();
    const retryLimit = options.retries ?? maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryLimit; attempt++) {
        if (attempt > 0) {
            // 指数退避：1s * 2^(n-1)，上限 30s，加抖动
            const backoff = Math.min(1000 * 2 ** (attempt - 1), 30000);
            console.warn(
                `[限速] ${description} 第 ${attempt}/${retryLimit} 次重试，退避 ${backoff}ms`,
            );
            await sleep(jitter(backoff));
        }
        await waitRateLimitWindow(requestIntervalMs);
        try {
            return await execute();
        } catch (e) {
            lastError = e;
            const message = e instanceof Error ? e.message : String(e);
            if (isRiskSignal(message)) {
                slowingDown = true;
                slowDownUntil = Date.now() + 5 * 60 * 1000;
                console.error(`[限速] ${description} 触发风控信号，进入降速模式 5 分钟：`, message);
            } else if (attempt >= retryLimit) {
                console.error(`[限速] ${description} 重试 ${retryLimit} 次仍失败：`, message);
            }
        }
    }
    throw lastError;
}
