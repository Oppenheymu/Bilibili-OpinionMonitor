import axios from "axios";
import { 获取客户端 } from "./client";
import type { 动态摘要, 评论列表结果, 评论条目, 视频详情, 视频摘要 } from "./types";

function 去除标签(文本: string): string {
    return 文本.replace(/<[^>]+>/g, "");
}

/**
 * 获取 UP 主投稿视频列表
 * @param mid UP 主 uid
 * @param 页数 抓取页数，每页 30 条
 */
export async function 获取UP主视频(mid: number, 页数 = 1): Promise<视频摘要[]> {
    const client = await 获取客户端();
    const 结果: 视频摘要[] = [];
    for (let 页 = 1; 页 <= 页数; 页++) {
        const res = await client.user.getVideos({ mid, pn: 页, ps: 30 });
        for (const v of res.list.vlist) {
            结果.push({
                bvid: v.bvid,
                aid: v.aid,
                标题: v.title,
                描述: v.description,
                UP主UID: v.mid,
                UP主名: v.author,
                发布时间: v.created,
                封面: v.pic,
                评论数: v.comment,
                播放量: v.play,
            });
        }
        if (res.list.vlist.length < 30) break;
    }
    return 结果;
}

/**
 * 按关键词搜索视频
 */
export async function 关键词搜索视频(关键词: string, 页数 = 1): Promise<视频摘要[]> {
    const client = await 获取客户端();
    const 结果: 视频摘要[] = [];
    for (let 页 = 1; 页 <= 页数; 页++) {
        const res = await client.search.type({
            search_type: "video",
            keyword: 关键词,
            order: "pubdate",
            page: 页,
        });
        const 列表: Record<string, unknown>[] = (res as { data?: { result?: Record<string, unknown>[] } }).data?.result ?? [];
        if (列表.length === 0) break;
        for (const v of 列表) {
            const bvid = v["bvid"] as string | undefined;
            if (!bvid) continue;
            结果.push({
                bvid,
                aid: Number(v["aid"] ?? 0),
                标题: 去除标签(String(v["title"] ?? "")),
                描述: String(v["description"] ?? ""),
                UP主UID: Number(v["mid"] ?? 0),
                UP主名: String(v["author"] ?? ""),
                发布时间: Number(v["pubdate"] ?? 0),
                封面: String(v["pic"] ?? ""),
                评论数: Number(v["review"] ?? 0),
                播放量: Number(v["play"] ?? 0),
            });
        }
        if (列表.length < 20) break;
    }
    return 结果;
}

/**
 * 从 B站评论中提取纯文本
 * 新版 API：content.message 可能是字符串或富文本数组 [{type:1,text:"..."}]
 * 旧版 API：顶层 message 字段（字符串）
 */
function 提取评论文本(原始: Record<string, unknown>): string {
    // 优先取 content.message（新版），回退到顶层 message（旧版）
    const 原始消息 = (原始["content"] as Record<string, unknown> | undefined)?.["message"] ?? 原始["message"];
    if (typeof 原始消息 === "string") return 原始消息;
    if (Array.isArray(原始消息)) {
        return 原始消息
            .filter((item) => item?.type === 1 && typeof item.text === "string")
            .map((item) => item.text)
            .join("");
    }
    return String(原始消息 ?? "");
}

function 提取评论(原始: Record<string, unknown>): 评论条目 {
    const member = (原始["member"] ?? {}) as Record<string, unknown>;
    return {
        rpid: Number(原始["rpid"] ?? 0),
        root: Number(原始["root"] ?? 0),
        parent: Number(原始["parent"] ?? 0),
        like: Number(原始["like"] ?? 0),
        rcount: Number(原始["rcount"] ?? 0),
        message: 提取评论文本(原始),
        ctime: Number(原始["ctime"] ?? 0),
        mid: Number(member["mid"] ?? 原始["mid"] ?? 0),
        uname: String(member["uname"] ?? ""),
        replies: null,
    };
}

/**
 * 获取视频评论（主评论 + 完整楼中楼回复）
 * @param aid 视频 aid
 * @param 上限 主评论最大采集数
 */
export async function 获取视频评论(aid: number, 上限 = 500): Promise<评论列表结果> {
    const client = await 获取客户端();
    const reply = client.reply;
    const 主评论列表: 评论条目[] = [];
    let 总数 = 0;
    let pn = 1;

    while (主评论列表.length < 上限) {
        const res = await reply.list({ oid: aid, type: 1, sort: 0, pn });
        // @renmu/bili-api 响应拦截器已解包到 response.data.data，res 即 { page, replies, ... }
        const data = (res?.data ?? res) as { page?: { count?: number }; replies?: Record<string, unknown>[] } | undefined;
        总数 = data?.page?.count ?? 总数;
        const replies = data?.replies ?? [];

        // 首页诊断日志：打印 API 返回结构，定位空评论根因
        if (pn === 1) {
            const 首条 = replies[0];
            console.log(
                `[评论] aid=${aid} 总数=${总数} 本页=${replies.length} ` +
                    `keys=${Object.keys(data ?? {}).join(",")} ` +
                    `首条keys=${首条 ? Object.keys(首条).join(",") : "无"} ` +
                    `content.message=${typeof (首条?.content as any)?.message} ` +
                    `message=${typeof 首条?.message}`,
            );
        }

        if (replies.length === 0) break;

        for (const r of replies) {
            const 条目 = 提取评论(r);
            const 预览 = (r["replies"] as Record<string, unknown>[] | null) ?? [];
            条目.replies = 预览.map(提取评论);

            // 回复数大于预览数时，拉取完整楼中楼
            if (条目.rcount > 预览.length && 条目.rcount > 0) {
                条目.replies = await 获取楼中楼(aid, 条目.rpid);
            }
            主评论列表.push(条目);
        }

        pn++;
        if (replies.length < 20) break;
    }

    return { 总数, 主评论: 主评论列表 };
}

/**
 * 获取某条评论的完整楼中楼回复
 */
async function 获取楼中楼(aid: number, root: number): Promise<评论条目[]> {
    const 结果: 评论条目[] = [];
    let pn = 1;
    while (true) {
        try {
            const { data } = await axios.get("https://api.bilibili.com/x/v2/reply/reply", {
                params: { oid: aid, root, pn, ps: 20, type: 1 },
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                    Referer: "https://www.bilibili.com",
                },
                timeout: 10000,
            });
            const replies = ((data as { data?: { replies?: Record<string, unknown>[] } }).data?.replies) ?? [];
            if (replies.length === 0) break;
            for (const r of replies) 结果.push(提取评论(r));
            if (replies.length < 20) break;
            pn++;
        } catch {
            break;
        }
    }
    return 结果;
}

function 提取动态正文(item: Record<string, unknown>): string {
    const modules = (item["modules"] ?? {}) as Record<string, unknown>;
    const 动态模块 = (modules["module_dynamic"] ?? {}) as Record<string, unknown>;
    const desc = (动态模块["desc"] ?? {}) as Record<string, unknown>;
    if (desc["text"]) return String(desc["text"]);

    const major = (动态模块["major"] ?? {}) as Record<string, unknown>;
    const archive = (major["archive"] ?? {}) as Record<string, unknown>;
    if (archive["title"]) return `[视频] ${String(archive["title"])}`;
    const article = (major["article"] ?? {}) as Record<string, unknown>;
    if (article["title"]) return `[专栏] ${String(article["title"])}`;
    return "";
}

/**
 * 获取 UP 主动态列表
 * @param mid UP 主 uid
 * @param 页数 抓取页数
 */
export async function 获取UP主动态(mid: number, 页数 = 1): Promise<动态摘要[]> {
    const client = await 获取客户端();
    const 结果: 动态摘要[] = [];
    let offset: number | undefined;

    for (let 页 = 1; 页 <= 页数; 页++) {
        const res = await client.user.space(mid, offset);
        // 兼容 @renmu/bili-api 不同版本返回结构：可能已解包（res 直接含 items/offset）或未解包（res.data 含）
        const dataObj = ((res?.data ?? res) ?? {}) as { items?: Record<string, unknown>[]; offset?: number };
        const items = dataObj.items ?? [];
        if (items.length === 0) break;

        for (const item of items) {
            const modules = (item["modules"] ?? {}) as Record<string, unknown>;
            const 作者模块 = (modules["module_author"] ?? {}) as Record<string, unknown>;
            结果.push({
                动态ID: String(item["id_str"] ?? ""),
                类型: String(item["type"] ?? ""),
                正文: 提取动态正文(item),
                发布时间: Number(作者模块["pub_ts"] ?? 0),
            });
        }

        offset = dataObj.offset;
        if (!offset) break;
    }
    return 结果;
}

/**
 * 获取视频详情（含播放/点赞等统计指标）
 */
export async function 获取视频详情(aid: number): Promise<视频详情> {
    const client = await 获取客户端();
    const video = await client.newVideo(aid);
    const res = await video.detail({ aid });
    const view = res.View;
    return {
        aid: view.aid,
        bvid: view.bvid,
        标题: view.title,
        描述: view.desc,
        UP主UID: view.owner.mid,
        UP主名: view.owner.name,
        分区ID: view.tid,
        分区名: view.tname,
        发布时间: view.pubdate,
        时长: view.duration,
        封面: view.pic,
        统计: {
            播放量: view.stat.view,
            弹幕数: view.stat.danmaku,
            评论数: view.stat.reply,
            收藏数: view.stat.favorite,
            硬币数: view.stat.coin,
            分享数: view.stat.share,
            点赞数: view.stat.like,
        },
    };
}
