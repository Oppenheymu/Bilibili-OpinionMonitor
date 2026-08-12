import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { customType } from "drizzle-orm/sqlite-core";

/**
 * 透明加密列：写入明文自动加密，读取自动解密
 * - 主密钥存于 data/.enc-key（32 字节随机，自动生成，不入库、不入 git）
 * - 密文格式：enc: + base64(iv[12] + 密文 + authTag[16])
 * - 无 enc: 前缀的旧值视为明文直接返回（向前兼容历史数据）
 */
const keyPath = path.resolve("data/.enc-key");

function loadMasterKey(): Buffer {
    if (existsSync(keyPath)) return Buffer.from(readFileSync(keyPath));
    mkdirSync(path.dirname(keyPath), { recursive: true });
    const k = randomBytes(32);
    writeFileSync(keyPath, k, { mode: 0o600 });
    console.log("[加密] 已生成主密钥文件 data/.enc-key");
    return k;
}

const masterKey = loadMasterKey();
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const encryptedText = customType<{ data: string; driverData: string }>({
    dataType() {
        return "text";
    },
    toDriver(plainText: string): string {
        if (plainText == null || plainText === "") return "";
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
        const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
        const combined = Buffer.concat([iv, cipherText, cipher.getAuthTag()]);
        return "enc:" + combined.toString("base64");
    },
    fromDriver(value: string): string {
        if (!value) return "";
        if (!value.startsWith("enc:")) return value; // 旧明文兼容
        try {
            const buf = Buffer.from(value.slice(4), "base64");
            const iv = buf.subarray(0, IV_LENGTH);
            const tag = buf.subarray(buf.length - TAG_LENGTH);
            const cipherText = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
            const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
            decipher.setAuthTag(tag);
            return decipher.update(cipherText, undefined, "utf8") + decipher.final("utf8");
        } catch {
            return ""; // 解密失败返回空，避免拖垮整条查询
        }
    },
});
