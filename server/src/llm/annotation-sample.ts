/** 标注样本类型定义 */

export interface AnnotationSample {
    content: string;
    expectedSentiment: "正面" | "负面" | "中性";
    expectedScoreRange: [number, number]; // 期望分数区间（评估分数准确度用）
    note: string; // 该样本考察的能力点（前缀标识语境类型）
    /**
     * 期望话题：该评论讨论的核心话题词（人工标注，用于舆论分析维度评测）
     * 评测 LLM 关键词提取能否命中这些话题——回答"系统知不知道大家在讨论什么"
     * 可选字段：未标注的样本不参与话题评测（话题维度样本子集）
     */
    expectedTopics?: string[];
}
