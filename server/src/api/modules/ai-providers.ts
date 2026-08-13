import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AIProviderRow } from "../../db/repository";
import * as repo from "../../db/repository";

/** AI 提供者管理路由 */
export const aiProvidersRouter = new Hono();

/** 可更新的提供者字段（与数据库行一致，不含主键与创建时间） */
type ProviderUpdateFields = Partial<Omit<AIProviderRow, "id" | "createdAt">>;

/**
 * AI 提供者请求体 schema（zod v4）。
 * temperature 为 0~1 浮点（与前端一致），入库时换算为 0~100 整数。
 * maxTokens 允许 null/缺省（缺省由路由层落 null）。
 */
const providerBodySchema = z.object({
    name: z.string().min(1, "名称不能为空"),
    providerKey: z.string().min(1, "提供者类型不能为空"),
    apiKey: z.string().min(1, "API 密钥不能为空"),
    apiBaseUrl: z.string().min(1, "API 地址不能为空"),
    model: z.string().min(1, "模型名不能为空"),
    temperature: z.number().min(0).max(1, "Temperature 必须在 0~1 之间"),
    systemPrompt: z.string().nullable().optional(),
    maxTokens: z.number().int().positive("maxTokens 必须为正整数").nullable().optional(),
    enabled: z.boolean(),
    isDefault: z.boolean(),
    sortOrder: z.number().int().optional(),
});
/** 创建时全部必填；更新时各字段可选（复用同一 schema 派生，避免重复定义） */
const providerCreateSchema = providerBodySchema;
const providerUpdateSchema = providerBodySchema.partial();

/**
 * 校验失败统一返回中文错误（与项目 { error } 响应格式一致），成功时放行。
 * 参数用宽松结构（error 为 unknown），内部按 zod 的 ZodError 形状断言，
 * 避免与 zod-validator 内部 $ZodError/$ZodIssue 泛型细节耦合。
 */
function failValidation(
    result: { success: boolean; error?: unknown },
    c: Context,
): Response | void {
    if (!result.success && result.error) {
        const error = result.error as z.ZodError;
        const details = error.issues
            .map((issue) => `${issue.path.join(".") || "参数"}: ${issue.message}`)
            .join("；");
        return c.json({ error: `参数校验失败：${details}` }, 400);
    }
}

/** 提供者列表脱敏：密钥不返回明文，仅保留"已配置"标记（前端按 truthy 判断显示） */
function maskProvider(row: AIProviderRow) {
    const { apiKey, ...rest } = row;
    return { ...rest, apiKey: apiKey ? "已配置" : "" };
}

aiProvidersRouter.get("/", async (c) => {
    const list = await repo.listAIProviders();
    return c.json(list.map(maskProvider));
});

aiProvidersRouter.post("/", zValidator("json", providerCreateSchema, failValidation), async (c) => {
    const body = c.req.valid("json");
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

aiProvidersRouter.put(
    "/:id",
    zValidator("json", providerUpdateSchema, failValidation),
    async (c) => {
        const id = Number(c.req.param("id"));
        const body = c.req.valid("json");
        await repo.updateAIProvider(id, buildProviderUpdate(body));
        if (body.isDefault) await repo.setDefaultAIProvider(id);
        return c.json({ ok: true });
    },
);

/** 将请求体映射为可更新字段（跳过未提供的字段；空串 API 密钥保留原值） */
function buildProviderUpdate(body: z.infer<typeof providerUpdateSchema>): ProviderUpdateFields {
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
