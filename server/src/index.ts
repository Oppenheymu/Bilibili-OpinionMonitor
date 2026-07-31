// 必须最先导入，确保拦截所有后续模块的 console 输出
import "./logger";
import app from "./api";
import { 启动调度 } from "./scheduler";

const 端口 = Number(process.env["端口"] ?? 5160);

console.log(`[舆论监控] HTTP 服务启动于端口 ${端口}`);
console.log(`[舆论监控] 数据库：${process.env["数据库路径"] ?? "./data/monitor.db"}`);

启动调度();

export default {
    port: 端口,
    fetch: app.fetch,
    // SSE 连接需要长时间保持；Bun 上限 255 秒，配合 logger.ts 的 15 秒心跳不会触发空闲超时
    idleTimeout: 255,
};
