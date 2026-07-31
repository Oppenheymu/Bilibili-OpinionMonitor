import { 获取客户端 } from "../bili/client";
import * as 采集 from "../bili/collector";
import * as 库 from "../db/repository";
import { 分析文本, 批量分析, 中性默认, type 情感结果 } from "../llm/analyzer";
import { 当前模型 } from "../llm/client";
import { 广播分析进度 } from "../logger";

type 任务行 = { 任务ID: number; 类型: string; 目标: string };

/** 全局分析中止标志 */
let 分析已中止 = false;

/** 设置中止标志 */
export function 中止分析(): void {
    分析已中止 = true;
    console.log("[分析] 收到中止请求，将在当前批次完成后停止");
}

/** 读取采集参数（DB 优先，缺省回退代码默认） */
async function 读取采集参数(): Promise<{
    间隔分钟: number;
    评论上限: number;
    视频页数: number;
    动态页数: number;
    分析批量: number;
}> {
    const 取数 = async (键: string, 默认值: number) => {
        const v = await 库.读取配置项(键);
        const n = Number(v);
        return v === "" || Number.isNaN(n) ? 默认值 : n;
    };
    return {
        间隔分钟: await 取数("采集间隔分钟", 30),
        评论上限: await 取数("单视频评论上限", 500),
        视频页数: await 取数("视频采集页数", 3),
        动态页数: await 取数("动态采集页数", 5),
        分析批量: await 取数("分析批量大小", 20),
    };
}

/** 初始化 B站客户端，失败抛出 */
async function 初始化客户端(): Promise<void> {
    await 获取客户端();
}

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
            for (const v of 列表) {
                const { 视频ID } = await 库.保存视频(v, 任务.任务ID);
                视频数++;
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
 * 采集评论：遍历已有视频，对尚无评论的视频拉取评论
 */
export async function 采集评论(): Promise<{ 评论: number }> {
    console.log(`[采集] 开始采集评论 ${new Date().toLocaleString("zh-CN")}`);
    await 初始化客户端();
    const 参数 = await 读取采集参数();
    let 评论数 = 0;
    const 页大小 = 100;
    let 页 = 1;

    while (true) {
        const 视频列表 = await 库.查询视频(页, 页大小);
        if (视频列表.length === 0) break;
        for (const v of 视频列表) {
            if ((await 库.视频评论数(v.视频ID)) > 0) continue; // 已有评论跳过
            try {
                const { 主评论 } = await 采集.获取视频评论(v.AV号, 参数.评论上限);
                评论数 += await 库.保存评论(v.视频ID, 主评论);
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

/**
 * 分析未处理评论：循环分批处理，直到所有未分析评论处理完毕
 * 通过 SSE 实时推送进度
 * @param 单轮上限 每批最多分析条数，缺省取配置"分析批量大小"或 20
 */
export async function 分析未处理评论(单轮上限?: number): Promise<{ 已分析: number; 失败: number }> {
    const 参数 = await 读取采集参数();
    const 每批 = 单轮上限 ?? 参数.分析批量;
    const 模型 = await 当前模型();
    let 总已分析 = 0;
    let 总失败 = 0;
    let 批次 = 0;
    分析已中止 = false; // 重置标志

    // 查询未分析总数（用于进度百分比）
    const 总未分析 = await 库.查未分析评论总数();

    while (true) {
        if (分析已中止) {
            console.log(`[分析] 已中止，已分析 ${总已分析} 条，失败 ${总失败} 条`);
            break;
        }
        批次++;
        const 未分析 = await 库.查未分析评论(每批);
        if (未分析.length === 0) break;

        console.log(`[分析] 第${批次}批：${未分析.length} 条，模型 ${模型}`);
        let 思考 = "";

        try {
            const { 结果, 思考: 批思考 } = await 批量分析(未分析.map((r) => r.内容));
            思考 = 批思考;
            for (let i = 0; i < 未分析.length; i++) {
                await 库.保存情感("评论", 未分析[i].评论ID, 结果[i] ?? 中性默认, 模型);
            }
            总已分析 += 未分析.length;
        } catch (e) {
            console.error(`[分析] 第${批次}批失败，降级逐条：`, e);
            for (const r of 未分析) {
                try {
                    const { 结果, 思考: 条思考 } = await 分析文本(r.内容);
                    await 库.保存情感("评论", r.评论ID, 结果, 模型);
                    总已分析++;
                    if (条思考) 思考 += (思考 ? "\n" : "") + 条思考;
                } catch {
                    await 库.保存情感("评论", r.评论ID, 中性默认, 模型);
                    总失败++;
                }
            }
        }

        // 广播进度
        广播分析进度({
            已分析: 总已分析,
            总数: 总未分析,
            失败: 总失败,
            批次,
            模型,
            思考,
        });

        console.log(`[分析] 进度 ${总已分析}/${总未分析}，完成 ${未分析.length} 条`);
    }
    if (总已分析 === 0 && 总失败 === 0) {
        console.log("[分析] 无待分析评论");
    }
    return { 已分析: 总已分析, 失败: 总失败 };
}

/**
 * 重新分析全部评论：先清空评论类情感记录，再全量重新分析
 */
export async function 重新分析全部评论(): Promise<{ 已分析: number; 失败: number }> {
    const 删除数 = await 库.删除评论情感分析();
    console.log(`[分析] 已清空 ${删除数} 条旧评论情感记录，开始重新分析`);
    return 分析未处理评论();
}

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
    执行循环();
}
