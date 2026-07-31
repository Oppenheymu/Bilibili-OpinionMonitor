import { existsSync, readFileSync, statSync } from "node:fs";
import { Client } from "@renmu/bili-api";
import { 凭证路径, 扫码登录 } from "./login";

let 客户端实例: Client | null = null;

/**
 * 从凭证文件读取 Cookie 字符串（供字幕等需带 Cookie 的直连请求使用）
 * 凭证为 TvQrcodeLogin 产物：cookie_info.cookies = [{name, value, ...}]
 * 无凭证返回空串
 */
export async function 读取凭证Cookie(): Promise<string> {
    try {
        if (!existsSync(凭证路径)) return "";
        const 原始 = JSON.parse(readFileSync(凭证路径, "utf-8")) as {
            cookie_info?: { cookies?: { name: string; value: string }[] };
        };
        const 列表 = 原始?.cookie_info?.cookies ?? [];
        return 列表.map((c) => `${c.name}=${c.value}`).join("; ");
    } catch {
        return "";
    }
}

/**
 * 获取已登录的 B 站客户端单例。
 * 首次调用时若无凭证则触发扫码登录，随后加载凭证。
 */
export async function 获取客户端(): Promise<Client> {
    if (客户端实例) return 客户端实例;

    const client = new Client();
    if (!existsSync(凭证路径)) {
        console.log("[B站] 未检测到登录凭证，开始扫码登录流程");
        await 扫码登录();
    }
    await client.loadCookieFile(凭证路径);
    console.log("[B站] 凭证加载完成");
    客户端实例 = client;
    return client;
}

/**
 * 重置客户端单例（用于重新登录后刷新）
 */
export function 重置客户端(): void {
    客户端实例 = null;
}

/**
 * 诊断 B站连接状态，返回各指标快照
 */
export function 诊断状态(): {
    凭证存在: boolean;
    凭证路径: string;
    凭证大小: number | null;
    凭证修改时间: number | null;
    客户端已加载: boolean;
} {
    const 存在 = existsSync(凭证路径);
    let 大小: number | null = null;
    let 修改时间: number | null = null;
    if (存在) {
        const info = statSync(凭证路径);
        大小 = info.size;
        修改时间 = Math.floor(info.mtimeMs / 1000);
    }
    return {
        凭证存在: 存在,
        凭证路径,
        凭证大小: 大小,
        凭证修改时间: 修改时间,
        客户端已加载: 客户端实例 !== null,
    };
}
