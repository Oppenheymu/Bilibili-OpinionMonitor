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

  /** 评论 */
  export interface Comment {
    评论ID: number;
    rpid: number;
    视频ID: number;
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
}
