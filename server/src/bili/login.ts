import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TvQrcodeLogin } from "@renmu/bili-api";
import qrcode from "qrcode-terminal";

export const credentialPath = process.env["BILI_CREDENTIAL_PATH"] ?? "./data/bili-凭证.json";

/**
 * 发起 TV 端扫码登录，二维码打印到终端；成功后凭证写入缓存文件
 */
export async function scanLogin(): Promise<void> {
    const loginInstance = new TvQrcodeLogin();
    const qrUrl = await loginInstance.login();

    console.log("[B站登录] 请使用哔哩哔哩 APP 扫描下方二维码确认登录：");
    qrcode.generate(qrUrl, { small: true }, (图案) => console.log(图案));

    return new Promise((resolve, reject) => {
        loginInstance.on("scan", () => console.log("[B站登录] 已扫描，请在 APP 点击确认"));

        loginInstance.on("completed", async (response) => {
            await mkdir(path.dirname(credentialPath), { recursive: true });
            await writeFile(credentialPath, JSON.stringify(response.data), "utf-8");
            console.log("[B站登录] 登录成功，凭证已缓存至", credentialPath);
            resolve();
        });

        loginInstance.on("error", (response) => {
            const message = response?.message ?? "未知错误";
            console.error("[B站登录] 登录失败或超时：", message);
            reject(new Error(`B 站登录失败：${message}`));
        });
    });
}
