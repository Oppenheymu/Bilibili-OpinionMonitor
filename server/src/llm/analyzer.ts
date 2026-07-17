import { 调用LLM } from "./client";

export interface 情感结果 {
    情感倾向: "正面" | "负面" | "中性";
    情感分数: number; // -100 ~ 100
    关键词: string[];
    摘要: string;
}

export const 中性默认: 情感结果 = {
    情感倾向: "中性",
    情感分数: 0,
    关键词: [],
    摘要: "",
};

const 单条系统提示 = `你是舆情分析助手。对用户给出的B站评论或动态内容进行情感分析。
只返回一个JSON对象，不要包含任何解释或markdown标记，格式：
{"情感倾向":"正面|负面|中性","情感分数":-100到100的整数,"关键词":["关键词1","关键词2"],"摘要":"一句话概括"}
判定标准：正面分数>0，负面分数<0，中性分数约为0。`;

function 规范化(原始: Record<string, unknown>): 情感结果 {
    const 倾向 = 原始["情感倾向"];
    const 分数 = Number(原始["情感分数"] ?? 0);
    const 关键词 = 原始["关键词"];
    return {
        情感倾向: 倾向 === "正面" || 倾向 === "负面" ? 倾向 : "中性",
        情感分数: Math.max(-100, Math.min(100, Number.isNaN(分数) ? 0 : Math.round(分数))),
        关键词: Array.isArray(关键词) ? 关键词.map(String) : [],
        摘要: String(原始["摘要"] ?? ""),
    };
}

function 提取对象(文本: string): Record<string, unknown> {
    const 清理 = 文本.replace(/```json\s*|\s*```/g, "").trim();
    const 开始 = 清理.indexOf("{");
    const 结束 = 清理.lastIndexOf("}");
    if (开始 === -1 || 结束 === -1) throw new Error("未找到 JSON 对象");
    return JSON.parse(清理.slice(开始, 结束 + 1)) as Record<string, unknown>;
}

/**
 * 分析单条文本的情感
 */
export async function 分析文本(文本: string): Promise<情感结果> {
    if (!文本.trim()) return { ...中性默认 };
    const 回复 = await 调用LLM([
        { role: "system", content: 单条系统提示 },
        { role: "user", content: 文本 },
    ]);
    try {
        return 规范化(提取对象(回复));
    } catch {
        return { ...中性默认 };
    }
}

/**
 * 批量分析文本情感（一次请求处理多条，失败自动降级为逐条）
 */
export async function 批量分析(文本数组: string[]): Promise<情感结果[]> {
    if (文本数组.length === 0) return [];

    // 超过 20 条则分批处理，避免单次请求过大
    if (文本数组.length > 20) {
        const 结果: 情感结果[] = [];
        for (let i = 0; i < 文本数组.length; i += 20) {
            结果.push(...(await 批量分析(文本数组.slice(i, i + 20))));
        }
        return 结果;
    }

    const 编号内容 = 文本数组.map((t, i) => `[${i}] ${t}`).join("\n");
    const 提示 = `对以下每条内容进行情感分析，返回JSON数组（不要markdown），每个元素格式：
{"序号":0,"情感倾向":"正面|负面|中性","情感分数":-100到100整数,"关键词":[...],"摘要":"..."}

内容：
${编号内容}`;

    try {
        const 回复 = await 调用LLM([
            { role: "system", content: "你是舆情分析助手，严格只返回JSON数组。" },
            { role: "user", content: 提示 },
        ]);
        const 清理 = 回复.replace(/```json\s*|\s*```/g, "").trim();
        const 开始 = 清理.indexOf("[");
        const 结束 = 清理.lastIndexOf("]");
        if (开始 === -1 || 结束 === -1) throw new Error("未找到 JSON 数组");
        const 数组 = JSON.parse(清理.slice(开始, 结束 + 1)) as Record<string, unknown>[];

        const 结果: 情感结果[] = new Array(文本数组.length).fill({ ...中性默认 });
        for (const 项 of 数组) {
            const 序号 = Number(项["序号"] ?? -1);
            if (序号 >= 0 && 序号 < 文本数组.length) {
                结果[序号] = 规范化(项);
            }
        }
        return 结果;
    } catch {
        // 降级：逐条分析
        const 结果: 情感结果[] = [];
        for (const t of 文本数组) {
            结果.push(await 分析文本(t));
        }
        return 结果;
    }
}
