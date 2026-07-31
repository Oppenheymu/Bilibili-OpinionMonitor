/**
 * B 站评论条目（从接口返回中提取的精简结构）
 */
export interface 评论条目 {
    rpid: number;
    root: number;
    parent: number;
    like: number;
    rcount: number;
    message: string;
    ctime: number;
    mid: number;
    uname: string;
    replies: 评论条目[] | null;
}

/**
 * 视频评论采集结果
 */
export interface 评论列表结果 {
    总数: number;
    主评论: 评论条目[];
}

/**
 * 视频摘要（来自投稿列表或搜索结果）
 */
export interface 视频摘要 {
    bvid: string;
    aid: number;
    标题: string;
    描述: string;
    UP主UID: number;
    UP主名: string;
    发布时间: number;
    封面: string;
    评论数: number;
    播放量: number;
}

/**
 * 动态摘要
 */
export interface 动态摘要 {
    动态ID: string;
    类型: string;
    正文: string;
    发布时间: number;
}

/**
 * 视频详情含统计指标
 */
export interface 视频详情 {
    aid: number;
    bvid: string;
    标题: string;
    描述: string;
    UP主UID: number;
    UP主名: string;
    分区ID: number;
    分区名: string;
    发布时间: number;
    时长: number;
    封面: string;
    字幕: string; // B站 AI 字幕转纯文本（可为空串）
    统计: {
        播放量: number;
        弹幕数: number;
        评论数: number;
        收藏数: number;
        硬币数: number;
        分享数: number;
        点赞数: number;
    };
}
