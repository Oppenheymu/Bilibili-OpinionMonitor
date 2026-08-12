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
import { 读取采集参数 } from "../scheduler/参数";

/** 限速参数缓存（30 秒刷新，避免每次请求都读数据库） */
let 参数缓存: { 请求间隔毫秒: number; 最大重试次数: number } | null = null;
let 参数缓存时间 = 0;

async function 取限速参数(): Promise<{ 请求间隔毫秒: number; 最大重试次数: number }> {
    if (!参数缓存 || Date.now() - 参数缓存时间 > 30000) {
        const 参数 = await 读取采集参数();
        参数缓存 = {
            请求间隔毫秒: 参数.请求间隔毫秒,
            最大重试次数: 参数.最大重试次数,
        };
        参数缓存时间 = Date.now();
    }
    return 参数缓存;
}

/** 全局最近一次请求的推进时间戳（含间隔预留） */
let 最近请求推进时间 = 0;

/** 风控降速模式 */
let 降速中 = false;
let 降速解除时间 = 0;

/** 随机抖动：在基础值上 ±30% */
function 抖动(基础: number): number {
    return Math.round(基础 * (0.7 + Math.random() * 0.6));
}

const 睡眠 = (毫秒: number): Promise<void> => new Promise((r) => setTimeout(r, 毫秒));

/**
 * 等待限速窗口：保证两次 B站请求之间至少间隔「请求间隔毫秒」
 * 降速模式下间隔放大 3 倍
 */
async function 等待限速窗口(请求间隔毫秒: number): Promise<void> {
    const 现在 = Date.now();
    let 间隔 = 请求间隔毫秒;
    if (降速中) {
        if (现在 >= 降速解除时间) {
            降速中 = false;
        } else {
            间隔 *= 3;
        }
    }
    const 等待 = Math.max(0, 最近请求推进时间 + 间隔 - 现在);
    if (等待 > 0) await 睡眠(等待);
    // 用抖动后的间隔推进时间线，避免固定节奏
    最近请求推进时间 = Date.now() + 抖动(间隔);
}

/** 风控信号识别：错误信息命中这些关键词即认为触发风控 */
function 是风控信号(信息: string): boolean {
    return /412|风控|验证|risk|captcha|频繁|限制/i.test(信息);
}

export interface 受控请求选项 {
    /** 覆盖全局重试次数（默认为配置值） */
    重试次数?: number;
}

/**
 * 受控请求：对任意 B站 API 调用包上「限速 + 指数退避重试 + 风控降速」
 * @param 执行 实际的 API 调用函数（每次重试都会重新调用）
 * @param 描述 用于日志的请求描述
 */
export async function 受控请求<T>(
    执行: () => Promise<T>,
    描述: string,
    选项: 受控请求选项 = {},
): Promise<T> {
    const { 请求间隔毫秒, 最大重试次数 } = await 取限速参数();
    const 重试上限 = 选项.重试次数 ?? 最大重试次数;
    let 最后错误: unknown;

    for (let 尝试 = 0; 尝试 <= 重试上限; 尝试++) {
        if (尝试 > 0) {
            // 指数退避：1s * 2^(n-1)，上限 30s，加抖动
            const 退避 = Math.min(1000 * 2 ** (尝试 - 1), 30000);
            console.warn(`[限速] ${描述} 第 ${尝试}/${重试上限} 次重试，退避 ${退避}ms`);
            await 睡眠(抖动(退避));
        }
        await 等待限速窗口(请求间隔毫秒);
        try {
            return await 执行();
        } catch (e) {
            最后错误 = e;
            const 信息 = e instanceof Error ? e.message : String(e);
            if (是风控信号(信息)) {
                降速中 = true;
                降速解除时间 = Date.now() + 5 * 60 * 1000;
                console.error(`[限速] ${描述} 触发风控信号，进入降速模式 5 分钟：`, 信息);
            } else if (尝试 >= 重试上限) {
                console.error(`[限速] ${描述} 重试 ${重试上限} 次仍失败：`, 信息);
            }
        }
    }
    throw 最后错误;
}
