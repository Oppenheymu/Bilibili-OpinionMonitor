/**
 * 情感分析评测工具：219 条人工标注集（Ground Truth）+ 舆论话题提取评测 + 一致性对比
 *
 * 回答"模型到底准不准"：
 * 1. 倾向准确度：对 B站语境人工标注集跑分析，输出
 *    Accuracy / 三分类 Precision、Recall、F1 / 宏平均 F1 / 95% 置信区间
 * 2. 分语境准确率：反讽/阴阳、网络梗、缩写谐音、直白表达、中性陈述、边缘案例
 *    分别统计——导师最关注的"反讽是否被当成正能量"直接可见
 * 3. 分数准确度：分析分数是否落在人工标注的期望区间内
 * 4. 【舆论分析维度】话题提取质量：LLM 关键词提取能否命中人工标注的
 *    核心话题（讨论的是什么）——命中率/精确率/F1，这才是"舆情监控"的本体
 * 5. 单条 vs 批量一致性：批处理注意力偏移检测
 *
 * 运行方式：
 * - API：POST /api/分析/评测（返回 JSON 报告）
 * - CLI：cd server && bun run src/llm/evaluation.ts（需要默认 AI 提供者已配置）
 */

import { analyzeBatch, analyzeText } from "./analyzer";
import type { AnnotationSample } from "./annotation-sample";
import { contextGroupList, groupByContext, mergeTopicAnnotations } from "./annotation-set";
import { currentModel } from "./client";

/** 反讽/梗/缩写/谐音判错样本识别正则（模块顶层） */
const IRONY_MARKER_PATTERN = /反讽|梗|缩写|谐音/;

/** 评测使用的标注集（合并期望话题标注） */
export const evaluationDataset = mergeTopicAnnotations();

export interface CategoryMetrics {
    category: "正面" | "负面" | "中性";
    sampleCount: number;
    precision: number; // Precision
    recall: number; // Recall
    f1: number;
}

/** 单个样本评测结果 */
export interface SampleEvalResult {
    content: string;
    note: string;
    expected: string;
    actual: string;
    expectedScoreRange: [number, number];
    actualScore: number;
    sentimentCorrect: boolean;
    scoreCorrect: boolean;
}

/** 分语境准确率 */
export interface ContextMetrics {
    context: string;
    sampleCount: number;
    correctCount: number;
    accuracy: number; // 0~1
}

export interface SentimentEvalReport {
    model: string;
    totalSamples: number;
    correctCount: number;
    accuracy: number; // 0~1
    confidenceInterval95: [number, number]; // Wilson score interval
    macroF1: number;
    categories: CategoryMetrics[];
    /** 分语境准确率（反讽/梗/缩写/直白/中性/边缘） */
    contextBreakdown: ContextMetrics[];
    /** 分数落在人工标注期望区间的比例（分数准确度） */
    scoreAccuracy: number;
    allSamples: SampleEvalResult[];
}

export interface ConsistencyReport {
    model: string;
    sampleCount: number;
    sentimentConsistencyRate: number; // 0~1 批量与单条倾向一致的比例
    scoreMeanAbsDiff: number; // 批量与单条的分数平均绝对差
    inconsistentSamples: {
        content: string;
        single: string;
        batch: string;
        singleScore: number;
        batchScore: number;
    }[];
}

/** 话题提取评测结果（舆论分析维度——"大家在讨论什么"） */
export interface TopicEvalReport {
    sampleCount: number; // 有期望话题标注的样本数
    topicHitRate: number; // Recall：LLM 关键词命中人工话题的比例（平均每条命中率）
    topicPrecision: number; // Precision：LLM 关键词中属于人工话题的比例（噪音越低越高）
    topicF1: number;
    avgKeywordCount: number;
    missedSamples: { content: string; expectedTopics: string[]; extractedKeywords: string[] }[];
}

/**
 * 话题提取质量评测（舆论分析本体）：
 * 对每条有期望话题标注的样本，比较 LLM 提取的关键词与人工标注话题
 * - 命中率 = 每条样本 命中期望话题数/期望话题数 的平均（Recall）
 * - 精确率 = 每条样本 命中关键词数/提取关键词数 的平均（提取的越多越容易低）
 * 匹配规则：双向子串包含（LLM 提取"洗白/洗"都能命中期望"洗白"）
 */
export async function evaluateTopicExtraction(
    samples: AnnotationSample[] = evaluationDataset,
): Promise<TopicEvalReport> {
    const topicSamples = samples.filter((s) => s.expectedTopics && s.expectedTopics.length > 0);
    if (topicSamples.length === 0) {
        return {
            sampleCount: 0,
            topicHitRate: 0,
            topicPrecision: 0,
            topicF1: 0,
            avgKeywordCount: 0,
            missedSamples: [],
        };
    }

    let hitRateSum = 0;
    let precisionSum = 0;
    let totalKeywords = 0;
    const missedSamples: TopicEvalReport["missedSamples"] = [];

    for (const sample of topicSamples) {
        // topicSamples 已过滤 expectedTopics 非空，此处直接取值
        const expectedTopics = sample.expectedTopics ?? [];
        const { result } = await analyzeText(sample.content);
        const keywords = result.keywords ?? [];
        totalKeywords += keywords.length;
        // 匹配：期望话题 命中 任一 提取关键词（双向子串）
        const hitTopics = expectedTopics.filter((topic) =>
            keywords.some((word) => word.includes(topic) || topic.includes(word)),
        );
        const hitKeywords = keywords.filter((word) =>
            expectedTopics.some((topic) => word.includes(topic) || topic.includes(word)),
        );
        hitRateSum += hitTopics.length / expectedTopics.length;
        precisionSum += keywords.length > 0 ? hitKeywords.length / keywords.length : 0;
        if (hitTopics.length === 0) {
            missedSamples.push({
                content: sample.content,
                expectedTopics,
                extractedKeywords: keywords,
            });
        }
    }

    const sampleCount = topicSamples.length;
    const topicHitRate = hitRateSum / sampleCount;
    const topicPrecision = precisionSum / sampleCount;
    const topicF1 =
        topicHitRate + topicPrecision > 0
            ? (2 * topicHitRate * topicPrecision) / (topicHitRate + topicPrecision)
            : 0;
    return {
        sampleCount,
        topicHitRate: Number(topicHitRate.toFixed(3)),
        topicPrecision: Number(topicPrecision.toFixed(3)),
        topicF1: Number(topicF1.toFixed(3)),
        avgKeywordCount: Number((totalKeywords / sampleCount).toFixed(1)),
        missedSamples,
    };
}

/** Wilson 95% 置信区间（二项比例，小样本比正态近似更可靠） */
function wilson95(correct: number, total: number): [number, number] {
    if (total === 0) return [0, 0];
    const z = 1.96;
    const p = correct / total;
    const denominator = 1 + (z * z) / total;
    const center = p + (z * z) / (2 * total);
    const edge = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
    return [
        Math.max(0, Number(((center - edge) / denominator).toFixed(3))),
        Math.min(1, Number(((center + edge) / denominator).toFixed(3))),
    ];
}

/** 计算三分类的 Precision/Recall/F1（宏平均） */
function computeMetrics(
    expected: string[],
    actual: string[],
): { accuracy: number; macroF1: number; categories: CategoryMetrics[] } {
    const categoryList: ("正面" | "负面" | "中性")[] = ["正面", "负面", "中性"];
    let correctCount = 0;
    for (let i = 0; i < expected.length; i++) if (expected[i] === actual[i]) correctCount++;

    const categories: CategoryMetrics[] = categoryList.map((category) =>
        computeCategoryMetrics(expected, actual, category),
    );
    const macroF1 = categories.reduce((s, c) => s + c.f1, 0) / 3;
    return { accuracy: correctCount / expected.length, macroF1, categories };
}

/** 计算单个类别的 Precision/Recall/F1 */
function computeCategoryMetrics(
    expected: string[],
    actual: string[],
    category: "正面" | "负面" | "中性",
): CategoryMetrics {
    let truePositive = 0,
        falsePositive = 0,
        falseNegative = 0;
    for (let i = 0; i < expected.length; i++) {
        const isExpected = expected[i] === category;
        const isActual = actual[i] === category;
        if (isExpected && isActual) truePositive++;
        else if (!isExpected && isActual) falsePositive++;
        else if (isExpected && !isActual) falseNegative++;
    }
    const precision =
        truePositive + falsePositive > 0 ? truePositive / (truePositive + falsePositive) : 0;
    const recall =
        truePositive + falseNegative > 0 ? truePositive / (truePositive + falseNegative) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return {
        category,
        sampleCount: truePositive + falseNegative,
        precision: Number(precision.toFixed(3)),
        recall: Number(recall.toFixed(3)),
        f1: Number(f1.toFixed(3)),
    };
}

/**
 * 运行倾向准确度评测（对 219 条人工标注集）
 */
export async function evaluateSentimentAccuracy(
    samples: AnnotationSample[] = evaluationDataset,
): Promise<SentimentEvalReport> {
    const model = await currentModel();
    const expected: string[] = [];
    const actual: string[] = [];
    const allSamples: SampleEvalResult[] = [];

    for (const sample of samples) {
        const { result } = await analyzeText(sample.content);
        expected.push(sample.expectedSentiment);
        actual.push(result.sentiment);
        const [expectedLow, expectedHigh] = sample.expectedScoreRange;
        allSamples.push({
            content: sample.content,
            note: sample.note,
            expected: sample.expectedSentiment,
            actual: result.sentiment,
            expectedScoreRange: [expectedLow, expectedHigh],
            actualScore: result.sentimentScore,
            sentimentCorrect: result.sentiment === sample.expectedSentiment,
            scoreCorrect:
                result.sentimentScore >= expectedLow && result.sentimentScore <= expectedHigh,
        });
    }

    const { accuracy, macroF1, categories } = computeMetrics(expected, actual);
    const correctCount = allSamples.filter((s) => s.sentimentCorrect).length;
    const scoreCorrectCount = allSamples.filter((s) => s.scoreCorrect).length;

    // 分语境统计
    const grouped = groupByContext(samples);
    const contextBreakdown: ContextMetrics[] = contextGroupList.map((group) => {
        const groupSamples = grouped.get(group.name) ?? [];
        if (groupSamples.length === 0)
            return { context: group.name, sampleCount: 0, correctCount: 0, accuracy: 0 };
        // 该语境的样本在全部样本中的下标
        const groupCorrect = groupSamples.filter((sample) => {
            const matched = allSamples.find((s) => s.content === sample.content);
            return matched?.sentimentCorrect;
        }).length;
        return {
            context: group.name,
            sampleCount: groupSamples.length,
            correctCount: groupCorrect,
            accuracy: Number((groupCorrect / groupSamples.length).toFixed(3)),
        };
    });

    return {
        model,
        totalSamples: expected.length,
        correctCount,
        accuracy: Number(accuracy.toFixed(3)),
        confidenceInterval95: wilson95(correctCount, expected.length),
        macroF1: Number(macroF1.toFixed(3)),
        categories,
        contextBreakdown,
        scoreAccuracy: Number((scoreCorrectCount / allSamples.length).toFixed(3)),
        allSamples,
    };
}

/**
 * 一致性对比：同一批评论分别用 单条分析 与 批量分析，对比倾向一致率与分数差
 * 用于回答"批处理是否污染判定"——若一致率接近 100%，说明批量模式可靠
 * @param comments 待测评论（默认从标注集取样 20 条）
 */
export async function consistencyComparison(
    comments: string[] = evaluationDataset.slice(0, 20).map((s) => s.content),
): Promise<ConsistencyReport> {
    const model = await currentModel();
    const sampleComments = comments.slice(0, 20); // 上限 20 条控制成本
    const singleResults: { sentiment: string; score: number }[] = [];
    const batchResults: { sentiment: string; score: number }[] = [];

    // 单条模式
    for (const content of sampleComments) {
        const { result } = await analyzeText(content);
        singleResults.push({ sentiment: result.sentiment, score: result.sentimentScore });
    }
    // 批量模式
    const { results: batch } = await analyzeBatch(sampleComments);
    for (const r of batch) batchResults.push({ sentiment: r.sentiment, score: r.sentimentScore });

    const inconsistentSamples: ConsistencyReport["inconsistentSamples"] = [];
    let consistentCount = 0;
    let scoreDiffSum = 0;
    for (let i = 0; i < sampleComments.length; i++) {
        const single = singleResults[i];
        const batchItem = batchResults[i];
        if (!single || !batchItem) continue;
        const consistent = single.sentiment === batchItem.sentiment;
        if (consistent) consistentCount++;
        scoreDiffSum += Math.abs(single.score - batchItem.score);
        if (!consistent) {
            inconsistentSamples.push({
                content: sampleComments[i] ?? "",
                single: single.sentiment,
                batch: batchItem.sentiment,
                singleScore: single.score,
                batchScore: batchItem.score,
            });
        }
    }
    return {
        model,
        sampleCount: sampleComments.length,
        sentimentConsistencyRate: Number((consistentCount / sampleComments.length).toFixed(3)),
        scoreMeanAbsDiff: Number((scoreDiffSum / sampleComments.length).toFixed(1)),
        inconsistentSamples,
    };
}

/**
 * 综合评测：倾向准确度（219 条标注集）+ 话题提取（舆论维度）+ 一致性
 */
export async function runEvaluation(): Promise<{
    sentiment: SentimentEvalReport;
    topic: TopicEvalReport;
    consistency: ConsistencyReport;
}> {
    return {
        sentiment: await evaluateSentimentAccuracy(),
        topic: await evaluateTopicExtraction(),
        consistency: await consistencyComparison(),
    };
}

// ===== CLI 入口 =====
// 用法：cd server && bun run src/llm/evaluation.ts
if (import.meta.main) {
    console.log(
        `[评测] 开始运行情感分析评测（${evaluationDataset.length} 条标注集，需默认 AI 提供者已配置）...`,
    );
    const report = await runEvaluation();
    const [low, high] = report.sentiment.confidenceInterval95;
    console.log("===== 一、情感倾向准确度 =====");
    console.log(`模型：${report.sentiment.model}`);
    console.log(`样本数：${report.sentiment.totalSamples}`);
    console.log(
        `准确率：${(report.sentiment.accuracy * 100).toFixed(1)}%（${report.sentiment.correctCount}/${report.sentiment.totalSamples}）`,
    );
    console.log(`95% 置信区间：${(low * 100).toFixed(1)}% ~ ${(high * 100).toFixed(1)}%`);
    console.log(`宏平均F1：${report.sentiment.macroF1}`);
    console.log("各类别 P/R/F1：");
    for (const c of report.sentiment.categories) {
        console.log(
            `  ${c.category}: P=${c.precision} R=${c.recall} F1=${c.f1} (样本 ${c.sampleCount})`,
        );
    }
    console.log("分语境准确率：");
    for (const g of report.sentiment.contextBreakdown) {
        console.log(
            `  ${g.context}: ${(g.accuracy * 100).toFixed(1)}%（${g.correctCount}/${g.sampleCount}）`,
        );
    }
    console.log(
        `分数准确率（落在标注区间内）：${(report.sentiment.scoreAccuracy * 100).toFixed(1)}%`,
    );
    console.log("\n===== 二、舆论话题提取质量（讨论的是什么）=====");
    console.log(`样本数：${report.topic.sampleCount}`);
    console.log(`话题命中率（Recall）：${(report.topic.topicHitRate * 100).toFixed(1)}%`);
    console.log(`话题精确率（噪音控制）：${(report.topic.topicPrecision * 100).toFixed(1)}%`);
    console.log(`话题F1：${report.topic.topicF1}`);
    console.log(`平均提取关键词数：${report.topic.avgKeywordCount}`);
    if (report.topic.missedSamples.length > 0) {
        console.log(`未命中样本（${report.topic.missedSamples.length} 条）：`);
        for (const s of report.topic.missedSamples.slice(0, 10)) {
            console.log(
                `  [✗] ${s.content} → 期望[${s.expectedTopics.join("/")}] 提取[${s.extractedKeywords.join("/")}]`,
            );
        }
    } else {
        console.log("全部话题命中 🎉");
    }
    console.log("\n===== 三、反讽/梗判错样本（重点检查）=====");
    const misclassified = report.sentiment.allSamples.filter(
        (s) => !s.sentimentCorrect && IRONY_MARKER_PATTERN.test(s.note),
    );
    for (const s of misclassified) {
        console.log(`  [✗] ${s.content} → 期望${s.expected} 实际${s.actual}（${s.note}）`);
    }
    console.log("\n===== 四、单条 vs 批量一致性 =====");
    console.log(
        `倾向一致率：${(report.consistency.sentimentConsistencyRate * 100).toFixed(1)}%（${report.consistency.sampleCount} 条）`,
    );
    console.log(`分数平均绝对差：${report.consistency.scoreMeanAbsDiff}`);
    if (report.consistency.inconsistentSamples.length > 0) {
        console.log("不一致样本：");
        for (const s of report.consistency.inconsistentSamples) {
            console.log(
                `  [${s.content}] 单条=${s.single}(${s.singleScore}) vs 批量=${s.batch}(${s.batchScore})`,
            );
        }
    } else {
        console.log("无不一致样本 🎉");
    }
}
