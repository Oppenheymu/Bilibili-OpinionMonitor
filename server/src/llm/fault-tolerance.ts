/**
 * LLM 调用容错与成本控制：
 * 1. 重试：网络超时 / 5xx / 429 指数退避重试（可配置次数）
 * 2. 熔断：连续失败达阈值后熔断 N 秒，期间直接失败快速返回（保护 API 配额与钱包）
 * 3. 预算：每轮分析的调用上限（成本控制），达到上限自动停止本轮
 * 4. 优先级采样：评论涌入超预算时，按"点赞数 × 讨论热度"采样，优先分析高影响力评论
 *    （现象级舆情 5 万条评论 → 只分析预算内的高热度子集，趋势代表性仍在）
 */

// ===== 熔断器状态 =====
let consecutiveFailures = 0;
let circuitOpen = false;
let circuitOpenUntil = 0;
const circuitBreakerThreshold = 5; // 连续 5 次失败触发熔断
const circuitBreakerDurationMs = 60_000; // 熔断 60 秒

// ===== 预算状态 =====
export let roundBudget: number | null = null; // null = 不限
export let roundUsed = 0;

// ===== 采样状态 =====
let sampleThresholdScore = -Infinity; // 已采样的最低"影响力分"（缓存边界）
let sampledCommentCount = 0;
let skippedCommentCount = 0;

/** 重置每轮预算（每轮分析开始前调用） */
export function resetBudget(newBudget: number | null): void {
    roundBudget = newBudget;
    roundUsed = 0;
}

/** 重置采样统计（每轮分析开始前调用） */
export function resetSampling(): void {
    sampleThresholdScore = -Infinity;
    sampledCommentCount = 0;
    skippedCommentCount = 0;
}

/** 当前是否处于熔断状态 */
export function isCircuitOpen(): boolean {
    if (circuitOpen) {
        if (Date.now() >= circuitOpenUntil) {
            circuitOpen = false;
            consecutiveFailures = 0;
            return false;
        }
        return true;
    }
    return false;
}

/** 记录成功（重置连续失败） */
export function recordSuccess(): void {
    consecutiveFailures = 0;
}

/** 记录失败（可能触发熔断） */
export function recordFailure(): void {
    consecutiveFailures++;
    if (consecutiveFailures >= circuitBreakerThreshold && !circuitOpen) {
        circuitOpen = true;
        circuitOpenUntil = Date.now() + circuitBreakerDurationMs;
        console.error(
            `[LLM容错] 连续失败 ${circuitBreakerThreshold} 次，触发熔断 ${circuitBreakerDurationMs / 1000} 秒`,
        );
    }
}

/** 熔断状态快照（用于前端展示） */
export function circuitBreakerState(): { circuitOpen: boolean; remainingSeconds: number } {
    return {
        circuitOpen: circuitOpen && Date.now() < circuitOpenUntil,
        remainingSeconds: circuitOpen
            ? Math.max(0, Math.ceil((circuitOpenUntil - Date.now()) / 1000))
            : 0,
    };
}

/** 预算状态快照 */
export function budgetState(): { budget: number | null; used: number; remaining: number | null } {
    return {
        budget: roundBudget,
        used: roundUsed,
        remaining: roundBudget === null ? null : Math.max(0, roundBudget - roundUsed),
    };
}

/** 采样状态快照 */
export function samplingState(): { sampled: number; skipped: number; thresholdScore: number } {
    return {
        sampled: sampledCommentCount,
        skipped: skippedCommentCount,
        thresholdScore: Math.round(sampleThresholdScore),
    };
}

/**
 * 请求是否应放行（预算检查 + 熔断检查）
 * @throws 预算耗尽 / 熔断中 时抛出，调用方应停止本轮
 */
export function checkPass(): void {
    if (isCircuitOpen()) {
        throw new Error(
            `LLM 熔断中（剩余 ${circuitBreakerState().remainingSeconds} 秒），请稍后再试`,
        );
    }
    if (roundBudget !== null && roundUsed >= roundBudget) {
        throw new Error(`本轮分析预算已用完（${roundBudget} 次调用），已停止`);
    }
}

/** 记录一次调用（预算扣除） */
export function recordCall(): void {
    roundUsed++;
}

// ===== 评论影响力采样 =====

/** 计算评论"影响力分"：点赞为主，楼中楼讨论热度为辅（与加权情感指数同源公式） */
export function influenceScore(likes: number, replies: number): number {
    return (likes + 1) * (1 + Math.log(1 + replies));
}

/**
 * 采样决策：评论涌入量超过预算时，按影响力分降序保留预算内的样本
 * 用"全局阈值"策略：只需在排序后取前 K 条，K = 预算
 * @returns true 保留该评论 / false 跳过
 */
export function samplingDecision(likes: number, replies: number): boolean {
    // 无预算限制 → 全采
    if (roundBudget === null) return true;
    if (sampledCommentCount < roundBudget) {
        sampledCommentCount++;
        sampleThresholdScore = Math.max(sampleThresholdScore, influenceScore(likes, replies));
        return true;
    }
    skippedCommentCount++;
    return false;
}

/**
 * 采样降级提示（供日志/前端展示）：如果跳过了大量评论，说明触发采样
 */
export function samplingTriggered(): boolean {
    return skippedCommentCount > 0;
}

// ===== 重试包装 =====

/** 判断错误是否可重试（网络/超时/5xx/429） */
function retryableError(e: unknown): boolean {
    if (e instanceof Error) {
        const message = e.message;
        if (/timeout|fetch failed|ECONN|ETIMEDOUT|network/i.test(message)) return true;
        if (/502|503|504|429/.test(message)) return true;
    }
    return false;
}

/**
 * 带重试的 LLM 调用（指数退避 1s→2s→4s，上限 3 次）
 * @param execute LLM 调用函数
 * @param description 日志描述
 */
export async function withRetry<T>(execute: () => Promise<T>, description: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= 3; attempt++) {
        if (attempt > 0) {
            const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
            console.warn(`[LLM容错] ${description} 第 ${attempt}/3 次重试，退避 ${backoff}ms`);
            await new Promise((r) => setTimeout(r, backoff));
        }
        try {
            const result = await execute();
            recordSuccess();
            return result;
        } catch (e) {
            lastError = e;
            recordFailure();
            if (!retryableError(e)) throw e; // 业务错误不重试（如 JSON 解析失败）
        }
    }
    throw lastError;
}
