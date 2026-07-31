/**
 * 控制台日志拦截与 SSE 广播
 * 拦截 console.log/warn/error，将输出广播给所有 SSE 连接的客户端
 */

export interface 日志条目 {
    时间: string;
    级别: "log" | "warn" | "error";
    内容: string;
}

/** 订阅者 key → Response 写入流 */
const 订阅者 = new Map<number, ReadableStreamDefaultController<string>>();
let 订阅者ID = 0;

/** 环形缓冲区：保留最近 500 条日志 */
const 历史日志: 日志条目[] = [];
const 最大历史 = 500;

function 格式化时间(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function 广播(条目: 日志条目): void {
    历史日志.push(条目);
    if (历史日志.length > 最大历史) 历史日志.shift();

    const 数据 = `data: ${JSON.stringify(条目)}\n\n`;
    for (const [id, ctrl] of 订阅者) {
        try {
            ctrl.enqueue(数据);
        } catch {
            订阅者.delete(id);
        }
    }
}

/** 替换 console 方法，拦截输出 */
const _原始 = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

console.log = (...args: unknown[]) => {
    const 内容 = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _原始.log(...args);
    广播({ 时间: 格式化时间(), 级别: "log", 内容 });
};

console.warn = (...args: unknown[]) => {
    const 内容 = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _原始.warn(...args);
    广播({ 时间: 格式化时间(), 级别: "warn", 内容 });
};

console.error = (...args: unknown[]) => {
    const 内容 = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    _原始.error(...args);
    广播({ 时间: 格式化时间(), 级别: "error", 内容 });
};

/** 创建 SSE 响应流 */
export function 创建SSE流() {
    let id: number;
    let 心跳定时器: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
        start(controller) {
            id = ++订阅者ID;
            订阅者.set(id, controller);

            // 先发送历史日志
            for (const 条目 of 历史日志) {
                controller.enqueue(`data: ${JSON.stringify(条目)}\n\n`);
            }

            // 发送心跳注释，确认连接
            controller.enqueue(": connected\n\n");

            // 心跳：每 15 秒发送一次注释，防止服务端 idleTimeout 关闭空闲 SSE 连接；
            // 同时 enqueue 失败说明连接已断开，及时清理失效订阅者
            心跳定时器 = setInterval(() => {
                try {
                    controller.enqueue(": ping\n\n");
                } catch {
                    if (心跳定时器) clearInterval(心跳定时器);
                    订阅者.delete(id);
                }
            }, 15000);
        },
        cancel() {
            if (心跳定时器) clearInterval(心跳定时器);
            订阅者.delete(id!);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

/** 获取历史日志 */
export function 获取历史日志(限制?: number): 日志条目[] {
    if (限制 && 限制 < 历史日志.length) {
        return 历史日志.slice(-限制);
    }
    return [...历史日志];
}

/** 清空历史 */
export function 清空历史日志(): void {
    历史日志.length = 0;
}

// ===== 分析进度广播 =====

export interface 进度事件 {
    类型: "分析进度";
    已分析: number;
    总数: number;
    失败: number;
    批次: number;
    模型: string;
    思考: string; // 最新一批的思维链
}

/** 广播分析进度（通过 SSE 推送，带 event 类型） */
export function 广播分析进度(数据: Omit<进度事件, "类型">): void {
    const 事件: 进度事件 = { 类型: "分析进度", ...数据 };
    const 数据文本 = `event: 分析进度\ndata: ${JSON.stringify(事件)}\n\n`;
    for (const [id, ctrl] of 订阅者) {
        try {
            ctrl.enqueue(数据文本);
        } catch {
            订阅者.delete(id);
        }
    }
}
