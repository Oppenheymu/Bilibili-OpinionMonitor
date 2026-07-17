import "dotenv/config";
import app from "./api";
import { 启动调度 } from "./scheduler";

const 端口 = Number(process.env["端口"] ?? 5160);

console.log(`[舆论监控] HTTP 服务启动于端口 ${端口}`);
console.log(`[舆论监控] 数据库：${process.env["数据库路径"] ?? "./data/monitor.db"}`);

启动调度();

export default {
    port: 端口,
    fetch: app.fetch,
};
