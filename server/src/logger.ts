/**
 * 控制台日志拦截与 SSE 广播
 * 拦截 console.log/warn/error，将输出广播给所有 SSE 连接的客户端
 */

export interface LogEntry {
    time: string;
    level: "log" | "warn" | "error";
    content: string;
}

/** 订阅者 key → Response 写入流 */
const subscribers = new Map<number, ReadableStreamDefaultController<string>>();
let subscriberId = 0;

/** 环形缓冲区：保留最近 500 条日志 */
const historyLogs: LogEntry[] = [];
const maxHistory = 500;

function formatTime(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function broadcast(entry: LogEntry): void {
    historyLogs.push(entry);
    if (historyLogs.length > maxHistory) historyLogs.shift();

    const data = `data: ${JSON.stringify(entry)}\n\n`;
    for (const [id, ctrl] of subscribers) {
        try {
            ctrl.enqueue(data);
        } catch {
            subscribers.delete(id);
        }
    }
}

/** 替换 console 方法，拦截输出 */
const _original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

console.log = (...args: unknown[]) => {
    const content = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _original.log(...args);
    broadcast({ time: formatTime(), level: "log", content });
};

console.warn = (...args: unknown[]) => {
    const content = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _original.warn(...args);
    broadcast({ time: formatTime(), level: "warn", content });
};

console.error = (...args: unknown[]) => {
    const content = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _original.error(...args);
    broadcast({ time: formatTime(), level: "error", content });
};

/** 创建 SSE 响应流 */
export function createSSEStream() {
    let id: number;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
        start(controller) {
            id = ++subscriberId;
            subscribers.set(id, controller);

            // 先发送历史日志
            for (const entry of historyLogs) {
                controller.enqueue(`data: ${JSON.stringify(entry)}\n\n`);
            }

            // 发送心跳注释，确认连接
            controller.enqueue(": connected\n\n");

            // 心跳：每 15 秒发送一次注释，防止服务端 idleTimeout 关闭空闲 SSE 连接；
            // 同时 enqueue 失败说明连接已断开，及时清理失效订阅者
            heartbeatTimer = setInterval(() => {
                try {
                    controller.enqueue(": ping\n\n");
                } catch {
                    if (heartbeatTimer) clearInterval(heartbeatTimer);
                    subscribers.delete(id);
                }
            }, 15000);
        },
        cancel() {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            subscribers.delete(id!);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            connection: "keep-alive",
        },
    });
}

/** 获取历史日志 */
export function getHistoryLogs(limit?: number): LogEntry[] {
    if (limit && limit < historyLogs.length) {
        return historyLogs.slice(-limit);
    }
    return [...historyLogs];
}

/** 清空历史 */
export function clearHistoryLogs(): void {
    historyLogs.length = 0;
}

// ===== 分析进度广播 =====

export interface ProgressEvent {
    type: "analysis-progress";
    analyzed: number;
    total: number;
    failed: number;
    batch: number;
    model: string;
    thinking: string; // 最新一批的思维链
}

/** 广播分析进度（通过 SSE 推送，带 event 类型） */
export function broadcastAnalysisProgress(data: Omit<ProgressEvent, "type">): void {
    const event: ProgressEvent = { type: "analysis-progress", ...data };
    const dataText = `event: analysis-progress\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [id, ctrl] of subscribers) {
        try {
            ctrl.enqueue(dataText);
        } catch {
            subscribers.delete(id);
        }
    }
}
