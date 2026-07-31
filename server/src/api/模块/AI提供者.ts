import { Hono } from "hono";
import * as 库 from "../../db/repository";

/** AI 提供者管理路由 */
export const AI提供者路由 = new Hono();

/** 提供者列表脱敏：密钥不返回明文，仅保留"已配置"标记（前端按 truthy 判断显示） */
function 脱敏提供者(行: any) {
    const { API密钥, ...其余 } = 行;
    return { ...其余, API密钥: API密钥 ? "已配置" : "" };
}

AI提供者路由.get("/", async (c) => {
    const 列表 = await 库.列出AI提供者();
    return c.json(列表.map(脱敏提供者));
});

AI提供者路由.post("/", async (c) => {
    const body = await c.req.json<{
        名称: string; 提供商标识: string; API密钥: string;
        API地址: string; 模型: string; 温度: number;
        系统提示词?: string | null; 最大令牌?: number; 启用: boolean; 是否默认: boolean; 排序: number;
    }>();
    try {
        const 行 = await 库.创建AI提供者({
            名称: body.名称,
            提供商标识: body.提供商标识,
            API密钥: body.API密钥,
            API地址: body.API地址,
            模型: body.模型,
            系统提示词: body.系统提示词?.trim() ? body.系统提示词.trim() : null,
            温度: Math.round(body.温度 * 100),  // 前端传 0-1，库中存 0-100
            最大令牌: body.最大令牌 ?? null,
            启用: body.启用,
            是否默认: body.是否默认,
            排序: body.排序 ?? 0,
        });
        // 如果设为默认，清除其他默认标记
        if (body.是否默认) await 库.设定默认AI提供者(行.提供者ID);
        return c.json(行, 201);
    } catch (e) {
        return c.json({ 错误: e instanceof Error ? e.message : String(e) }, 400);
    }
});

AI提供者路由.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json<{
        名称?: string; 提供商标识?: string; API密钥?: string;
        API地址?: string; 模型?: string; 温度?: number;
        系统提示词?: string | null; 最大令牌?: number; 启用?: boolean; 是否默认?: boolean; 排序?: number;
    }>();
    const 更新数据: Record<string, unknown> = {};
    if (body.名称 !== undefined) 更新数据["名称"] = body.名称;
    if (body.提供商标识 !== undefined) 更新数据["提供商标识"] = body.提供商标识;
    if (body.API密钥 !== undefined && body.API密钥 !== "") 更新数据["API密钥"] = body.API密钥; // 空串保留原值
    if (body.API地址 !== undefined) 更新数据["API地址"] = body.API地址;
    if (body.模型 !== undefined) 更新数据["模型"] = body.模型;
    // 系统提示词：空串/null 表示清空回退内置默认
    if (body.系统提示词 !== undefined) {
        const 词 = body.系统提示词 ?? "";
        更新数据["系统提示词"] = 词.trim() ? 词.trim() : null;
    }
    if (body.温度 !== undefined) 更新数据["温度"] = Math.round(body.温度 * 100);
    if (body.最大令牌 !== undefined) 更新数据["最大令牌"] = body.最大令牌;
    if (body.启用 !== undefined) 更新数据["启用"] = body.启用;
    if (body.是否默认 !== undefined) 更新数据["是否默认"] = body.是否默认;
    if (body.排序 !== undefined) 更新数据["排序"] = body.排序;
    await 库.更新AI提供者(id, 更新数据 as any);
    if (body.是否默认) await 库.设定默认AI提供者(id);
    return c.json({ ok: true });
});

AI提供者路由.delete("/:id", async (c) => {
    await 库.删除AI提供者(Number(c.req.param("id")));
    return c.json({ ok: true });
});

AI提供者路由.post("/:id/设为默认", async (c) => {
    await 库.设定默认AI提供者(Number(c.req.param("id")));
    return c.json({ ok: true });
});
