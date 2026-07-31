/**
 * @description 舆情监控业务接口类型定义
 */
export namespace Monitor {
  /** 监控任务 */
  export interface Task {
    任务ID: number;
    类型: string;
    目标: string;
    启用: boolean;
    创建时间: number;
    最后采集时间: number | null;
  }

  /** 概览统计 */
  export interface OverviewStats {
    视频总数: number;
    评论总数: number;
    动态总数: number;
    已删除评论: number; // 墓碑机制：被删/封禁/精选过滤的评论数
    已分析评论: number;
    情感分布: Record<string, number>;
  }

  /** 情感分布项 */
  export interface SentimentDist {
    倾向: string;
    数: number;
  }

  /** 趋势项 */
  export interface Trend {
    日期: string;
    评论数: number;
    平均分数: number;
  }

  /** 话题统计项（舆论分析：话题 × 情感交叉） */
  export interface 话题统计项 {
    话题: string;
    数: number;
    正面数: number;
    负面数: number;
    中性数: number;
    负面占比: number; // 0~1
  }

  /** 情感分析评测报告 */
  export interface 评测报告 {
    倾向: {
      模型: string;
      样本总数: number;
      正确数: number;
      准确率: number; // 0~1
      "准确率95%置信区间": [number, number];
      宏平均F1: number;
      各类别: { 类别: string; 样本数: number; 精确率: number; 召回率: number; F1: number }[];
      语境细分: { 语境: string; 样本数: number; 正确数: number; 准确率: number }[];
      分数准确率: number;
      全部样本: {
        内容: string; 说明: string; 期望: string; 实际: string;
        期望分数范围: [number, number]; 实际分数: number;
        倾向正确: boolean; 分数正确: boolean;
      }[];
    };
    一致性: {
      模型: string;
      样本数: number;
      倾向一致率: number;
      分数平均绝对差: number;
      不一致样本: { 内容: string; 单条: string; 批量: string; 单条分数: number; 批量分数: number }[];
    };
  }

  /** 加权情感指数报告（点赞×讨论热度权重） */
  export interface 加权情感报告 {
    加权情感指数: number; // -100 ~ 100
    简单情感指数: number; // 纯计数对比
    参与加权评论数: number;
    高赞评论数: number; // 点赞 >= 1000
    极端负面高赞数: number; // 点赞 >= 1000 且分数 <= -60
    加权分布: Record<string, number>;
  }

  /** LLM 容错状态（熔断/预算/采样） */
  export interface 容错状态 {
    熔断: { 熔断中: boolean; 剩余秒: number };
    预算: { 预算: number | null; 已用: number; 剩余: number | null };
    采样: { 已采样: number; 已跳过: number; 阈值分数: number };
  }

  /** @description 分页响应 */
  export interface 分页结果<T> {
    列表: T[];
    总数: number;
  }

  /** 视频 */
  export interface Video {
    视频ID: number;
    BV号: string;
    AV号: number;
    标题: string;
    描述: string;
    UP主UID: number;
    UP主名: string;
    分区ID: number;
    分区名: string;
    发布时间: number | null;
    时长: number;
    封面: string;
    来源任务ID: number | null;
    采集时间: number;
  }

  /** 评论 */
  export interface Comment {
    评论ID: number;
    rpid: number;
    视频ID: number;
    视频标题: string | null;
    BV号: string | null;
    用户UID: number;
    用户名: string;
    内容: string;
    点赞数: number;
    回复数: number;
    发布时间: number;
    是否楼中楼: boolean;
    是否已删除: boolean; // 墓碑机制：被删除/封禁/精选过滤
    删除时间: number | null;
    情感倾向: string | null;
    情感分数: number | null;
  }

  /** 动态 */
  export interface Dynamic {
    动态ID: number;
    动态ID_str: string;
    UP主UID: number;
    类型: string;
    正文: string;
    发布时间: number;
    采集时间: number;
  }

  /** 采集日志 */
  export interface Log {
    日志ID: number;
    任务ID: number | null;
    阶段: string;
    状态: string;
    采集数量: number;
    耗时毫秒: number;
    错误信息: string | null;
    时间: number;
  }

  /** 日志统计 */
  export interface 日志统计 {
    总计: number;
    成功数: number;
    失败数: number;
    进行中数: number;
    按阶段: { 阶段: string; 数: number; 成功: number; 失败: number }[];
  }

  /** 控制台日志条目（SSE 推送） */
  export interface 控制台日志条目 {
    时间: string;
    级别: "log" | "warn" | "error";
    内容: string;
  }

  /** 分析进度事件（SSE 推送） */
  export interface 分析进度 {
    类型: "分析进度";
    已分析: number;
    总数: number;
    失败: number;
    批次: number;
    模型: string;
    思考: string;
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
  export interface AI提供者 {
    提供者ID: number;
    名称: string;
    提供商标识: string;
    API密钥: string;
    API地址: string;
    模型: string;
    系统提示词: string | null;
    温度: number;
    最大令牌: number | null;
    启用: boolean;
    是否默认: boolean;
    排序: number;
    创建时间: number;
  }

  /** B站服务诊断状态 */
  export interface B站用户信息 {
    mid: number;
    昵称: string;
    头像: string;
    等级: number;
    性别: string;
    签名: string;
    VIP: boolean;
  }

  export interface B站状态 {
    凭证存在: boolean;
    凭证路径: string;
    凭证大小: number | null;
    凭证修改时间: number | null;
    客户端已加载: boolean;
    用户信息: B站用户信息 | null;
    数据摘要: {
      视频数: number;
      评论数: number;
      动态数: number;
      日志数: number;
      情感分析数: number;
    };
  }
}
