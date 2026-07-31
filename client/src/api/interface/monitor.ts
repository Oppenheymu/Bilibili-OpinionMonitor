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

  /** 系统配置（密钥项返回"已配置"布尔，不回显明文） */
  export interface Config {
    LLM提供商: string;
    DeepSeek密钥已配置: boolean;
    DeepSeek模型: string;
    DeepSeek地址: string;
    Gemini密钥已配置: boolean;
    Gemini模型: string;
    Gemini地址: string;
    LLMTemperature: string;
    采集间隔分钟: string;
    单视频评论上限: string;
    视频采集页数: string;
    动态采集页数: string;
    分析批量大小: string;
  }
}
