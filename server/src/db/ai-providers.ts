import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { aiProviders } from "./schema";

const now = () => Math.floor(Date.now() / 1000);

export interface AIProviderRow {
    id: number;
    name: string;
    providerKey: string;
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    systemPrompt: string | null;
    temperature: number;
    maxTokens: number | null;
    enabled: boolean;
    isDefault: boolean;
    sortOrder: number;
    createdAt: number;
}

export async function listAIProviders(): Promise<AIProviderRow[]> {
    return db
        .select()
        .from(aiProviders)
        .orderBy(desc(aiProviders.sortOrder), desc(aiProviders.createdAt));
}

export async function getDefaultAIProvider(): Promise<AIProviderRow | undefined> {
    const [row] = await db
        .select()
        .from(aiProviders)
        .where(and(eq(aiProviders.enabled, true), eq(aiProviders.isDefault, true)))
        .limit(1);
    if (row) return row;
    // 没有设定默认时，返回第一个启用的
    const [first] = await db
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.enabled, true))
        .limit(1);
    return first;
}

export async function createAIProvider(data: Omit<AIProviderRow, "id" | "createdAt">) {
    const [row] = await db
        .insert(aiProviders)
        .values({
            ...data,
            createdAt: now(),
        })
        .returning();
    return row;
}

export async function updateAIProvider(
    providerId: number,
    data: Partial<Omit<AIProviderRow, "id" | "createdAt">>,
) {
    await db.update(aiProviders).set(data).where(eq(aiProviders.id, providerId));
}

export async function deleteAIProvider(providerId: number) {
    await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
}

/** 设定默认提供者（先清除旧默认，再设置新默认） */
export async function setDefaultAIProvider(providerId: number) {
    await db.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.isDefault, true));
    await db.update(aiProviders).set({ isDefault: true }).where(eq(aiProviders.id, providerId));
}
