import * as 库 from "../db/repository";

export type 提供商 = "deepseek" | "gemini";

export interface LLM配置 {
    提供商: 提供商;
    密钥: string;
    地址: string;
    模型: string;
    温度: number;
}

export interface LLM消息 {
    role: "system" | "user" | "assistant";
    content: string;
}

const 前缀: Record<提供商, "DeepSeek" | "Gemini"> = {
    deepseek: "DeepSeek",
    gemini: "Gemini",
};

const 默认配置: Record<提供商, { 地址: string; 模型: string }> = {
    deepseek: { 地址: "https://api.deepseek.com/v1", 模型: "deepseek-chat" },
    gemini: { 地址: "https://generativelanguage.googleapis.com/v1beta/openai", 模型: "gemini-2.5-flash" },
};

/**
 * 从数据库读取 LLM 配置（值已由 encryptedText 列自动解密）
 * DB 无值时回退到代码默认值
 */
export async function 读取配置(提供商: 提供商): Promise<LLM配置> {
    const p = 前缀[提供商];
    const 密钥 = await 库.读取配置项(`${p}密钥`);
    const 地址 = (await 库.读取配置项(`${p}地址`)) || 默认配置[提供商].地址;
    const 模型 = (await 库.读取配置项(`${p}模型`)) || 默认配置[提供商].模型;
    const 温度原始 = await 库.读取配置项("LLMTemperature");
    const 温度 = 温度原始 === "" ? 0.2 : Math.max(0, Math.min(1, Number(温度原始) || 0.2));
    return { 提供商, 密钥, 地址, 模型, 温度 };
}

export async function 当前提供商(): Promise<提供商> {
    return (await 库.读取配置项("LLM提供商")) === "gemini" ? "gemini" : "deepseek";
}

export async function 当前模型(): Promise<string> {
    return (await 读取配置(await 当前提供商())).模型;
}

/**
 * 调用 LLM 的 chat/completions 接口（OpenAI 兼容格式，DeepSeek 与 Gemini 通用）
 */
export async function 调用LLM(消息: LLM消息[], 提供商?: 提供商): Promise<string> {
    const 实际提供商 = 提供商 ?? (await 当前提供商());
    const 配置 = await 读取配置(实际提供商);
    if (!配置.密钥) {
        throw new Error(`未配置 ${配置.提供商} 的密钥，请在系统配置页填写`);
    }
    const 响应 = await fetch(`${配置.地址}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${配置.密钥}`,
        },
        body: JSON.stringify({
            model: 配置.模型,
            messages: 消息,
            temperature: 配置.温度,
        }),
    });
    if (!响应.ok) {
        const 错误文本 = await 响应.text();
        throw new Error(`LLM 请求失败 (${响应.status}): ${错误文本}`);
    }
    const 数据 = (await 响应.json()) as { choices: { message: { content: string } }[] };
    return 数据.choices[0].message.content;
}
