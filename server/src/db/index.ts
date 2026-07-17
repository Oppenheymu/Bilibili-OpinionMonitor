import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const 数据库路径 = process.env["数据库路径"] ?? "./data/monitor.db";

// 确保数据目录存在（bun:sqlite 不会自动创建目录）
mkdirSync(path.dirname(数据库路径), { recursive: true });

const sqlite = new Database(数据库路径);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export type 数据库类型 = typeof db;
