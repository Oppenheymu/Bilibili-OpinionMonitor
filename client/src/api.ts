const 基地址 = "/api";

async function 请求<T>(路径: string, 选项?: RequestInit): Promise<T> {
    const 响应 = await fetch(`${基地址}${路径}`, {
        ...选项,
        headers: {
            "Content-Type": "application/json",
            ...((选项?.headers as Record<string, string> | undefined) ?? {}),
        },
    });
    if (!响应.ok) {
        const 错误 = (await 响应.json().catch(() => ({ 错误: "请求失败" }))) as { 错误?: string };
        throw new Error(错误.错误 ?? `HTTP ${响应.status}`);
    }
    return 响应.json() as Promise<T>;
}

export function 格式化时间(时间戳: number | null | undefined): string {
    if (!时间戳) return "-";
    return new Date(时间戳 * 1000).toLocaleString("zh-CN");
}

export interface 任务 {
    任务ID: number;
    类型: string;
    目标: string;
    启用: boolean;
    创建时间: number;
    最后采集时间: number | null;
}

export interface 概览统计 {
    视频总数: number;
    评论总数: number;
    动态总数: number;
    已分析评论: number;
    情感分布: Record<string, number>;
}

export const api = {
    获取任务: () => 请求<任务[]>("/任务"),
    创建任务: (类型: string, 目标: string) =>
        请求<任务>("/任务", { method: "POST", body: JSON.stringify({ 类型, 目标 }) }),
    更新任务: (id: number, 启用: boolean) =>
        请求<{ ok: boolean }>(`/任务/${id}`, { method: "PATCH", body: JSON.stringify({ 启用 }) }),
    删除任务: (id: number) => 请求<{ ok: boolean }>(`/任务/${id}`, { method: "DELETE" }),
    概览: () => 请求<概览统计>("/统计/概览"),
    情感分布: () => 请求<{ 倾向: string; 数: number }[]>("/统计/情感分布"),
    趋势: (天数 = 7) =>
        请求<{ 日期: string; 评论数: number; 平均分数: number }[]>(`/统计/趋势?天数=${天数}`),
    视频: (页 = 1) => 请求<unknown[]>(`/视频?页=${页}`),
    评论: (参数: { 视频ID?: number; 情感?: string; 页?: number } = {}) => {
        const q = new URLSearchParams();
        if (参数.视频ID) q.set("视频ID", String(参数.视频ID));
        if (参数.情感) q.set("情感", 参数.情感);
        q.set("页", String(参数.页 ?? 1));
        return 请求<unknown[]>(`/评论?${q.toString()}`);
    },
    动态: (页 = 1) => 请求<unknown[]>(`/动态?页=${页}`),
    日志: (页 = 1) => 请求<unknown[]>(`/日志?页=${页}`),
    触发采集: () => 请求<{ 消息: string }>("/采集/触发", { method: "POST" }),
};
