import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TvQrcodeLogin } from "@renmu/bili-api";
import qrcode from "qrcode-terminal";

export const 凭证路径 = process.env["B站凭证路径"] ?? "./data/bili-凭证.json";

/**
 * 发起 TV 端扫码登录，二维码打印到终端；成功后凭证写入缓存文件
 */
export async function 扫码登录(): Promise<void> {
    const 登录器 = new TvQrcodeLogin();
    const 二维码地址 = await 登录器.login();

    console.log("[B站登录] 请使用哔哩哔哩 APP 扫描下方二维码确认登录：");
    qrcode.generate(二维码地址, { small: true }, (图案) => console.log(图案));

    return new Promise((resolve, reject) => {
        登录器.on("scan", () => console.log("[B站登录] 已扫描，请在 APP 点击确认"));

        登录器.on("completed", async (响应) => {
            await mkdir(path.dirname(凭证路径), { recursive: true });
            await writeFile(凭证路径, JSON.stringify(响应.data), "utf-8");
            console.log("[B站登录] 登录成功，凭证已缓存至", 凭证路径);
            resolve();
        });

        登录器.on("error", (响应) => {
            const 信息 = 响应?.message ?? "未知错误";
            console.error("[B站登录] 登录失败或超时：", 信息);
            reject(new Error(`B 站登录失败：${信息}`));
        });
    });
}
