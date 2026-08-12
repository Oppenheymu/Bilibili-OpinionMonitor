/**
 * 数据访问层聚合出口（barrel）
 * 按职责拆分到子模块，此处仅 re-export，保持调用方 `import * as 库` 兼容：
 * - 采集写入:  collection-write.ts（任务启用/保存视频/评论/动态/情感/日志/未分析查询）
 * - 任务管理:  task-management.ts（任务 CRUD / 清空评论 / 删除情感）
 * - 查询:      queries.ts（列表分页 / 计数 / 统计概览 / 情感分布与趋势 / 日志统计）
 * - 配置:      config.ts（系统配置键值对 + 缓存）
 * - AI提供者:  ai-providers.ts（LLM 服务商 CRUD + 默认提供者）
 */

export * from "./ai-providers";
export * from "./collection-write";
export * from "./config";
export * from "./queries";
export * from "./task-management";
