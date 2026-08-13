import * as repo from "../db/repository";

export interface LLMConfig {
    name: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    systemPrompt: string | null; // 用户自定义 system prompt，null 回退内置默认
}

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/**
 * 从 AI提供者 表读取当前默认启用的 LLM 配置
 * 找不到任何可用提供者时抛出错误
 */
export async function readConfig(): Promise<LLMConfig> {
    const provider = await repo.getDefaultAIProvider();
    if (!provider) {
        throw new Error("没有可用的 AI 提供者，请在「AI配置」页添加并启用至少一个");
    }
    return {
        name: provider.name,
        apiKey: provider.apiKey,
        baseUrl: provider.apiBaseUrl,
        model: provider.model,
        temperature: provider.temperature / 100, // 数据库中存 0-100 整数，使用时除以 100
        systemPrompt: provider.systemPrompt ?? null,
    };
}

/** 获取当前默认模型名称（用于日志记录） */
export async function currentModel(): Promise<string> {
    try {
        const config = await readConfig();
        return `${config.name} / ${config.model}`;
    } catch {
        return "未配置";
    }
}

export interface LLMResult {
    content: string;
    thinking: string; // DeepSeek R1 等模型的 reasoning_content / chain-of-thought
}

/**
 * 通用 LLM 调用：OpenAI 兼容格式，适配所有提供者
 * 返回内容 + 思考链（如模型支持）
 */
export async function callLLM(messages: LLMMessage[]): Promise<LLMResult> {
    const config = await readConfig();
    if (!config.apiKey) {
        throw new Error(`AI 提供者「${config.name}」未配置密钥`);
    }
    const url = `${config.baseUrl}/chat/completions`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            temperature: config.temperature,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM 请求失败 (${response.status}): ${errorText}`);
    }
    const data = (await response.json()) as {
        choices: { message: { content: string; reasoning_content?: string } }[];
    };
    const msg = data.choices[0]?.message;
    if (!msg) throw new Error("LLM 返回内容为空");
    return {
        content: msg.content || "",
        thinking: msg.reasoning_content || "",
    };
}
