import { existsSync } from "node:fs";
import { Client } from "@renmu/bili-api";
import { 凭证路径, 扫码登录 } from "./login";

let 客户端实例: Client | null = null;

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
