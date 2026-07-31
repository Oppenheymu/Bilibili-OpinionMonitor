import * as 库 from "../db/repository";
import { 分析文本, 批量分析, 中性默认 } from "../llm/analyzer";
import { 当前模型 } from "../llm/client";
import { 广播分析进度 } from "../logger";
import { 读取采集参数 } from "./参数";

/** 全局分析中止标志 */
let 分析已中止 = false;

/** 设置中止标志 */
export function 中止分析(): void {
    分析已中止 = true;
    console.log("[分析] 收到中止请求，将在当前批次完成后停止");
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
            // 批量写入情感结果（一批 1 条 SQL，替代逐条 insert）
            await 库.批量保存情感(
                "评论",
                未分析.map((r, i) => ({ 来源ID: r.评论ID, 结果: 结果[i] ?? 中性默认 })),
                模型,
            );
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

        // 广播进度：已分析 = 成功数 + 失败数（失败的中性默认也已入库，算"已处理"），
        // 保证 已分析 >= 总数 时代表全部处理完毕，前端进度面板据此关闭
        广播分析进度({
            已分析: 总已分析 + 总失败,
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
