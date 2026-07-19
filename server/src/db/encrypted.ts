import { customType } from "drizzle-orm/sqlite-core";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 透明加密列：写入明文自动加密，读取自动解密
 * - 主密钥存于 data/.enc-key（32 字节随机，自动生成，不入库、不入 git）
 * - 密文格式：enc: + base64(iv[12] + 密文 + authTag[16])
 * - 无 enc: 前缀的旧值视为明文直接返回（向前兼容历史数据）
 */
const 密钥路径 = path.resolve("data/.enc-key");

function 加载主密钥(): Buffer {
    if (existsSync(密钥路径)) return Buffer.from(readFileSync(密钥路径));
    mkdirSync(path.dirname(密钥路径), { recursive: true });
    const k = randomBytes(32);
    writeFileSync(密钥路径, k, { mode: 0o600 });
    console.log("[加密] 已生成主密钥文件 data/.enc-key");
    return k;
}

const 主密钥 = 加载主密钥();
const IV长度 = 12;
const TAG长度 = 16;

export const encryptedText = customType<{ data: string; driverData: string }>({
    dataType() {
        return "text";
    },
    toDriver(明文: string): string {
        if (明文 == null || 明文 === "") return "";
        const iv = randomBytes(IV长度);
        const cipher = createCipheriv("aes-256-gcm", 主密钥, iv);
        const 密文 = Buffer.concat([cipher.update(明文, "utf8"), cipher.final()]);
        const 组合 = Buffer.concat([iv, 密文, cipher.getAuthTag()]);
        return "enc:" + 组合.toString("base64");
    },
    fromDriver(值: string): string {
        if (!值) return "";
        if (!值.startsWith("enc:")) return 值; // 旧明文兼容
        try {
            const buf = Buffer.from(值.slice(4), "base64");
            const iv = buf.subarray(0, IV长度);
            const tag = buf.subarray(buf.length - TAG长度);
            const 密文 = buf.subarray(IV长度, buf.length - TAG长度);
            const decipher = createDecipheriv("aes-256-gcm", 主密钥, iv);
            decipher.setAuthTag(tag);
            return decipher.update(密文, undefined, "utf8") + decipher.final("utf8");
        } catch {
            return ""; // 解密失败返回空，避免拖垮整条查询
        }
    },
});
