/**
 * LLM 调用容错与成本控制：
 * 1. 重试：网络超时 / 5xx / 429 指数退避重试（可配置次数）
 * 2. 熔断：连续失败达阈值后熔断 N 秒，期间直接失败快速返回（保护 API 配额与钱包）
 * 3. 预算：每轮分析的调用上限（成本控制），达到上限自动停止本轮
 * 4. 优先级采样：评论涌入超预算时，按"点赞数 × 讨论热度"采样，优先分析高影响力评论
 *    （现象级舆情 5 万条评论 → 只分析预算内的高热度子集，趋势代表性仍在）
 */

// ===== 熔断器状态 =====
let 连续失败数 = 0;
let 熔断中 = false;
let 熔断解除时间 = 0;
const 熔断阈值 = 5; // 连续 5 次失败触发熔断
const 熔断时长毫秒 = 60_000; // 熔断 60 秒

// ===== 预算状态 =====
export let 本轮预算: number | null = null; // null = 不限
export let 本轮已用 = 0;

// ===== 采样状态 =====
let 采样阈值分数 = -Infinity; // 已采样的最低"影响力分"（缓存边界）
let 已采样评论数 = 0;
let 已跳过评论数 = 0;

/** 重置每轮预算（每轮分析开始前调用） */
export function 重置预算(新预算: number | null): void {
    本轮预算 = 新预算;
    本轮已用 = 0;
}

/** 重置采样统计（每轮分析开始前调用） */
export function 重置采样(): void {
    采样阈值分数 = -Infinity;
    已采样评论数 = 0;
    已跳过评论数 = 0;
}

/** 当前是否处于熔断状态 */
export function 是否熔断(): boolean {
    if (熔断中) {
        if (Date.now() >= 熔断解除时间) {
            熔断中 = false;
            连续失败数 = 0;
            return false;
        }
        return true;
    }
    return false;
}

/** 记录成功（重置连续失败） */
export function 记录成功(): void {
    连续失败数 = 0;
}

/** 记录失败（可能触发熔断） */
export function 记录失败(): void {
    连续失败数++;
    if (连续失败数 >= 熔断阈值 && !熔断中) {
        熔断中 = true;
        熔断解除时间 = Date.now() + 熔断时长毫秒;
        console.error(`[LLM容错] 连续失败 ${熔断阈值} 次，触发熔断 ${熔断时长毫秒 / 1000} 秒`);
    }
}

/** 熔断状态快照（用于前端展示） */
export function 熔断状态(): { 熔断中: boolean; 剩余秒: number } {
    return {
        熔断中: 熔断中 && Date.now() < 熔断解除时间,
        剩余秒: 熔断中 ? Math.max(0, Math.ceil((熔断解除时间 - Date.now()) / 1000)) : 0,
    };
}

/** 预算状态快照 */
export function 预算状态(): { 预算: number | null; 已用: number; 剩余: number | null } {
    return {
        预算: 本轮预算,
        已用: 本轮已用,
        剩余: 本轮预算 === null ? null : Math.max(0, 本轮预算 - 本轮已用),
    };
}

/** 采样状态快照 */
export function 采样状态(): { 已采样: number; 已跳过: number; 阈值分数: number } {
    return {
        已采样: 已采样评论数,
        已跳过: 已跳过评论数,
        阈值分数: Math.round(采样阈值分数),
    };
}

/**
 * 请求是否应放行（预算检查 + 熔断检查）
 * @throws 预算耗尽 / 熔断中 时抛出，调用方应停止本轮
 */
export function 检查放行(): void {
    if (是否熔断()) {
        throw new Error(`LLM 熔断中（剩余 ${熔断状态().剩余秒} 秒），请稍后再试`);
    }
    if (本轮预算 !== null && 本轮已用 >= 本轮预算) {
        throw new Error(`本轮分析预算已用完（${本轮预算} 次调用），已停止`);
    }
}

/** 记录一次调用（预算扣除） */
export function 记录调用(): void {
    本轮已用++;
}

// ===== 评论影响力采样 =====

/** 计算评论"影响力分"：点赞为主，楼中楼讨论热度为辅（与加权情感指数同源公式） */
export function 影响力分(点赞数: number, 回复数: number): number {
    return (点赞数 + 1) * (1 + Math.log(1 + 回复数));
}

/**
 * 采样决策：评论涌入量超过预算时，按影响力分降序保留预算内的样本
 * 用"全局阈值"策略：只需在排序后取前 K 条，K = 预算
 * @returns true 保留该评论 / false 跳过
 */
export function 采样决策(点赞数: number, 回复数: number): boolean {
    // 无预算限制 → 全采
    if (本轮预算 === null) return true;
    if (已采样评论数 < 本轮预算) {
        已采样评论数++;
        采样阈值分数 = Math.max(采样阈值分数, 影响力分(点赞数, 回复数));
        return true;
    }
    已跳过评论数++;
    return false;
}

/**
 * 采样降级提示（供日志/前端展示）：如果跳过了大量评论，说明触发采样
 */
export function 是否触发采样(): boolean {
    return 已跳过评论数 > 0;
}

// ===== 重试包装 =====

/** 判断错误是否可重试（网络/超时/5xx/429） */
function 可重试错误(e: unknown): boolean {
    if (e instanceof Error) {
        const 信息 = e.message;
        if (/timeout|fetch failed|ECONN|ETIMEDOUT|network/i.test(信息)) return true;
        if (/502|503|504|429/.test(信息)) return true;
    }
    return false;
}

/**
 * 带重试的 LLM 调用（指数退避 1s→2s→4s，上限 3 次）
 * @param 执行 LLM 调用函数
 * @param 描述 日志描述
 */
export async function 带重试<T>(执行: () => Promise<T>, 描述: string): Promise<T> {
    let 最后错误: unknown;
    for (let 尝试 = 0; 尝试 <= 3; 尝试++) {
        if (尝试 > 0) {
            const 退避 = Math.min(1000 * 2 ** (尝试 - 1), 8000);
            console.warn(`[LLM容错] ${描述} 第 ${尝试}/3 次重试，退避 ${退避}ms`);
            await new Promise((r) => setTimeout(r, 退避));
        }
        try {
            const 结果 = await 执行();
            记录成功();
            return 结果;
        } catch (e) {
            最后错误 = e;
            记录失败();
            if (!可重试错误(e)) throw e; // 业务错误不重试（如 JSON 解析失败）
        }
    }
    throw 最后错误;
}
