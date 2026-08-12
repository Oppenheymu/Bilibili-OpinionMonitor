/**
 * B 站评论条目（从接口返回中提取的精简结构）
 */
export interface CommentItem {
    rpid: number;
    root: number;
    parent: number;
    like: number;
    rcount: number;
    message: string;
    ctime: number;
    mid: number;
    uname: string;
    replies: CommentItem[] | null;
}

/**
 * 视频评论采集结果
 */
export interface CommentListResult {
    total: number;
    mainComments: CommentItem[];
}

/**
 * 视频摘要（来自投稿列表或搜索结果）
 */
export interface VideoSummary {
    bvid: string;
    aid: number;
    title: string;
    description: string;
    upUid: number;
    upName: string;
    publishTime: number;
    cover: string;
    commentCount: number;
    viewCount: number;
}

/**
 * 动态摘要
 */
export interface DynamicSummary {
    dynamicId: string;
    type: string;
    content: string;
    publishTime: number;
}

/**
 * 视频详情含统计指标
 */
export interface VideoDetail {
    aid: number;
    bvid: string;
    title: string;
    description: string;
    upUid: number;
    upName: string;
    partitionId: number;
    partitionName: string;
    publishTime: number;
    duration: number;
    cover: string;
    subtitle: string; // B站 AI 字幕转纯文本（可为空串）
    stats: {
        views: number;
        danmaku: number;
        comments: number;
        favorites: number;
        coins: number;
        shares: number;
        likes: number;
    };
}
