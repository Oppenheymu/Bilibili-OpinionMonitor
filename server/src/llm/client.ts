import * as 库 from "../db/repository";

export interface LLM配置 {
    名称: string;
    密钥: string;
    地址: string;
    模型: string;
    温度: number;
    系统提示词: string | null; // 用户自定义 system prompt，null 回退内置默认
}

export interface LLM消息 {
    role: "system" | "user" | "assistant";
    content: string;
}

/**
 * 从 AI提供者 表读取当前默认启用的 LLM 配置
 * 找不到任何可用提供者时抛出错误
 */
export async function 读取配置(): Promise<LLM配置> {
    const 提供者 = await 库.获取默认AI提供者();
    if (!提供者) {
        throw new Error("没有可用的 AI 提供者，请在「AI配置」页添加并启用至少一个");
    }
    return {
        名称: 提供者.名称,
        密钥: 提供者.API密钥,
        地址: 提供者.API地址,
        模型: 提供者.模型,
        温度: 提供者.温度 / 100, // 数据库中存 0-100 整数，使用时除以 100
        系统提示词: 提供者.系统提示词 ?? null,
    };
}

/** 获取当前默认模型名称（用于日志记录） */
export async function 当前模型(): Promise<string> {
    try {
        const 配置 = await 读取配置();
        return `${配置.名称} / ${配置.模型}`;
    } catch {
        return "未配置";
    }
}

export interface LLM结果 {
    内容: string;
    思考: string; // DeepSeek R1 等模型的 reasoning_content / chain-of-thought
}

/**
 * 通用 LLM 调用：OpenAI 兼容格式，适配所有提供者
 * 返回内容 + 思考链（如模型支持）
 */
export async function 调用LLM(消息: LLM消息[]): Promise<LLM结果> {
    const 配置 = await 读取配置();
    if (!配置.密钥) {
        throw new Error(`AI 提供者「${配置.名称}」未配置密钥`);
    }
    const url = `${配置.地址}/chat/completions`;
    const 响应 = await fetch(url, {
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
    const 数据 = (await 响应.json()) as {
        choices: { message: { content: string; reasoning_content?: string } }[];
    };
    const msg = 数据.choices[0]?.message;
    if (!msg) throw new Error("LLM 返回内容为空");
    return {
        内容: msg.content || "",
        思考: msg.reasoning_content || "",
    };
}
