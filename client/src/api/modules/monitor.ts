import http from "@/api";
import type { Monitor } from "@/api/interface/monitor";

/**
 * @description 舆情监控业务接口（对接 Hono 服务端）
 *  服务端直接返回数据（无 code/msg/data 包裹），已在响应拦截器中适配
 */

// ===== 任务管理 =====
export const getTaskListApi = (): Promise<Monitor.Task[]> =>
    http.get<Monitor.Task[]>("/tasks", {}, { loading: false }) as any;

export const createTaskApi = (type: string, target: string) =>
    http.post<Monitor.Task>("/tasks", { type, target }) as any;

export const updateTaskApi = (id: number, enabled: boolean) =>
    http.patch<{ ok: boolean }>(`/tasks/${id}`, { enabled }) as any;

export const deleteTaskApi = (id: number) => http.delete<{ ok: boolean }>(`/tasks/${id}`) as any;

// ===== 统计 =====
export const getOverviewApi = (): Promise<Monitor.OverviewStats> =>
    http.get<Monitor.OverviewStats>("/stats/overview", {}, { loading: false }) as any;

export const getSentimentDistApi = (): Promise<Monitor.SentimentDist[]> =>
    http.get<Monitor.SentimentDist[]>("/stats/sentiment-dist", {}, { loading: false }) as any;

export const getTrendApi = (days = 7): Promise<Monitor.Trend[]> =>
    http.get<Monitor.Trend[]>("/stats/trend", { days }, { loading: false }) as any;

// ===== 舆论分析（话题维度）=====
export const getTopicStatsApi = (limit = 20): Promise<Monitor.TopicStatItem[]> =>
    http.get<Monitor.TopicStatItem[]>("/stats/topics", { limit }, { loading: false }) as any;

export const getRiskAlertsApi = (limit = 10): Promise<Monitor.TopicStatItem[]> =>
    http.get<Monitor.TopicStatItem[]>("/stats/risk-alerts", { limit }, { loading: false }) as any;

// 加权情感指数（点赞×讨论热度加权）
export const getWeightedSentimentApi = (): Promise<Monitor.WeightedSentimentReport> =>
    http.get<Monitor.WeightedSentimentReport>(
        "/stats/weighted-sentiment",
        {},
        { loading: false },
    ) as any;

// LLM 容错状态（熔断/预算/采样）
export const getFaultToleranceApi = (): Promise<Monitor.FaultToleranceState> =>
    http.get<Monitor.FaultToleranceState>(
        "/analyze/fault-tolerance",
        {},
        { loading: false },
    ) as any;

// ===== 内容查询 =====
export const getCommentListApi = (params: {
    page?: number;
    size?: number;
    sentiment?: string;
    videoId?: number;
    keyword?: string;
    deleted?: boolean;
}): Promise<Monitor.PageResult<Monitor.Comment>> =>
    http.get<Monitor.PageResult<Monitor.Comment>>("/comments", params, { loading: false }) as any;

export const clearAllCommentsApi = (): Promise<{
    message: string;
    comments: number;
    sentimentAnalysis: number;
}> =>
    // 服务端要求 confirm=1 才执行（防误触/恶意调用）
    http.delete<{ message: string; comments: number; sentimentAnalysis: number }>(
        "/comments",
        { confirm: "1" },
        { loading: false },
    ) as any;

export const getVideoListApi = (page = 1, size = 20): Promise<Monitor.PageResult<Monitor.Video>> =>
    http.get<Monitor.PageResult<Monitor.Video>>(
        "/videos",
        { page, size },
        { loading: false },
    ) as any;

export const getDynamicListApi = (
    page = 1,
    size = 20,
): Promise<Monitor.PageResult<Monitor.Dynamic>> =>
    http.get<Monitor.PageResult<Monitor.Dynamic>>(
        "/dynamics",
        { page, size },
        { loading: false },
    ) as any;

export const getLogListApi = (
    params: { page?: number; size?: number; stage?: string; status?: string } = {},
): Promise<Monitor.PageResult<Monitor.Log>> =>
    http.get<Monitor.PageResult<Monitor.Log>>("/logs", params, { loading: false }) as any;

export const getLogStatsApi = (): Promise<Monitor.LogStats> =>
    http.get<Monitor.LogStats>("/logs/stats", {}, { loading: false }) as any;

export const clearLogsApi = (): Promise<{ message: string; clearedCount: number }> =>
    // 服务端要求 confirm=1 才执行（防误触/恶意调用）
    http.delete<{ message: string; clearedCount: number }>(
        "/logs",
        { confirm: "1" },
        { loading: false },
    ) as any;

// ===== 系统配置 =====
export const getConfigApi = (): Promise<Monitor.Config> =>
    http.get<Monitor.Config>("/config", {}, { loading: false }) as any;

export const saveConfigApi = (
    data: Record<string, string>,
): Promise<{ ok: boolean; message: string }> =>
    http.put<{ ok: boolean; message: string }>("/config", data, { loading: false }) as any;

// ===== 手动采集（细分，不含分析）=====
export const collectVideoApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/collect/videos", {}, { loading: false }) as any;
export const collectCommentApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/collect/comments", {}, { loading: false }) as any;
export const collectDynamicApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/collect/dynamics", {}, { loading: false }) as any;
export const collectAllApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/collect/all", {}, { loading: false }) as any;
// 兼容旧接口（只采集不分析）
export const triggerCollectApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/collect/trigger", {}, { loading: false }) as any;

// ===== 手动分析 =====
export const analyzePendingApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>(
        "/analyze/pending",
        {},
        { loading: false, timeout: 5000 },
    ) as any;
export const analyzeAllApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>(
        "/analyze/reanalyze-all",
        {},
        { loading: false, timeout: 5000 },
    ) as any;

export const stopAnalysisApi = (): Promise<{ message: string }> =>
    http.post<{ message: string }>("/analyze/abort", {}, { loading: false }) as any;

// ===== 情感分析评测（人工标注集 + 一致性对比）=====
export const runEvaluationApi = (): Promise<Monitor.EvaluationReport> =>
    http.post<Monitor.EvaluationReport>(
        "/analyze/evaluate",
        {},
        { loading: false, timeout: 300000 },
    ) as any;

// ===== AI 提供者管理 =====
export const getAIProvidersApi = (): Promise<Monitor.AIProvider[]> =>
    http.get<Monitor.AIProvider[]>("/ai-providers", {}, { loading: false }) as any;

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
    http.post<Monitor.AIProvider>("/ai-providers", data, { loading: false }) as any;

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
    http.put<{ ok: boolean }>(`/ai-providers/${id}`, data, { loading: false }) as any;

export const deleteAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
    http.delete<{ ok: boolean }>(`/ai-providers/${id}`, { loading: false }) as any;

export const setDefaultAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
    http.post<{ ok: boolean }>(`/ai-providers/${id}/set-default`, {}, { loading: false }) as any;

// ===== B站服务诊断 =====
export const getBiliStatusApi = (): Promise<Monitor.BiliStatus> =>
    http.get<Monitor.BiliStatus>("/bili/status", {}, { loading: false }) as any;
