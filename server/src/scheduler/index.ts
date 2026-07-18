import { 获取客户端 } from "../bili/client";
import * as 采集 from "../bili/collector";
import * as 库 from "../db/repository";
import { 分析文本, 批量分析, 中性默认, type 情感结果 } from "../llm/analyzer";
import { 当前模型 } from "../llm/client";

const 采集间隔分钟 = Number(process.env["采集间隔分钟"] ?? 30);
const 评论上限 = Number(process.env["单视频评论上限"] ?? 500);
const 视频采集页数 = Number(process.env["视频采集页数"] ?? 3);
const 动态采集页数 = Number(process.env["动态采集页数"] ?? 5);
const 分析批量 = 20;

type 任务行 = { 任务ID: number; 类型: string; 目标: string };

/**
 * 执行一轮完整采集：遍历启用任务 → 采集视频/评论/动态 → 分析未处理评论
 */
export async function 执行一次采集(): Promise<void> {
    console.log(`[调度] 开始本轮采集 ${new Date().toLocaleString("zh-CN")}`);

    try {
        await 获取客户端();
    } catch (e) {
        console.error("[调度] 客户端初始化失败，跳过本轮：", e);
        return;
    }

    const 任务列表 = await 库.获取启用任务();
    if (任务列表.length === 0) {
        console.log("[调度] 暂无启用的监控任务");
    }

    for (const 任务 of 任务列表) {
        try {
            if (任务.类型 === "up主") {
                await 采集UP主任务(任务);
            } else if (任务.类型 === "关键词") {
                await 采集关键词任务(任务);
            }
        } catch (e) {
            const 信息 = e instanceof Error ? e.message : String(e);
            await 库.记录日志(任务.任务ID, "任务", "失败", 0, 0, 信息);
            console.error(`[调度] 任务「${任务.目标}」失败：`, 信息);
        }
    }

    await 分析未处理评论();
    console.log(`[调度] 本轮采集结束 ${new Date().toLocaleString("zh-CN")}`);
}

async function 采集UP主任务(任务: 任务行): Promise<void> {
    const uid = Number(任务.目标);
    const 开始 = Date.now();
    let 视频数 = 0;
    let 评论数 = 0;

    const 视频列表 = await 采集.获取UP主视频(uid, 视频采集页数);
    for (const v of 视频列表) {
        const { 视频ID, 是否新增 } = await 库.保存视频(v, 任务.任务ID);
        视频数++;
        try {
            const 详情 = await 采集.获取视频详情(v.aid);
            await 库.保存视频统计(视频ID, 详情);
        } catch (e) {
            console.warn(`[调度] 视频 ${v.bvid} 详情获取失败：`, e);
        }
        // 新视频或该视频尚无评论时都采集评论（清空评论表后可自动重采）
        const 已有评论数 = await 库.视频评论数(视频ID);
        if (是否新增 || 已有评论数 === 0) {
            console.log(`[调度] 采集评论 aid=${v.aid} bvid=${v.bvid} 是否新增=${是否新增} 已有评论=${已有评论数}`);
            const { 主评论 } = await 采集.获取视频评论(v.aid, 评论上限);
            const 保存数 = await 库.保存评论(视频ID, 主评论);
            评论数 += 保存数;
            console.log(`[调度] 评论采集完成 bvid=${v.bvid} 拉取${主评论.length}条 保存${保存数}条`);
        }
    }

    const 动态列表 = await 采集.获取UP主动态(uid, 动态采集页数);
    const 动态数 = await 库.保存动态(uid, 动态列表);

    await 库.记录日志(任务.任务ID, "采集UP主", "成功", 视频数 + 评论数 + 动态数, Date.now() - 开始, null);
    await 库.更新最后采集时间(任务.任务ID);
    console.log(`[调度] UP主「${任务.目标}」完成：视频${视频数} 评论${评论数} 动态${动态数}`);
}

async function 采集关键词任务(任务: 任务行): Promise<void> {
    const 开始 = Date.now();
    let 评论数 = 0;

    const 视频列表 = await 采集.关键词搜索视频(任务.目标, 1);
    for (const v of 视频列表) {
        const { 视频ID, 是否新增 } = await 库.保存视频(v, 任务.任务ID);
        if (是否新增 || (await 库.视频评论数(视频ID)) === 0) {
            const { 主评论 } = await 采集.获取视频评论(v.aid, 评论上限);
            评论数 += await 库.保存评论(视频ID, 主评论);
        }
    }

    await 库.记录日志(任务.任务ID, "采集关键词", "成功", 评论数, Date.now() - 开始, null);
    await 库.更新最后采集时间(任务.任务ID);
    console.log(`[调度] 关键词「${任务.目标}」完成：评论${评论数}`);
}

async function 分析未处理评论(): Promise<void> {
    const 模型 = 当前模型();
    const 未分析 = await 库.查未分析评论(分析批量);
    if (未分析.length === 0) {
        console.log("[分析] 无待分析评论");
        return;
    }
    console.log(`[分析] 待分析 ${未分析.length} 条，模型 ${模型}`);

    try {
        const 结果: 情感结果[] = await 批量分析(未分析.map((r) => r.内容));
        for (let i = 0; i < 未分析.length; i++) {
            await 库.保存情感("评论", 未分析[i].评论ID, 结果[i] ?? 中性默认, 模型);
        }
        console.log(`[分析] 完成 ${未分析.length} 条`);
    } catch (e) {
        console.error("[分析] 批量失败，降级逐条：", e);
        for (const r of 未分析) {
            try {
                const 结果 = await 分析文本(r.内容);
                await 库.保存情感("评论", r.评论ID, 结果, 模型);
            } catch {
                await 库.保存情感("评论", r.评论ID, 中性默认, 模型);
            }
        }
    }
}

/**
 * 启动调度器：立即执行一次，之后按间隔循环
 */
export function 启动调度(): void {
    const 间隔毫秒 = 采集间隔分钟 * 60 * 1000;
    console.log(`[调度] 已启动，间隔 ${采集间隔分钟} 分钟`);
    执行一次采集().catch((e) => console.error("[调度] 采集异常：", e));
    setInterval(() => {
        执行一次采集().catch((e) => console.error("[调度] 采集异常：", e));
    }, 间隔毫秒);
}
