import { callLLM, readConfig } from "./client";

export interface SentimentResult {
    sentiment: "正面" | "负面" | "中性";
    sentimentScore: number; // -100 ~ 100
    keywords: string[];
    summary: string;
}

export const NEUTRAL_DEFAULT: SentimentResult = {
    sentiment: "中性",
    sentimentScore: 0,
    keywords: [],
    summary: "",
};

/**
 * 打分标准（Rubric）：把 -100~100 的连续分档锚定到语义强度，防止 LLM 随意打分
 */
const RUBRIC = `【情感分数打分标准 Rubric】（-100 ~ 100 整数）
- 90 ~ 100：强烈正面（狂喜、极力推崇、高密度夸赞）
- 60 ~ 89：明显正面（明确喜欢、认可、感谢、支持）
- 30 ~ 59：轻度正面（基本满意、一般性的好评）
- 10 ~ 29：微弱正面（态度偏向正面，但表达克制）
- -9 ~ 9：中性（陈述事实、提问、无情绪色彩、普通日常交流）
- -10 ~ -29：微弱负面（轻度不满、吐槽倾向）
- -30 ~ -59：轻度负面（明显不满、批评、失望）
- -60 ~ -89：明显负面（愤怒、强烈批评、嘲讽、贬低）
- -90 ~ -100：强烈负面（极度愤怒、辱骂、强烈抵制）

判定顺序：先判定情感倾向，再按上述分档给出分数。`;

/**
 * B站语境指南：识别阴阳怪气、反讽、梗、缩写、拼音替代字
 */
const CONTEXT_GUIDE = `【B站语境识别指南】（务必逐条套用）
1. 反讽/阴阳怪气：字面是夸赞，实为批评。例如「真有你的」「干得漂亮（嘲讽语境）」「典中典」。
   识别到反讽 → 判为负面，且分数按讽刺强度给到 -40 ~ -80。
2. 网络梗与缩写：单独出现时以语境为准——
   「yyds/YYDS」= 极力夸赞（正面 70~90）；「蚌埠住了/绷不住了」= 觉得好笑（正面 30~70）；
   「典中典/典」= 讽刺老套言行（负面 -40~-70）；「保护」= 担心被冲、中立偏支持（中性或轻微正面）；
   「差不多得了」= 不耐烦、劝停（负面 -30~-60）；「就这？」= 嘲讽失望（负面 -40~-70）；
   「666/6666」= 夸赞（正面 40~80）；「绝绝子」「yyds」等夸奖词按正面处理。
3. 拼音/谐音替代字：如「牛批/牛B」「沙雕/沙雕」等按语义判断，不要因错别字判错倾向。
4. 表情符号与网络语气：「（狗头」「doge」等可能表示反讽，注意结合上下文。
5. 如果内容有明显情绪词汇（无语/服了/取关/拉黑/举报 → 负面；学到了/感谢/支持/三连 → 正面）。`;

/**
 * Few-Shot 样本：覆盖 B站典型语境，锚定判定方式
 */
const FEW_SHOT_SAMPLES = `【Few-Shot 示例】
1. 输入：「真有你的，这都能做得出来」
   输出：{"情感倾向":"负面","情感分数":-55,"关键词":["反讽"],"摘要":"反讽式批评，暗指对方行为离谱"}
2. 输入：「蚌埠住了，笑死我了哈哈哈哈哈」
   输出：{"情感倾向":"正面","情感分数":65,"关键词":["好笑"],"摘要":"被逗笑，感到有趣"}
3. 输入：「感谢up主，讲得很清楚，学到了！」
   输出：{"情感倾向":"正面","情感分数":75,"关键词":["感谢","学到了"],"摘要":"明确表达感谢与认可"}
4. 输入：「今天的视频就更新到这里，大家怎么看？」
   输出：{"情感倾向":"中性","情感分数":0,"关键词":[],"摘要":"普通交流，无情绪色彩"}
5. 输入：「典中典，又开始洗了是吧」
   输出：{"情感倾向":"负面","情感分数":-65,"关键词":["讽刺","洗白"],"摘要":"讽刺对方老套的辩解"}
6. 输入：「评论区好热闹，都是来吃瓜的」
   输出：{"情感倾向":"中性","情感分数":5,"关键词":["吃瓜"],"摘要":"中性描述评论区氛围"}`;

/** 批量防污染指令：防止批量处理时条目间情绪互相污染 */
const BATCH_INDEPENDENCE = `【批量独立判定要求】
- 对每条内容【独立】判定，严格基于该条内容本身的语义，禁止受相邻条目的情绪影响。
- 即使上一条是强烈负面，也不得因此把本条中性内容判成负面。
- 每条都要单独套用打分标准与语境指南。`;

const SINGLE_SYSTEM_PROMPT = `你是B站舆情分析助手，对用户给出的B站评论或动态内容进行情感分析。
只返回一个JSON对象，不要包含任何解释或markdown标记，格式：
{"情感倾向":"正面|负面|中性","情感分数":-100到100的整数,"关键词":["关键词1","关键词2"],"摘要":"一句话概括"}

${RUBRIC}

${CONTEXT_GUIDE}

${FEW_SHOT_SAMPLES}`;

const BATCH_SYSTEM_PROMPT = `你是B站舆情分析助手，对用户给出的多条B站评论进行情感分析。
只返回一个JSON数组，不要包含任何解释或markdown标记。

${RUBRIC}

${CONTEXT_GUIDE}

${FEW_SHOT_SAMPLES}

${BATCH_INDEPENDENCE}`;

/**
 * 获取情感分析系统提示词：优先使用 AI 提供者自定义的，否则回退内置默认
 */
async function getSystemPrompt(isBatch: boolean): Promise<string> {
    try {
        const config = await readConfig();
        if (config.systemPrompt?.trim()) return config.systemPrompt.trim();
    } catch {
        // 未配置提供者时回退内置
    }
    return isBatch ? BATCH_SYSTEM_PROMPT : SINGLE_SYSTEM_PROMPT;
}

function normalize(raw: Record<string, unknown>): SentimentResult {
    const sentiment = raw["情感倾向"];
    const score = Number(raw["情感分数"] ?? 0);
    const keywords = raw["关键词"];
    return {
        sentiment: sentiment === "正面" || sentiment === "负面" ? sentiment : "中性",
        sentimentScore: Math.max(-100, Math.min(100, Number.isNaN(score) ? 0 : Math.round(score))),
        keywords: Array.isArray(keywords) ? keywords.map(String) : [],
        summary: String(raw["摘要"] ?? ""),
    };
}

function extractObject(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("未找到 JSON 对象");
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/**
 * 视频上下文：供 LLM 结合视频内容判断评论情感（仇恨/反讽/历史记忆等单看文本难判断的场景）
 */
export interface VideoContext {
    title?: string;
    description?: string;
    partitionName?: string;
    subtitle?: string;
}

/**
 * 将视频上下文拼成提示词块（无上下文返回空串）
 * 字幕过长时截断到 1500 字，避免 token 爆炸
 */
function buildContextBlock(context?: VideoContext): string {
    if (!context) return "";
    const title = context.title?.trim();
    const description = context.description?.trim();
    const partition = context.partitionName?.trim();
    const subtitle = context.subtitle?.trim() ? context.subtitle.trim().slice(0, 1500) : "";
    if (!title && !description && !partition && !subtitle) return "";
    const lines = [
        "【视频上下文】（评论所属视频的公开信息，用于理解评论语境，如仇恨/反讽/历史记忆等）",
    ];
    if (title) lines.push(`标题：${title}`);
    if (partition) lines.push(`分区：${partition}`);
    if (description) lines.push(`简介：${description.slice(0, 300)}`);
    if (subtitle) lines.push(`视频内容（AI字幕摘录）：${subtitle}`);
    return lines.join("\n");
}

/**
 * 分析单条文本的情感
 * @param context 可选视频上下文（所属视频标题/描述/分区/字幕）
 * @returns 情感结果 + 思维链文本
 */
export async function analyzeText(
    text: string,
    context?: VideoContext,
): Promise<{ result: SentimentResult; thinking: string }> {
    if (!text.trim()) return { result: { ...NEUTRAL_DEFAULT }, thinking: "" };
    const contextBlock = buildContextBlock(context);
    const userContent = contextBlock ? `${contextBlock}\n\n【待分析评论】\n${text}` : text;
    const reply = await callLLM([
        { role: "system", content: await getSystemPrompt(false) },
        { role: "user", content: userContent },
    ]);
    try {
        return { result: normalize(extractObject(reply.content)), thinking: reply.thinking };
    } catch {
        return { result: { ...NEUTRAL_DEFAULT }, thinking: reply.thinking };
    }
}

/**
 * 批量分析文本情感（一次请求处理多条，失败自动降级为逐条）
 * @param contexts 与文本数组一一对应的可选视频上下文（可为 undefined 项）
 * @returns 情感结果数组 + 思维链文本
 */
export async function analyzeBatch(
    texts: string[],
    contexts?: (VideoContext | undefined)[],
): Promise<{ results: SentimentResult[]; thinking: string }> {
    if (texts.length === 0) return { results: [], thinking: "" };

    // 超过 20 条则分批处理，避免单次请求过大（上下文按对应索引切分）
    if (texts.length > 20) {
        return analyzeBatchInChunks(texts, contexts);
    }
    return analyzeBatchDirect(texts, contexts);
}

/** 超过 20 条时按 20 条切分递归批量分析，汇总结果与思维链 */
async function analyzeBatchInChunks(
    texts: string[],
    contexts?: (VideoContext | undefined)[],
): Promise<{ results: SentimentResult[]; thinking: string }> {
    const allResults: SentimentResult[] = [];
    let allThinking = "";
    for (let i = 0; i < texts.length; i += 20) {
        const chunk = texts.slice(i, i + 20);
        const contextChunk = contexts?.slice(i, i + 20);
        const { results, thinking } = await analyzeBatch(chunk, contextChunk);
        allResults.push(...results);
        if (thinking) allThinking += (allThinking ? "\n---\n" : "") + thinking;
    }
    return { results: allResults, thinking: allThinking };
}

/** 单批（<=20 条）批量分析：拼接提示词 → LLM → 解析 JSON 数组；失败降级逐条 */
async function analyzeBatchDirect(
    texts: string[],
    contexts?: (VideoContext | undefined)[],
): Promise<{ results: SentimentResult[]; thinking: string }> {
    const numberedContent = texts
        .map((t, i) => {
            const contextItem = contexts?.[i];
            const contextBlock = contextItem ? buildContextBlock(contextItem) : "";
            return contextBlock ? `${contextBlock}\n[${i}] ${t}` : `[${i}] ${t}`;
        })
        .join("\n\n");
    const prompt = `对以下每条内容【分别独立】进行情感分析，返回JSON数组（不要markdown）。
⚠️ 每条判定只看该条自己的内容（及附带的视频上下文），不要受相邻条目的情绪影响。
每个元素格式：
{"序号":0,"情感倾向":"正面|负面|中性","情感分数":-100到100整数,"关键词":[...],"摘要":"..."}

内容：
${numberedContent}`;

    try {
        const reply = await callLLM([
            { role: "system", content: await getSystemPrompt(true) },
            { role: "user", content: prompt },
        ]);
        const array = parseJsonArray(reply.content);
        const results: SentimentResult[] = new Array(texts.length).fill({ ...NEUTRAL_DEFAULT });
        for (const item of array) {
            const index = Number(item["序号"] ?? -1);
            if (index >= 0 && index < texts.length) {
                results[index] = normalize(item);
            }
        }
        return { results, thinking: reply.thinking };
    } catch {
        // 降级：逐条分析（一次调用同时取结果与思维链，避免重复消耗）
        return analyzeIndividuallyWithThinking(texts, contexts);
    }
}

/** 从 LLM 回复中提取 JSON 数组（容错 markdown 围栏与前后缀文本） */
function parseJsonArray(content: string): Record<string, unknown>[] {
    const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("未找到 JSON 数组");
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>[];
}

/** 批量失败降级：逐条分析，一次调用同时取结果与思维链 */
async function analyzeIndividuallyWithThinking(
    texts: string[],
    contexts?: (VideoContext | undefined)[],
): Promise<{ results: SentimentResult[]; thinking: string }> {
    const results: SentimentResult[] = [];
    let totalThinking = "";
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text === undefined) continue;
        const { result, thinking } = await analyzeText(text, contexts?.[i]);
        results.push(result);
        if (thinking) totalThinking += (totalThinking ? "\n---\n" : "") + thinking;
    }
    return { results, thinking: totalThinking };
}
