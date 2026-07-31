/**
 * 情感分析评测工具：220+ 条人工标注集（Ground Truth）+ 一致性对比
 *
 * 回答"模型到底准不准"：
 * 1. 倾向准确度：对 B站语境人工标注集跑分析，输出
 *    Accuracy / 三分类 Precision、Recall、F1 / 宏平均 F1 / 95% 置信区间
 * 2. 分语境准确率：反讽/阴阳、网络梗、缩写谐音、直白表达、中性陈述、边缘案例
 *    分别统计——导师最关注的"反讽是否被当成正能量"直接可见
 * 3. 分数准确度：分析分数是否落在人工标注的期望区间内
 * 4. 单条 vs 批量一致性：批处理注意力偏移检测
 *
 * 运行方式：
 * - API：POST /api/分析/评测（返回 JSON 报告）
 * - CLI：cd server && bun run src/llm/评测.ts（需要默认 AI 提供者已配置）
 */

import { 分析文本, 批量分析 } from "./analyzer";
import { 当前模型 } from "./client";
import { B站语境标注集, 按语境分组, 语境分组列表 } from "./标注集";
import type { 标注样本 } from "./标注样本";

export interface 类别指标 {
    类别: "正面" | "负面" | "中性";
    样本数: number;
    精确率: number; // Precision
    召回率: number; // Recall
    F1: number;
}

/** 单个样本评测结果 */
export interface 样本评测结果 {
    内容: string;
    说明: string;
    期望: string;
    实际: string;
    期望分数范围: [number, number];
    实际分数: number;
    倾向正确: boolean;
    分数正确: boolean;
}

/** 分语境准确率 */
export interface 语境指标 {
    语境: string;
    样本数: number;
    正确数: number;
    准确率: number; // 0~1
}

export interface 倾向评测报告 {
    模型: string;
    样本总数: number;
    正确数: number;
    准确率: number; // 0~1
    "准确率95%置信区间": [number, number]; // Wilson score interval
    宏平均F1: number;
    各类别: 类别指标[];
    /** 分语境准确率（反讽/梗/缩写/直白/中性/边缘） */
    语境细分: 语境指标[];
    /** 分数落在人工标注期望区间的比例（分数准确度） */
    分数准确率: number;
    全部样本: 样本评测结果[];
}

export interface 一致性报告 {
    模型: string;
    样本数: number;
    倾向一致率: number; // 0~1 批量与单条倾向一致的比例
    分数平均绝对差: number; // 批量与单条的分数平均绝对差
    不一致样本: { 内容: string; 单条: string; 批量: string; 单条分数: number; 批量分数: number }[];
}

/** Wilson 95% 置信区间（二项比例，小样本比正态近似更可靠） */
function wilson95(正确数: number, 总数: number): [number, number] {
    if (总数 === 0) return [0, 0];
    const z = 1.96;
    const p = 正确数 / 总数;
    const 分母 = 1 + (z * z) / 总数;
    const 中心 = p + (z * z) / (2 * 总数);
    const 边 = z * Math.sqrt((p * (1 - p)) / 总数 + (z * z) / (4 * 总数 * 总数));
    return [
        Math.max(0, Number(((中心 - 边) / 分母).toFixed(3))),
        Math.min(1, Number(((中心 + 边) / 分母).toFixed(3))),
    ];
}

/** 计算三分类的 Precision/Recall/F1（宏平均） */
function 计算指标(期望: string[], 实际: string[]): { 准确率: number; 宏平均F1: number; 各类别: 类别指标[] } {
    const 类别列表: ("正面" | "负面" | "中性")[] = ["正面", "负面", "中性"];
    let 正确数 = 0;
    for (let i = 0; i < 期望.length; i++) if (期望[i] === 实际[i]) 正确数++;

    const 各类别: 类别指标[] = 类别列表.map((类别) => {
        let TP = 0, FP = 0, FN = 0;
        for (let i = 0; i < 期望.length; i++) {
            const 期望是 = 期望[i] === 类别;
            const 实际是 = 实际[i] === 类别;
            if (期望是 && 实际是) TP++;
            else if (!期望是 && 实际是) FP++;
            else if (期望是 && !实际是) FN++;
        }
        const 精确率 = TP + FP > 0 ? TP / (TP + FP) : 0;
        const 召回率 = TP + FN > 0 ? TP / (TP + FN) : 0;
        const F1 = 精确率 + 召回率 > 0 ? (2 * 精确率 * 召回率) / (精确率 + 召回率) : 0;
        return { 类别, 样本数: TP + FN, 精确率: Number(精确率.toFixed(3)), 召回率: Number(召回率.toFixed(3)), F1: Number(F1.toFixed(3)) };
    });
    const 宏平均F1 = 各类别.reduce((s, c) => s + c.F1, 0) / 3;
    return { 准确率: 正确数 / 期望.length, 宏平均F1, 各类别 };
}

/**
 * 运行倾向准确度评测（对 220+ 条人工标注集）
 */
export async function 评测倾向准确度(样本集: 标注样本[] = B站语境标注集): Promise<倾向评测报告> {
    const 模型 = await 当前模型();
    const 期望: string[] = [];
    const 实际: string[] = [];
    const 全部样本: 样本评测结果[] = [];

    for (const 样本 of 样本集) {
        const { 结果 } = await 分析文本(样本.内容);
        期望.push(样本.期望倾向);
        实际.push(结果.情感倾向);
        const [期望下限, 期望上限] = 样本.期望分数范围;
        全部样本.push({
            内容: 样本.内容,
            说明: 样本.说明,
            期望: 样本.期望倾向,
            实际: 结果.情感倾向,
            期望分数范围: [期望下限, 期望上限],
            实际分数: 结果.情感分数,
            倾向正确: 结果.情感倾向 === 样本.期望倾向,
            分数正确: 结果.情感分数 >= 期望下限 && 结果.情感分数 <= 期望上限,
        });
    }

    const { 准确率, 宏平均F1, 各类别 } = 计算指标(期望, 实际);
    const 正确数 = 全部样本.filter((s) => s.倾向正确).length;
    const 分数正确数 = 全部样本.filter((s) => s.分数正确).length;

    // 分语境统计
    const 分组 = 按语境分组(样本集);
    const 语境细分: 语境指标[] = 语境分组列表.map((组) => {
        const 组样本 = 分组.get(组.名) ?? [];
        if (组样本.length === 0) return { 语境: 组.名, 样本数: 0, 正确数: 0, 准确率: 0 };
        // 该语境的样本在全部样本中的下标
        const 组正确 = 组样本.filter((样本) => {
            const 对应 = 全部样本.find((s) => s.内容 === 样本.内容);
            return 对应?.倾向正确;
        }).length;
        return {
            语境: 组.名,
            样本数: 组样本.length,
            正确数: 组正确,
            准确率: Number((组正确 / 组样本.length).toFixed(3)),
        };
    });

    return {
        模型,
        样本总数: 期望.length,
        正确数,
        准确率: Number(准确率.toFixed(3)),
        "准确率95%置信区间": wilson95(正确数, 期望.length),
        宏平均F1: Number(宏平均F1.toFixed(3)),
        各类别,
        语境细分,
        分数准确率: Number((分数正确数 / 全部样本.length).toFixed(3)),
        全部样本,
    };
}

/**
 * 一致性对比：同一批评论分别用 单条分析 与 批量分析，对比倾向一致率与分数差
 * 用于回答"批处理是否污染判定"——若一致率接近 100%，说明批量模式可靠
 * @param 评论列表 待测评论（默认从标注集取样 20 条）
 */
export async function 一致性对比(评论列表: string[] = B站语境标注集.slice(0, 20).map((s) => s.内容)): Promise<一致性报告> {
    const 模型 = await 当前模型();
    const 样本 = 评论列表.slice(0, 20); // 上限 20 条控制成本
    const 单条结果: { 倾向: string; 分数: number }[] = [];
    const 批量结果: { 倾向: string; 分数: number }[] = [];

    // 单条模式
    for (const 内容 of 样本) {
        const { 结果 } = await 分析文本(内容);
        单条结果.push({ 倾向: 结果.情感倾向, 分数: 结果.情感分数 });
    }
    // 批量模式
    const { 结果: 批量 } = await 批量分析(样本);
    批量.forEach((r) => 批量结果.push({ 倾向: r.情感倾向, 分数: r.情感分数 }));

    const 不一致样本: 一致性报告["不一致样本"] = [];
    let 一致数 = 0;
    let 分数差总和 = 0;
    for (let i = 0; i < 样本.length; i++) {
        const 一致 = 单条结果[i].倾向 === 批量结果[i].倾向;
        if (一致) 一致数++;
        分数差总和 += Math.abs(单条结果[i].分数 - 批量结果[i].分数);
        if (!一致) {
            不一致样本.push({
                内容: 样本[i],
                单条: 单条结果[i].倾向,
                批量: 批量结果[i].倾向,
                单条分数: 单条结果[i].分数,
                批量分数: 批量结果[i].分数,
            });
        }
    }
    return {
        模型,
        样本数: 样本.length,
        倾向一致率: Number((一致数 / 样本.length).toFixed(3)),
        分数平均绝对差: Number((分数差总和 / 样本.length).toFixed(1)),
        不一致样本,
    };
}

/**
 * 综合评测：倾向准确度（220+ 条标注集）+ 一致性
 */
export async function 运行评测(): Promise<{ 倾向: 倾向评测报告; 一致性: 一致性报告 }> {
    return {
        倾向: await 评测倾向准确度(),
        一致性: await 一致性对比(),
    };
}

// ===== CLI 入口 =====
// 用法：cd server && bun run src/llm/评测.ts
if (import.meta.main) {
    console.log(`[评测] 开始运行情感分析评测（${B站语境标注集.length} 条标注集，需默认 AI 提供者已配置）...`);
    const 报告 = await 运行评测();
    const [低, 高] = 报告.倾向["准确率95%置信区间"];
    console.log("===== 倾向准确度 =====");
    console.log(`模型：${报告.倾向.模型}`);
    console.log(`样本数：${报告.倾向.样本总数}`);
    console.log(`准确率：${(报告.倾向.准确率 * 100).toFixed(1)}%（${报告.倾向.正确数}/${报告.倾向.样本总数}）`);
    console.log(`95% 置信区间：${(低 * 100).toFixed(1)}% ~ ${(高 * 100).toFixed(1)}%`);
    console.log(`宏平均F1：${报告.倾向.宏平均F1}`);
    console.log("各类别 P/R/F1：");
    for (const c of 报告.倾向.各类别) {
        console.log(`  ${c.类别}: P=${c.精确率} R=${c.召回率} F1=${c.F1} (样本 ${c.样本数})`);
    }
    console.log("分语境准确率：");
    for (const g of 报告.倾向.语境细分) {
        console.log(`  ${g.语境}: ${(g.准确率 * 100).toFixed(1)}%（${g.正确数}/${g.样本数}）`);
    }
    console.log(`分数准确率（落在标注区间内）：${(报告.倾向.分数准确率 * 100).toFixed(1)}%`);
    console.log("\n===== 反讽/梗判错样本（重点检查）=====");
    const 判错 = 报告.倾向.全部样本.filter((s) => !s.倾向正确 && /反讽|梗|缩写|谐音/.test(s.说明));
    for (const s of 判错) {
        console.log(`  [✗] ${s.内容} → 期望${s.期望} 实际${s.实际}（${s.说明}）`);
    }
    console.log("\n===== 单条 vs 批量一致性 =====");
    console.log(`倾向一致率：${(报告.一致性.倾向一致率 * 100).toFixed(1)}%（${报告.一致性.样本数} 条）`);
    console.log(`分数平均绝对差：${报告.一致性.分数平均绝对差}`);
    if (报告.一致性.不一致样本.length > 0) {
        console.log("不一致样本：");
        for (const s of 报告.一致性.不一致样本) {
            console.log(`  [${s.内容}] 单条=${s.单条}(${s.单条分数}) vs 批量=${s.批量}(${s.批量分数})`);
        }
    } else {
        console.log("无不一致样本 🎉");
    }
}
