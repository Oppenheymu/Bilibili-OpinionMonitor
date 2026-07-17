import "dotenv/config";
import { 启动调度 } from "./scheduler";

const 端口 = Number(process.env["端口"] ?? 5160);

console.log(`[舆论监控] 服务启动于端口 ${端口}`);
console.log(`[舆论监控] 数据库：${process.env["数据库路径"] ?? "./data/monitor.db"}`);

启动调度();
