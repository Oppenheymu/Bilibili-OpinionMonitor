import { getClient, readCredentialCookie } from "./client";
import { controlledRequest } from "./rateLimit";
import type {
    CommentItem,
    CommentListResult,
    DynamicSummary,
    VideoDetail,
    VideoSummary,
} from "./types";

function stripTags(text: string): string {
    return text.replace(/<[^>]+>/g, "");
}

/**
 * 获取 UP 主投稿视频列表
 * @param mid UP 主 uid
 * @param pages 抓取页数，每页 30 条
 */
export async function fetchUpVideos(mid: number, pages = 1): Promise<VideoSummary[]> {
    const client = await getClient();
    const result: VideoSummary[] = [];
    for (let page = 1; page <= pages; page++) {
        const res = await controlledRequest(
            () => client.user.getVideos({ mid, pn: page, ps: 30 }),
            `UP主视频 mid=${mid} pn=${page}`,
        );
        for (const v of res.list.vlist) {
            result.push({
                bvid: v.bvid,
                aid: v.aid,
                title: v.title,
                description: v.description,
                upUid: v.mid,
                upName: v.author,
                publishTime: v.created,
                cover: v.pic,
                commentCount: v.comment,
                viewCount: v.play,
            });
        }
        if (res.list.vlist.length < 30) break;
    }
    return result;
}

/**
 * 按关键词搜索视频
 */
export async function searchVideosByKeyword(keyword: string, pages = 1): Promise<VideoSummary[]> {
    const client = await getClient();
    const result: VideoSummary[] = [];
    for (let page = 1; page <= pages; page++) {
        const res = await controlledRequest(
            () =>
                client.search.type({
                    search_type: "video",
                    keyword,
                    order: "pubdate",
                    page,
                }),
            `关键词搜索「${keyword}」 pn=${page}`,
        );
        const list: Record<string, unknown>[] =
            (res as { data?: { result?: Record<string, unknown>[] } }).data?.result ?? [];
        if (list.length === 0) break;
        for (const v of list) {
            const video = extractSearchVideo(v);
            if (video) result.push(video);
        }
        if (list.length < 20) break;
    }
    return result;
}

/** 解析单条搜索结果 → VideoSummary（bvid 缺失返回 undefined） */
function extractSearchVideo(v: Record<string, unknown>): VideoSummary | undefined {
    const bvid = v["bvid"] as string | undefined;
    if (!bvid) return undefined;
    return {
        bvid,
        aid: Number(v["aid"] ?? 0),
        title: stripTags(String(v["title"] ?? "")),
        description: String(v["description"] ?? ""),
        upUid: Number(v["mid"] ?? 0),
        upName: String(v["author"] ?? ""),
        publishTime: Number(v["pubdate"] ?? 0),
        cover: String(v["pic"] ?? ""),
        commentCount: Number(v["review"] ?? 0),
        viewCount: Number(v["play"] ?? 0),
    };
}

/**
 * 从 B站评论中提取纯文本
 * 新版 API：content.message 可能是字符串或富文本数组 [{type:1,text:"..."}]
 * 旧版 API：顶层 message 字段（字符串）
 */
function extractCommentText(raw: Record<string, unknown>): string {
    // 优先取 content.message（新版），回退到顶层 message（旧版）
    const rawMessage =
        (raw["content"] as Record<string, unknown> | undefined)?.["message"] ?? raw["message"];
    if (typeof rawMessage === "string") return rawMessage;
    if (Array.isArray(rawMessage)) {
        return rawMessage
            .filter((item) => item?.type === 1 && typeof item.text === "string")
            .map((item) => item.text)
            .join("");
    }
    return String(rawMessage ?? "");
}

function extractComment(raw: Record<string, unknown>): CommentItem {
    const member = (raw["member"] ?? {}) as Record<string, unknown>;
    return {
        rpid: Number(raw["rpid"] ?? 0),
        root: Number(raw["root"] ?? 0),
        parent: Number(raw["parent"] ?? 0),
        like: Number(raw["like"] ?? 0),
        rcount: Number(raw["rcount"] ?? 0),
        message: extractCommentText(raw),
        ctime: Number(raw["ctime"] ?? 0),
        mid: Number(member["mid"] ?? raw["mid"] ?? 0),
        uname: String(member["uname"] ?? ""),
        replies: null,
    };
}

/**
 * 获取视频评论（主评论 + 完整楼中楼回复）
 * @param aid 视频 aid
 * @param limit 主评论最大采集数
 */
export async function fetchVideoComments(aid: number, limit = 500): Promise<CommentListResult> {
    const client = await getClient();
    const reply = client.reply;
    const mainComments: CommentItem[] = [];
    let total = 0;
    let pn = 1;

    while (mainComments.length < limit) {
        const res = await controlledRequest(
            () => reply.list({ oid: aid, type: 1, sort: 0, pn }),
            `评论列表 aid=${aid} pn=${pn}`,
        );
        // @renmu/bili-api 响应拦截器已解包到 response.data.data，res 即 { page, replies, ... }
        const data = (res?.["data"] ?? res) as
            | { page?: { count?: number }; replies?: Record<string, unknown>[] }
            | undefined;
        total = data?.page?.count ?? total;
        const replies = data?.replies ?? [];
        if (replies.length === 0) break;

        for (const r of replies) {
            const item = extractComment(r);
            const preview = (r["replies"] as Record<string, unknown>[] | null) ?? [];
            item.replies = preview.map(extractComment);

            // 回复数大于预览数时，拉取完整楼中楼
            if (item.rcount > preview.length && item.rcount > 0) {
                item.replies = await fetchReplies(aid, item.rpid);
            }
            mainComments.push(item);
        }

        pn++;
        if (replies.length < 20) break;
    }

    return { total, mainComments };
}

/**
 * 获取某条评论的完整楼中楼回复（走受控请求：限速 + 重试 + 风控降速）
 * 原实现失败即 break 静默截断，现改为抛错交给受控请求层重试
 */
async function fetchReplies(aid: number, root: number): Promise<CommentItem[]> {
    const result: CommentItem[] = [];
    let pn = 1;
    while (true) {
        const response = await controlledRequest(async () => {
            const res = await fetch(
                `https://api.bilibili.com/x/v2/reply/reply?oid=${aid}&root=${root}&pn=${pn}&ps=20&type=1`,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                        referer: "https://www.bilibili.com",
                    },
                    signal: AbortSignal.timeout(10000),
                },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as {
                code?: number;
                message?: string;
                data?: { replies?: Record<string, unknown>[] };
            };
            // B站业务错误码（-412 风控 / -352 验证码等）抛出让重试层处理
            if (data.code && data.code !== 0) {
                throw new Error(`楼中楼业务错误 code=${data.code} ${data.message ?? ""}`);
            }
            return data;
        }, `楼中楼 aid=${aid} root=${root} pn=${pn}`);
        const replies = response?.data?.replies ?? [];
        if (replies.length === 0) break;
        for (const r of replies) result.push(extractComment(r));
        if (replies.length < 20) break;
        pn++;
    }
    return result;
}

function extractDynamicContent(item: Record<string, unknown>): string {
    const modules = (item["modules"] ?? {}) as Record<string, unknown>;
    const dynamicModule = (modules["module_dynamic"] ?? {}) as Record<string, unknown>;
    const desc = (dynamicModule["desc"] ?? {}) as Record<string, unknown>;
    if (desc["text"]) return String(desc["text"]);

    const major = (dynamicModule["major"] ?? {}) as Record<string, unknown>;
    const archive = (major["archive"] ?? {}) as Record<string, unknown>;
    if (archive["title"]) return `[视频] ${String(archive["title"])}`;
    const article = (major["article"] ?? {}) as Record<string, unknown>;
    if (article["title"]) return `[专栏] ${String(article["title"])}`;
    return "";
}

/**
 * 获取 UP 主动态列表
 * @param mid UP 主 uid
 * @param pages 抓取页数
 */
export async function fetchUpDynamics(mid: number, pages = 1): Promise<DynamicSummary[]> {
    const client = await getClient();
    const result: DynamicSummary[] = [];
    let offset: number | undefined;

    for (let page = 1; page <= pages; page++) {
        const res = await controlledRequest(
            () => client.user.space(mid, offset),
            `UP主动态 mid=${mid} pn=${page}`,
        );
        // 兼容 @renmu/bili-api 不同版本返回结构：可能已解包（res 直接含 items/offset）或未解包（res.data 含）
        const dataObj = (res?.data ?? res ?? {}) as {
            items?: Record<string, unknown>[];
            offset?: number;
        };
        const items = dataObj.items ?? [];
        if (items.length === 0) break;

        for (const item of items) {
            const modules = (item["modules"] ?? {}) as Record<string, unknown>;
            const authorModule = (modules["module_author"] ?? {}) as Record<string, unknown>;
            result.push({
                dynamicId: String(item["id_str"] ?? ""),
                type: String(item["type"] ?? ""),
                content: extractDynamicContent(item),
                publishTime: Number(authorModule["pub_ts"] ?? 0),
            });
        }

        offset = dataObj.offset;
        if (!offset) break;
    }
    return result;
}

/**
 * 抓取 B站 AI 字幕并转纯文本
 * 用 player/wbi/v2 接口（bili-api 的 playerInfo，内置 wbi 签名 + 登录 cookie）拿字幕列表，
 * 取 AI 中文字幕（ai_type=1），拉取 JSON 拼成纯文本作为视频内容上下文。
 * 失败（无字幕/未登录/网络）返回空串，不阻断主流程。
 */
async function fetchAiSubtitle(aid: number, bvid: string): Promise<string> {
    try {
        const client = await getClient();
        const video = await client.newVideo(aid);
        // playerInfo 需要 cid（分P ID），先取分P列表（pagelist 返回数组）
        const pages = await controlledRequest(() => video.pagelist({ aid }), `分P列表 aid=${aid}`, {
            retries: 1,
        });
        // pagelist 实际返回 [{ cid, page, part, ... }] 数组
        const pagesArray = Array.isArray(pages)
            ? pages
            : [(pages as Record<string, any>)?.["data"]].filter(Boolean);
        const cid = Number(pagesArray?.[0]?.["cid"] ?? 0);
        if (!cid) return "";
        const playerInfo = await controlledRequest(
            () => video.playerInfo({ aid, cid }),
            `播放信息 aid=${aid}`,
            { retries: 1 },
        );
        // PlayerInfoReturnType: subtitle.subtitles[]，ai_type=1 为 AI 字幕
        const subtitleList: Record<string, any>[] =
            (playerInfo as Record<string, any>)?.["subtitle"]?.["subtitles"] ?? [];
        if (subtitleList.length === 0) return "";
        // 优先 AI 中文字幕（ai_type=1），否则取第一个可用的
        const subtitleItem =
            subtitleList.find(
                (s) =>
                    s["ai_type"] === 1 &&
                    String(s["lan"] ?? "")
                        .toLowerCase()
                        .startsWith("ai-zh"),
            ) ??
            subtitleList.find((s) => s["ai_type"] === 1) ??
            subtitleList[0];
        const rawUrl = subtitleItem?.["subtitle_url"] ?? subtitleItem?.["subtitle_url_v2"];
        if (!rawUrl) return "";
        // 接口返回的是协议相对 URL（//aisubtitle.hdslb.com/...），补全 https:
        const url = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
        // 字幕接口要求带 Referer 和登录 Cookie
        const cookie = await readCredentialCookie();
        const response = await controlledRequest(
            () =>
                fetch(url, {
                    headers: {
                        referer: `https://www.bilibili.com/video/${bvid}`,
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                        ...(cookie ? { cookie: cookie } : {}),
                    },
                }).then(async (r) => {
                    if (!r.ok) throw new Error(`字幕拉取 HTTP ${r.status}`);
                    return (await r.json()) as { body?: { content?: string }[] };
                }),
            `AI字幕 ${bvid}`,
            { retries: 1 },
        );
        const body = response?.body ?? [];
        const plainText = body
            .map((s) =>
                String(s?.content ?? "")
                    .replace(/\s+/g, " ")
                    .trim(),
            )
            .filter(Boolean)
            .join(" ");
        return plainText.trim();
    } catch (e) {
        console.warn(
            `[B站] 视频 ${bvid} 字幕获取失败（跳过）：`,
            e instanceof Error ? e.message : e,
        );
        return "";
    }
}

/**
 * 获取视频详情（含播放/点赞等统计指标 + AI 字幕）
 */
export async function fetchVideoDetail(aid: number): Promise<VideoDetail> {
    const client = await getClient();
    const video = await client.newVideo(aid);
    const res = await controlledRequest(() => video.detail({ aid }), `视频详情 aid=${aid}`);
    const view = res.View;
    const subtitle = await fetchAiSubtitle(aid, view.bvid);
    return {
        aid: view.aid,
        bvid: view.bvid,
        title: view.title,
        description: view.desc,
        upUid: view.owner.mid,
        upName: view.owner.name,
        partitionId: view.tid,
        partitionName: view.tname,
        publishTime: view.pubdate,
        duration: view.duration,
        cover: view.pic,
        subtitle,
        stats: {
            views: view.stat.view,
            danmaku: view.stat.danmaku,
            comments: view.stat.reply,
            favorites: view.stat.favorite,
            coins: view.stat.coin,
            shares: view.stat.share,
            likes: view.stat.like,
        },
    };
}
