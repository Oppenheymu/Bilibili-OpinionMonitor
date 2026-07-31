import http from "@/api";
import { Monitor } from "@/api/interface/monitor";

/**
 * @description 舆情监控业务接口（对接 Hono 服务端，接口路径为中文）
 *  服务端直接返回数据（无 code/msg/data 包裹），已在响应拦截器中适配
 */

// ===== 任务管理 =====
export const getTaskListApi = (): Promise<Monitor.Task[]> =>
  http.get<Monitor.Task[]>("/任务", {}, { loading: false }) as any;

export const createTaskApi = (类型: string, 目标: string) => http.post<Monitor.Task>("/任务", { 类型, 目标 }) as any;

export const updateTaskApi = (任务ID: number, 启用: boolean) =>
  http.patch<{ ok: boolean }>(`/任务/${任务ID}`, { 启用 }) as any;

export const deleteTaskApi = (任务ID: number) => http.delete<{ ok: boolean }>(`/任务/${任务ID}`) as any;

// ===== 统计 =====
export const getOverviewApi = (): Promise<Monitor.OverviewStats> =>
  http.get<Monitor.OverviewStats>("/统计/概览", {}, { loading: false }) as any;

export const getSentimentDistApi = (): Promise<Monitor.SentimentDist[]> =>
  http.get<Monitor.SentimentDist[]>("/统计/情感分布", {}, { loading: false }) as any;

export const getTrendApi = (天数 = 7): Promise<Monitor.Trend[]> =>
  http.get<Monitor.Trend[]>("/统计/趋势", { 天数 }, { loading: false }) as any;

// ===== 内容查询 =====
export const getCommentListApi = (params: {
  页?: number; 大小?: number; 情感?: string; 视频ID?: number; 搜索?: string;
}): Promise<Monitor.分页结果<Monitor.Comment>> =>
  http.get<Monitor.分页结果<Monitor.Comment>>("/评论", params, { loading: false }) as any;

export const clearAllCommentsApi = (): Promise<{ 消息: string; 评论: number; 情感分析: number }> =>
  http.delete<{ 消息: string; 评论: number; 情感分析: number }>("/评论", {}, { loading: false }) as any;

export const getVideoListApi = (页 = 1, 大小 = 20): Promise<Monitor.分页结果<Monitor.Video>> =>
  http.get<Monitor.分页结果<Monitor.Video>>("/视频", { 页, 大小 }, { loading: false }) as any;

export const getDynamicListApi = (页 = 1, 大小 = 20): Promise<Monitor.分页结果<Monitor.Dynamic>> =>
  http.get<Monitor.分页结果<Monitor.Dynamic>>("/动态", { 页, 大小 }, { loading: false }) as any;

export const getLogListApi = (params: {
  页?: number; 大小?: number; 阶段?: string; 状态?: string;
} = {}): Promise<Monitor.分页结果<Monitor.Log>> =>
  http.get<Monitor.分页结果<Monitor.Log>>("/日志", params, { loading: false }) as any;

export const getLogStatsApi = (): Promise<Monitor.日志统计> =>
  http.get<Monitor.日志统计>("/日志/统计", {}, { loading: false }) as any;

export const clearLogsApi = (): Promise<{ 消息: string; 清空数: number }> =>
  http.delete<{ 消息: string; 清空数: number }>("/日志", {}, { loading: false }) as any;

// ===== 系统配置 =====
export const getConfigApi = (): Promise<Monitor.Config> =>
  http.get<Monitor.Config>("/配置", {}, { loading: false }) as any;

export const saveConfigApi = (data: Record<string, string>): Promise<{ ok: boolean; 消息: string }> =>
  http.put<{ ok: boolean; 消息: string }>("/配置", data, { loading: false }) as any;

// ===== 手动采集（细分，不含分析）=====
export const collectVideoApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/视频", {}, { loading: false }) as any;
export const collectCommentApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/评论", {}, { loading: false }) as any;
export const collectDynamicApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/动态", {}, { loading: false }) as any;
export const collectAllApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/全部", {}, { loading: false }) as any;
// 兼容旧接口（只采集不分析）
export const triggerCollectApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/触发", {}, { loading: false }) as any;

// ===== 手动分析 =====
export const analyzePendingApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/分析/未处理", {}, { loading: false, timeout: 5000 }) as any;
export const analyzeAllApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/分析/重新全部", {}, { loading: false, timeout: 5000 }) as any;

export const stopAnalysisApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/分析/中止", {}, { loading: false }) as any;

// ===== AI 提供者管理 =====
export const getAIProvidersApi = (): Promise<Monitor.AI提供者[]> =>
  http.get<Monitor.AI提供者[]>("/AI提供者", {}, { loading: false }) as any;

export const createAIProviderApi = (data: {
  名称: string; 提供商标识: string; API密钥: string;
  API地址: string; 模型: string; 温度: number; 系统提示词?: string | null; 最大令牌?: number;
  启用: boolean; 是否默认: boolean; 排序: number;
}): Promise<Monitor.AI提供者> =>
  http.post<Monitor.AI提供者>("/AI提供者", data, { loading: false }) as any;

export const updateAIProviderApi = (id: number, data: Partial<{
  名称: string; 提供商标识: string; API密钥: string;
  API地址: string; 模型: string; 温度: number; 系统提示词?: string | null; 最大令牌: number;
  启用: boolean; 是否默认: boolean; 排序: number;
}>): Promise<{ ok: boolean }> =>
  http.put<{ ok: boolean }>(`/AI提供者/${id}`, data, { loading: false }) as any;

export const deleteAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
  http.delete<{ ok: boolean }>(`/AI提供者/${id}`, { loading: false }) as any;

export const setDefaultAIProviderApi = (id: number): Promise<{ ok: boolean }> =>
  http.post<{ ok: boolean }>(`/AI提供者/${id}/设为默认`, {}, { loading: false }) as any;

// ===== B站服务诊断 =====
export const getB站状态Api = (): Promise<Monitor.B站状态> =>
  http.get<Monitor.B站状态>("/B站/状态", {}, { loading: false }) as any;
