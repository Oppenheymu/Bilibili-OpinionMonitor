// 必须最先导入，确保拦截所有后续模块的 console 输出
import "./logger";
import app from "./api";
import { startScheduler } from "./scheduler";

const port = Number(process.env["PORT"] ?? 5160);

console.log(`[舆论监控] HTTP 服务启动于端口 ${port}`);
console.log(`[舆论监控] 数据库：${process.env["DATABASE_PATH"] ?? "./data/monitor.db"}`);

startScheduler();

export default {
    port,
    fetch: app.fetch,
    // SSE 连接需要长时间保持；Bun 上限 255 秒，配合 logger.ts 的 15 秒心跳不会触发空闲超时
    idleTimeout: 255,
};
