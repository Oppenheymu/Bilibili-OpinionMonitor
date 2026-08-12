import { existsSync, readFileSync, statSync } from "node:fs";
import { Client } from "@renmu/bili-api";
import { credentialPath, scanLogin } from "./login";

let clientInstance: Client | null = null;

/**
 * 从凭证文件读取 Cookie 字符串（供字幕等需带 Cookie 的直连请求使用）
 * 凭证为 TvQrcodeLogin 产物：cookie_info.cookies = [{name, value, ...}]
 * 无凭证返回空串
 */
export async function readCredentialCookie(): Promise<string> {
    try {
        if (!existsSync(credentialPath)) return "";
        const raw = JSON.parse(readFileSync(credentialPath, "utf-8")) as {
            cookie_info?: { cookies?: { name: string; value: string }[] };
        };
        const list = raw?.cookie_info?.cookies ?? [];
        return list.map((c) => `${c.name}=${c.value}`).join("; ");
    } catch {
        return "";
    }
}

/**
 * 获取已登录的 B 站客户端单例。
 * 首次调用时若无凭证则触发扫码登录，随后加载凭证。
 */
export async function getClient(): Promise<Client> {
    if (clientInstance) return clientInstance;

    const client = new Client();
    if (!existsSync(credentialPath)) {
        console.log("[B站] 未检测到登录凭证，开始扫码登录流程");
        await scanLogin();
    }
    await client.loadCookieFile(credentialPath);
    console.log("[B站] 凭证加载完成");
    clientInstance = client;
    return client;
}

/**
 * 重置客户端单例（用于重新登录后刷新）
 */
export function resetClient(): void {
    clientInstance = null;
}

/**
 * 诊断 B站连接状态，返回各指标快照
 */
export function getDiagnostics(): {
    credentialExists: boolean;
    credentialPath: string;
    credentialSize: number | null;
    credentialModifiedAt: number | null;
    clientLoaded: boolean;
} {
    const exists = existsSync(credentialPath);
    let size: number | null = null;
    let modifiedAt: number | null = null;
    if (exists) {
        const info = statSync(credentialPath);
        size = info.size;
        modifiedAt = Math.floor(info.mtimeMs / 1000);
    }
    return {
        credentialExists: exists,
        credentialPath,
        credentialSize: size,
        credentialModifiedAt: modifiedAt,
        clientLoaded: clientInstance !== null,
    };
}
