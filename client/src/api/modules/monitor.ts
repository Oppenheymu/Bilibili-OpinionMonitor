import http from "@/api";
import type { Monitor } from "@/api/interface/monitor";

/**
 * @description 舆情监控业务接口（对接 Hono 服务端）
 *  服务端直接返回数据（无 code/msg/data 包裹），已在响应拦截器中适配
 */

// ===== 任务管理 =====
export const getTaskListApi = (): Promise<Monitor.Task[]> =>
    http.direct<Monitor.Task[]>("/tasks", {}, { loading: false });

export const createTaskApi = (type: string, target: string) =>
    http.directPost<Monitor.Task>("/tasks", { type, target });

export const updateTaskApi = (id: number, enabled: boolean) =>
    http.directPatch<{ ok: boolean }>(`/tasks/${id}`, { enabled });

export const deleteTaskApi = (id: number) => http.directDelete<{ ok: boolean }>(`/tasks/${id}`);

// ===== 统计 =====
export const getOverviewApi = (): Promise<Monitor.OverviewStats> =>
    http.direct<Monitor.OverviewStats>("/stats/overview", {}, { loading: false });

export const getSentimentDistApi = (): Promise<Monitor.SentimentDist[]> =>
    http.direct<Monitor.SentimentDist[]>("/stats/sentiment-dist", {}, { loading: false });

export const getTrendApi = (days = 7): Promise<Monitor.Trend[]> =>
    http.direct<Monitor.Trend[]>("/stats/trend", { days }, { loading: false });

// ===== 舆论分析（话题维度）=====
export const getTopicStatsApi = (limit = 20): Promise<Monitor.TopicStatItem[]> =>
    http.direct<Monitor.TopicStatItem[]>("/stats/topics", { limit }, { loading: false });

export const getRiskAlertsApi = (limit = 10): Promise<Monitor.TopicStatItem[]> =>
    http.direct<Monitor.TopicStatItem[]>("/stats/risk-alerts", { limit }, { loading: false });

// 加权情感指数（点赞×讨论热度加权）
export const getWeightedSentimentApi = (): Promise<Monitor.WeightedSentimentReport> =>
    http.direct<Monitor.WeightedSentimentReport>(
        "/stats/weighted-sentiment",
        {},
        { loading: false },
    );

// LLM 容错状态（熔断/预算/采样）
export const getFaultToleranceApi = (): Promise<Monitor.FaultToleranceState> =>
    http.direct<Monitor.FaultToleranceState>("/analyze/fault-tolerance", {}, { loading: false });

// ===== 内容查询 =====
export const getCommentListApi = (params: {
    page?: number;
    size?: number;
    sentiment?: string;
    videoId?: number;
    keyword?: string;
    deleted?: boolean;
}): Promise<Monitor.PageResult<Monitor.Comment>> =>
    http.direct<Monitor.PageResult<Monitor.Comment>>("/comments", params, { loading: false });

export const clearAllCommentsApi = (): Promise<{
    message: string;
    comments: number;
    sentimentAnalysis: number;
}> =>
    // 服务端要求 confirm=1 才执行（防误触/恶意调用）
    http.directDelete<{ message: string; comments: number; sentimentAnalysis: number }>(
        "/comments",
        { confirm: "1" },
        { loading: false },
    );

export const getVideoListApi = (page = 1, size = 20): Promise<Monitor.PageResult<Monitor.Video>> =>
    http.direct<Monitor.PageResult<Monitor.Video>>("/videos", { page, size }, { loading: false });

export const getDynamicListApi = (
    page = 1,
    size = 20,
): Promise<Monitor.PageResult<Monitor.Dynamic>> =>
    http.direct<Monitor.PageResult<Monitor.Dynamic>>(
        "/dynamics",
        { page, size },
        { loading: false },
    );

export const getLogListApi = (
    params: { page?: number; size?: number; stage?: string; status?: string } = {},
): Promise<Monitor.PageResult<Monitor.Log>> =>
    http.direct<Monitor.PageResult<Monitor.Log>>("/logs", params, { loading: false });

export const getLogStatsApi = (): Promise<Monitor.LogStats> =>
    http.direct<Monitor.LogStats>("/logs/stats", {}, { loading: false });

export const clearLogsApi = (): Promise<{ message: string; clearedCount: number }> =>
    // 服务端要求 confirm=1 才执行（防误触/恶意调用）
    http.directDelete<{ message: string; clearedCount: number }>(
        "/logs",
        { confirm: "1" },
        { loading: false },
    );

// ===== 系统配置 =====
export const getConfigApi = (): Promise<Monitor.Config> =>
    http.direct<Monitor.Config>("/config", {}, { loading: false });

export const saveConfigApi = (
    data: Record<string, string>,
): Promise<{ ok: boolean; message: string }> =>
    http.directPut<{ ok: boolean; message: string }>("/config", data, { loading: false });

// ===== 手动采集（细分，不含分析）=====
export const collectVideoApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/collect/videos", {}, { loading: false });
export const collectCommentApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/collect/comments", {}, { loading: false });
export const collectDynamicApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/collect/dynamics", {}, { loading: false });
export const collectAllApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/collect/all", {}, { loading: false });
// 兼容旧接口（只采集不分析）
export const triggerCollectApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/collect/trigger", {}, { loading: false });

// ===== 手动分析 =====
export const analyzePendingApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/analyze/pending", {}, { loading: false, timeout: 5000 });
export const analyzeAllApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>(
        "/analyze/reanalyze-all",
        {},
        { loading: false, timeout: 5000 },
    );

export const stopAnalysisApi = (): Promise<{ message: string }> =>
    http.directPost<{ message: string }>("/analyze/abort", {}, { loading: false });

// ===== 情感分析评测（人工标注集 + 一致性对比）=====
export const runEvaluationApi = (): Promise<Monitor.EvaluationReport> =>
    http.directPost<Monitor.EvaluationReport>(
        "/analyze/evaluate",
        {},
        { loading: false, timeout: 300000 },
    );

// ===== AI 提供者管理 =====
export const getAIProvidersApi = (): Promise<Monitor.AIProvider[]> =>
    http.direct<Monitor.AIProvider[]>("/ai-providers", {}, { loading: false });

export const createAIProviderApi = (data: {
    name: string;
    providerKey: string;
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    temperature: number;
    systemPrompt?: string | null;
    maxTokens?: number;
    enabled: boolean;
    isDefault: boolean;
    sortOrder: number;
}): Promise<Monitor.AIProvider> =>
    http.directPost<Monitor.AIProvider>("/ai-providers", data, { loading: false });

export const updateAIProviderApi = (
    id: number,
    data: Partial<{
        name: string;
        providerKey: string;
        apiKey: string;
        apiBaseUrl: string;
        model: string;
        temperature: number;
        systemPrompt?: string | null;
        maxTokens: number;
        enabled: boolean;
        isDefault: boolean;
        sortOrder: number;
    }>,
): Promise<{ ok: boolean }> =>
    http.directPut<{ ok: boolean }>(`/ai-providers/${id}`, data, { loading: false });

export const deleteAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
    http.directDelete<{ ok: boolean }>(`/ai-providers/${id}`, { loading: false });

export const setDefaultAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
    http.directPost<{ ok: boolean }>(`/ai-providers/${id}/set-default`, {}, { loading: false });

// ===== B站服务诊断 =====
export const getBiliStatusApi = (): Promise<Monitor.BiliStatus> =>
    http.direct<Monitor.BiliStatus>("/bili/status", {}, { loading: false });
