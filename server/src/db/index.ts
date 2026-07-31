import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const 数据库路径 = process.env["数据库路径"] ?? "./data/monitor.db";

// 确保数据目录存在（bun:sqlite 不会自动创建目录）
mkdirSync(path.dirname(数据库路径), { recursive: true });

const sqlite = new Database(数据库路径);
// WAL：读写并发（采集写 / LLM 回写 / 前端读）互不阻塞，读不阻塞写、写不阻塞读
sqlite.exec("PRAGMA journal_mode = WAL;");
// busy_timeout：写锁竞争时等待而非立刻 SQLITE_BUSY（采集/LLM 回写并发时关键）
// 5 秒内若仍拿不到写锁才报错，避免高频写并发瞬间失败
sqlite.exec("PRAGMA busy_timeout = 5000;");
// synchronous=NORMAL：WAL 模式下崩溃最多丢最近一次提交，换取更快写性能
sqlite.exec("PRAGMA synchronous = NORMAL;");
// 缓存增大：减少重复索引页读盘（概览/话题统计频繁全表聚合）
sqlite.exec("PRAGMA cache_size = -32000;"); // 32MB
// 外键约束
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export type 数据库类型 = typeof db;
