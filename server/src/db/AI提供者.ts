import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { AI提供者 } from "./schema";

const 当前时间戳 = () => Math.floor(Date.now() / 1000);

export interface AI提供者行 {
    提供者ID: number;
    名称: string;
    提供商标识: string;
    API密钥: string;
    API地址: string;
    模型: string;
    系统提示词: string | null;
    温度: number;
    最大令牌: number | null;
    启用: boolean;
    是否默认: boolean;
    排序: number;
    创建时间: number;
}

export async function 列出AI提供者(): Promise<AI提供者行[]> {
    return db.select().from(AI提供者).orderBy(desc(AI提供者.排序), desc(AI提供者.创建时间));
}

export async function 获取默认AI提供者(): Promise<AI提供者行 | undefined> {
    const [行] = await db
        .select()
        .from(AI提供者)
        .where(and(eq(AI提供者.启用, true), eq(AI提供者.是否默认, true)))
        .limit(1);
    if (行) return 行;
    // 没有设定默认时，返回第一个启用的
    const [第一个] = await db.select().from(AI提供者).where(eq(AI提供者.启用, true)).limit(1);
    return 第一个;
}

export async function 创建AI提供者(数据: Omit<AI提供者行, "提供者ID" | "创建时间">) {
    const [行] = await db
        .insert(AI提供者)
        .values({
            ...数据,
            创建时间: 当前时间戳(),
        })
        .returning();
    return 行;
}

export async function 更新AI提供者(
    提供者ID: number,
    数据: Partial<Omit<AI提供者行, "提供者ID" | "创建时间">>,
) {
    await db.update(AI提供者).set(数据).where(eq(AI提供者.提供者ID, 提供者ID));
}

export async function 删除AI提供者(提供者ID: number) {
    await db.delete(AI提供者).where(eq(AI提供者.提供者ID, 提供者ID));
}

/** 设定默认提供者（先清除旧默认，再设置新默认） */
export async function 设定默认AI提供者(提供者ID: number) {
    await db.update(AI提供者).set({ 是否默认: false }).where(eq(AI提供者.是否默认, true));
    await db.update(AI提供者).set({ 是否默认: true }).where(eq(AI提供者.提供者ID, 提供者ID));
}
