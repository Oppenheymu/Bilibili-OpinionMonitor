export type 提供商 = "deepseek" | "gemini";

export interface LLM配置 {
    提供商: 提供商;
    密钥: string;
    地址: string;
    模型: string;
}

export interface LLM消息 {
    role: "system" | "user" | "assistant";
    content: string;
}

function 读取配置(提供商: 提供商): LLM配置 {
    const env = process.env;
    if (提供商 === "deepseek") {
        return {
            提供商,
            密钥: env["DeepSeek密钥"] ?? "",
            地址: env["DeepSeek地址"] ?? "https://api.deepseek.com/v1",
            模型: env["DeepSeek模型"] ?? "deepseek-chat",
        };
    }
    return {
        提供商,
        密钥: env["Gemini密钥"] ?? "",
        地址: env["Gemini地址"] ?? "https://generativelanguage.googleapis.com/v1beta/openai",
        模型: env["Gemini模型"] ?? "gemini-2.5-flash",
    };
}

export function 当前提供商(): 提供商 {
    return process.env["LLM默认提供商"] === "gemini" ? "gemini" : "deepseek";
}

export function 当前模型(): string {
    return 读取配置(当前提供商()).模型;
}

/**
 * 调用 LLM 的 chat/completions 接口（OpenAI 兼容格式，DeepSeek 与 Gemini 通用）
 */
export async function 调用LLM(消息: LLM消息[], 提供商?: 提供商): Promise<string> {
    const 配置 = 读取配置(提供商 ?? 当前提供商());
    if (!配置.密钥) {
        throw new Error(`未配置 ${配置.提供商} 的密钥，请在 .env 中填写`);
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
            temperature: 0.2,
        }),
    });
    if (!响应.ok) {
        const 错误文本 = await 响应.text();
        throw new Error(`LLM 请求失败 (${响应.status}): ${错误文本}`);
    }
    const 数据 = (await 响应.json()) as { choices: { message: { content: string } }[] };
    return 数据.choices[0].message.content;
}
