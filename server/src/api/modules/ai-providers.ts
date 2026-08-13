import { Hono } from "hono";
import type { AIProviderRow } from "../../db/repository";
import * as repo from "../../db/repository";

/** AI 提供者管理路由 */
export const aiProvidersRouter = new Hono();

/** 可更新的提供者字段（与数据库行一致，不含主键与创建时间） */
type ProviderUpdateFields = Partial<Omit<AIProviderRow, "id" | "createdAt">>;

/** 提供者列表脱敏：密钥不返回明文，仅保留"已配置"标记（前端按 truthy 判断显示） */
function maskProvider(row: AIProviderRow) {
    const { apiKey, ...rest } = row;
    return { ...rest, apiKey: apiKey ? "已配置" : "" };
}

aiProvidersRouter.get("/", async (c) => {
    const list = await repo.listAIProviders();
    return c.json(list.map(maskProvider));
});

aiProvidersRouter.post("/", async (c) => {
    const body = await c.req.json<{
        name: string;
        providerKey: string;
        apiKey: string;
        apiBaseUrl: string;
        model: string;
        temperature: number;
        systemPrompt?: string | null;
        maxTokens?: number;
        enabled: boolean;
        isDefault: boolean;
        sortOrder: number;
    }>();
    try {
        const row = await repo.createAIProvider({
            name: body.name,
            providerKey: body.providerKey,
            apiKey: body.apiKey,
            apiBaseUrl: body.apiBaseUrl,
            model: body.model,
            systemPrompt: body.systemPrompt?.trim() ? body.systemPrompt.trim() : null,
            temperature: Math.round(body.temperature * 100), // 前端传 0-1，库中存 0-100
            maxTokens: body.maxTokens ?? null,
            enabled: body.enabled,
            isDefault: body.isDefault,
            sortOrder: body.sortOrder ?? 0,
        });
        // 如果设为默认，清除其他默认标记
        if (body.isDefault && row) await repo.setDefaultAIProvider(row.id);
        return c.json(row ?? null, 201);
    } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
});

aiProvidersRouter.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json<{
        name?: string;
        providerKey?: string;
        apiKey?: string;
        apiBaseUrl?: string;
        model?: string;
        temperature?: number;
        systemPrompt?: string | null;
        maxTokens?: number;
        enabled?: boolean;
        isDefault?: boolean;
        sortOrder?: number;
    }>();
    await repo.updateAIProvider(id, buildProviderUpdate(body));
    if (body.isDefault) await repo.setDefaultAIProvider(id);
    return c.json({ ok: true });
});

/** 将请求体映射为可更新字段（跳过未提供的字段；空串 API 密钥保留原值） */
function buildProviderUpdate(body: {
    name?: string;
    providerKey?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string | null;
    maxTokens?: number;
    enabled?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
}): ProviderUpdateFields {
    const updateData: ProviderUpdateFields = {};
    // 简单字段直接透传（undefined 跳过）
    const scalarFields: (keyof typeof body)[] = [
        "name",
        "providerKey",
        "apiBaseUrl",
        "model",
        "maxTokens",
        "enabled",
        "isDefault",
        "sortOrder",
    ];
    for (const field of scalarFields) {
        const value = body[field];
        if (value !== undefined) updateData[field] = value as never;
    }
    // API 密钥：空串保留原值
    if (body.apiKey !== undefined && body.apiKey !== "") updateData.apiKey = body.apiKey;
    // 系统提示词：空串/null 表示清空回退内置默认
    if (body.systemPrompt !== undefined) {
        const prompt = body.systemPrompt ?? "";
        updateData.systemPrompt = prompt.trim() ? prompt.trim() : null;
    }
    // 温度：0~1 浮点 → 0~100 整数存储
    if (body.temperature !== undefined) updateData.temperature = Math.round(body.temperature * 100);
    return updateData;
}

aiProvidersRouter.delete("/:id", async (c) => {
    await repo.deleteAIProvider(Number(c.req.param("id")));
    return c.json({ ok: true });
});

aiProvidersRouter.post("/:id/set-default", async (c) => {
    await repo.setDefaultAIProvider(Number(c.req.param("id")));
    return c.json({ ok: true });
});
