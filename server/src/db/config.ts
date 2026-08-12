import { eq } from "drizzle-orm";
import { db } from "./index";
import { systemConfig } from "./schema";

const now = () => Math.floor(Date.now() / 1000);

const configCache = new Map<string, string>();

/** 读取单个配置项（已自动解密），缺省返回空串 */
export async function getConfigValue(key: string): Promise<string> {
    if (configCache.has(key)) return configCache.get(key)!;
    const [row] = await db
        .select({ value: systemConfig.value })
        .from(systemConfig)
        .where(eq(systemConfig.key, key))
        .limit(1);
    const value = row?.value ?? "";
    configCache.set(key, value);
    return value;
}

/** 读取所有配置（已自动解密），返回键值对象 */
export async function getAllConfig(): Promise<Record<string, string>> {
    const rows = await db.select().from(systemConfig);
    const result: Record<string, string> = {};
    configCache.clear();
    for (const r of rows) {
        result[r.key] = r.value;
        configCache.set(r.key, r.value);
    }
    return result;
}

/** 写入单个配置项（值自动加密） */
export async function setConfigValue(key: string, value: string): Promise<void> {
    const timestamp = now();
    await db
        .insert(systemConfig)
        .values({ key, value, updatedAt: timestamp })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: timestamp } });
    configCache.set(key, value);
}

/**
 * 批量写入配置；指定键的空串将被跳过（用于密钥字段"留空保留原值"语义）
 * @param skipEmptyKeys 这些键若传入空串则跳过不覆盖
 */
export async function setConfigValues(
    entries: Record<string, string>,
    skipEmptyKeys: string[] = [],
): Promise<void> {
    const timestamp = now();
    const skipSet = new Set(skipEmptyKeys);
    for (const [key, value] of Object.entries(entries)) {
        if (skipSet.has(key) && value === "") continue;
        await db
            .insert(systemConfig)
            .values({ key, value, updatedAt: timestamp })
            .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: timestamp } });
        configCache.set(key, value);
    }
}

/** 清空配置缓存（写入后自动失效，此函数供调试用） */
export function clearConfigCache(): void {
    configCache.clear();
}
