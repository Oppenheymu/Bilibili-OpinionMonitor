import { eq } from "drizzle-orm";
import { db } from "./index";
import { 系统配置 } from "./schema";

const 当前时间戳 = () => Math.floor(Date.now() / 1000);

const 配置缓存 = new Map<string, string>();

/** 读取单个配置项（已自动解密），缺省返回空串 */
export async function 读取配置项(键: string): Promise<string> {
    if (配置缓存.has(键)) return 配置缓存.get(键)!;
    const [行] = await db
        .select({ 值: 系统配置.值 })
        .from(系统配置)
        .where(eq(系统配置.键, 键))
        .limit(1);
    const 值 = 行?.值 ?? "";
    配置缓存.set(键, 值);
    return 值;
}

/** 读取所有配置（已自动解密），返回键值对象 */
export async function 读取所有配置(): Promise<Record<string, string>> {
    const 行 = await db.select().from(系统配置);
    const 结果: Record<string, string> = {};
    配置缓存.clear();
    for (const r of 行) {
        结果[r.键] = r.值;
        配置缓存.set(r.键, r.值);
    }
    return 结果;
}

/** 写入单个配置项（值自动加密） */
export async function 写入配置(键: string, 值: string): Promise<void> {
    const 现在 = 当前时间戳();
    await db
        .insert(系统配置)
        .values({ 键, 值, 更新时间: 现在 })
        .onConflictDoUpdate({ target: 系统配置.键, set: { 值, 更新时间: 现在 } });
    配置缓存.set(键, 值);
}

/**
 * 批量写入配置；指定键的空串将被跳过（用于密钥字段"留空保留原值"语义）
 * @param 跳过空值键 这些键若传入空串则跳过不覆盖
 */
export async function 批量写入配置(
    项: Record<string, string>,
    跳过空值键: string[] = [],
): Promise<void> {
    const 现在 = 当前时间戳();
    const 跳过集合 = new Set(跳过空值键);
    for (const [键, 值] of Object.entries(项)) {
        if (跳过集合.has(键) && 值 === "") continue;
        await db
            .insert(系统配置)
            .values({ 键, 值, 更新时间: 现在 })
            .onConflictDoUpdate({ target: 系统配置.键, set: { 值, 更新时间: 现在 } });
        配置缓存.set(键, 值);
    }
}

/** 清空配置缓存（写入后自动失效，此函数供调试用） */
export function 清空配置缓存(): void {
    配置缓存.clear();
}
