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
export const getCommentListApi = (params: { 页?: number; 大小?: number; 情感?: string; 视频ID?: number }): Promise<Monitor.Comment[]> =>
  http.get<Monitor.Comment[]>("/评论", params, { loading: false }) as any;

export const getDynamicListApi = (页 = 1, 大小 = 20): Promise<Monitor.Dynamic[]> =>
  http.get<Monitor.Dynamic[]>("/动态", { 页, 大小 }, { loading: false }) as any;

export const getLogListApi = (页 = 1, 大小 = 20): Promise<Monitor.Log[]> =>
  http.get<Monitor.Log[]>("/日志", { 页, 大小 }, { loading: false }) as any;

// ===== 手动触发采集 =====
export const triggerCollectApi = (): Promise<{ 消息: string }> =>
  http.post<{ 消息: string }>("/采集/触发", {}, { loading: false }) as any;
