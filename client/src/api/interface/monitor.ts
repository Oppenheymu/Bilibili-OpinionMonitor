/**
 * @description 舆情监控业务接口类型定义
 */
export namespace Monitor {
    /** 监控任务 */
    export interface Task {
        id: number;
        type: string;
        target: string;
        enabled: boolean;
        createdAt: number;
        lastCollectedAt: number | null;
    }

    /** 概览统计 */
    export interface OverviewStats {
        videoTotal: number;
        commentTotal: number;
        dynamicTotal: number;
        deletedComments: number; // 墓碑机制：被删/封禁/精选过滤的评论数
        analyzedComments: number;
        sentimentDist: Record<string, number>;
    }

    /** 情感分布项 */
    export interface SentimentDist {
        sentiment: string;
        count: number;
    }

    /** 趋势项 */
    export interface Trend {
        date: string;
        commentCount: number;
        avgScore: number;
    }

    /** 话题统计项（舆论分析：话题 × 情感交叉） */
    export interface TopicStatItem {
        topic: string;
        count: number;
        positiveCount: number;
        negativeCount: number;
        neutralCount: number;
        negativeRatio: number; // 0~1
    }

    /** 情感分析评测报告 */
    export interface EvaluationReport {
        sentiment: {
            model: string;
            totalSamples: number;
            correctCount: number;
            accuracy: number; // 0~1
            confidenceInterval95: [number, number];
            macroF1: number;
            categories: {
                category: string;
                sampleCount: number;
                precision: number;
                recall: number;
                f1: number;
            }[];
            contextBreakdown: {
                context: string;
                sampleCount: number;
                correctCount: number;
                accuracy: number;
            }[];
            scoreAccuracy: number;
            allSamples: {
                content: string;
                note: string;
                expected: string;
                actual: string;
                expectedScoreRange: [number, number];
                actualScore: number;
                sentimentCorrect: boolean;
                scoreCorrect: boolean;
            }[];
        };
        /** 舆论话题提取质量（讨论的是什么） */
        topic: {
            sampleCount: number;
            topicHitRate: number;
            topicPrecision: number;
            topicF1: number;
            avgKeywordCount: number;
            missedSamples: {
                content: string;
                expectedTopics: string[];
                extractedKeywords: string[];
            }[];
        };
        consistency: {
            model: string;
            sampleCount: number;
            sentimentConsistencyRate: number;
            scoreMeanAbsDiff: number;
            inconsistentSamples: {
                content: string;
                single: string;
                batch: string;
                singleScore: number;
                batchScore: number;
            }[];
        };
    }

    /** 加权情感指数报告（点赞×讨论热度权重） */
    export interface WeightedSentimentReport {
        weightedIndex: number; // -100 ~ 100
        simpleIndex: number; // 纯计数对比
        weightedCommentCount: number;
        highLikeCount: number; // 点赞 >= 1000
        extremeNegativeHighLikeCount: number; // 点赞 >= 1000 且分数 <= -60
        weightedDist: Record<string, number>;
    }

    /** LLM 容错状态（熔断/预算/采样） */
    export interface FaultToleranceState {
        circuitBreaker: { circuitOpen: boolean; remainingSeconds: number };
        budget: { budget: number | null; used: number; remaining: number | null };
        sampling: { sampled: number; skipped: number; thresholdScore: number };
    }

    /** @description 分页响应 */
    export interface PageResult<T> {
        list: T[];
        total: number;
    }

    /** 视频 */
    export interface Video {
        id: number;
        bvid: string;
        aid: number;
        title: string;
        description: string;
        upUid: number;
        upName: string;
        partitionId: number;
        partitionName: string;
        publishTime: number | null;
        duration: number;
        cover: string;
        sourceTaskId: number | null;
        collectedAt: number;
    }

    /** 评论 */
    export interface Comment {
        id: number;
        rpid: number;
        videoId: number;
        videoTitle: string | null;
        bvid: string | null;
        userUid: number;
        username: string;
        content: string;
        likes: number;
        replies: number;
        publishTime: number;
        isReply: boolean;
        isDeleted: boolean; // 墓碑机制：被删除/封禁/精选过滤
        deletedAt: number | null;
        sentiment: string | null;
        sentimentScore: number | null;
    }

    /** 动态 */
    export interface Dynamic {
        id: number;
        dynamicId: string;
        upUid: number;
        type: string;
        content: string;
        publishTime: number;
        collectedAt: number;
    }

    /** 采集日志 */
    export interface Log {
        id: number;
        taskId: number | null;
        stage: string;
        status: string;
        collectedCount: number;
        durationMs: number;
        errorMessage: string | null;
        createdAt: number;
    }

    /** 日志统计 */
    export interface LogStats {
        total: number;
        successCount: number;
        failureCount: number;
        inProgressCount: number;
        byStage: { stage: string; count: number; success: number; failure: number }[];
    }

    /** 控制台日志条目（SSE 推送） */
    export interface ConsoleLogEntry {
        time: string;
        level: "log" | "warn" | "error";
        content: string;
    }

    /** 分析进度事件（SSE 推送） */
    export interface AnalysisProgress {
        type: "analysis-progress";
        analyzed: number;
        total: number;
        failed: number;
        batch: number;
        model: string;
        thinking: string;
    }

    /** 系统配置 */
    export interface Config {
        采集间隔分钟: string;
        单视频评论上限: string;
        视频采集页数: string;
        动态采集页数: string;
        端口: string;
        数据库路径: string;
        凭证路径: string;
        自动刷新秒数: string;
        深色模式: string;
        表格行数: string;
        [key: string]: string;
    }

    /** AI 提供者 */
    export interface AIProvider {
        id: number;
        name: string;
        providerKey: string;
        apiKey: string;
        apiBaseUrl: string;
        model: string;
        systemPrompt: string | null;
        temperature: number;
        maxTokens: number | null;
        enabled: boolean;
        isDefault: boolean;
        sortOrder: number;
        createdAt: number;
    }

    /** B站服务诊断状态 */
    export interface BiliUserInfo {
        mid: number;
        nickname: string;
        avatar: string;
        level: number;
        gender: string;
        signature: string;
        vip: boolean;
    }

    export interface BiliStatus {
        credentialExists: boolean;
        credentialPath: string;
        credentialSize: number | null;
        credentialModifiedAt: number | null;
        clientLoaded: boolean;
        userInfo: BiliUserInfo | null;
        dataSummary: {
            videoCount: number;
            commentCount: number;
            dynamicCount: number;
            logCount: number;
            sentimentAnalysisCount: number;
        };
    }
}
