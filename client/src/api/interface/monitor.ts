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
