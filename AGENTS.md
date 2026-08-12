# bili-opinion-monitor 工程指南

> 本文件是项目级指令（VS Code Copilot 自动加载）。开始任何工作前，先读本文件；涉及数据库、LLM、B站采集的改动，先读对应模块源码再动手。

## 项目是什么

B站舆情监控系统：采集指定 UP 主/关键词的视频、评论、动态，用 LLM 做情感分析与舆论分析，后台看板展示趋势与预警。**双包 monorepo**：`client`（Vue 3 后台看板）+ `server`（Hono 后端）。包管理器 Bun，数据库 SQLite（Drizzle ORM），B站接口走 `@renmu/bili-api`，LLM 走 OpenAI 兼容接口（DeepSeek/Gemini 等）。

## 硬性约束（违反 = 错误）

1. **全程中文标识符**：函数名、变量名、API 路由、数据库列名/表名、文件名均用中文（如 `监控任务`、`B站路由`、`采集全部`、`db/采集写入.ts`）。禁止引入英文命名的业务标识符。biome 已适配（`useNamingConvention`/`useFilenamingConvention` 关闭），不会报错，但规范本身仍须遵守。
2. **敏感数据必须加密存储**：`server/src/db/encrypted.ts` 的 `encryptedText` 类型（AES-256-GCM）不可绕过。AI 提供者的 API 密钥、访问令牌等一律用该类型；主密钥存 `data/.enc-key`（自动生成，**不入库、不入 git**）。明文 `enc:` 前缀的兼容逻辑勿破坏。
3. **访问令牌认证**：系统配置设置"访问令牌"后，除 `/api/配置`（GET/PUT 豁免防死锁）外所有接口需 `Authorization: Bearer` / `x-access-token` / SSE `?token=` 携带令牌。勿削弱该机制。
4. **日志统一走 console**：`server/src/logger.ts` 拦截 console 并 SSE 广播到看板控制台。不要引入 pino 等替代（会脱离控制台页面）。biome `noConsole` 已放宽为 warn。
5. **B站凭证**：扫码登录产物存 `server/data/bili-凭证.json`（不入 git）。含 Cookie，勿打印、勿提交。
6. **类型安全**：严格 TS 全家桶（`noUncheckedIndexedAccess`、`verbatimModuleSyntax`、`erasableSyntaxOnly` 等均为 error）。类型导入一律 `import type`；禁止 `enum`（`erasableSyntaxOnly` 限制，用 `as const` 对象）；禁止无注释的 `any`。
7. **异步纪律**：`noFloatingPromises` 为 error——异步调用必须 `await` 或显式 `.catch`；有意的 fire-and-forget（如触发采集、调度循环）须加 `// biome-ignore lint/nursery/noFloatingPromises: 理由` 注释。
8. **fire-and-forget 是项目模式**：手动采集/分析接口刻意不等待（长任务），进度通过 SSE 推送；勿改成同步等待（会阻塞请求）。

## 架构速览

```
client/   Vue 3 + Vite 4 + Element Plus + Pinia（后台看板）
  src/api/modules/monitor.ts    # 全部业务接口（中文路径）
  src/views/monitor/            # 看板页面：overview/comments/videos/dynamics/tasks/ai-providers/bili-service
server/   Hono + Bun + SQLite(Drizzle) + LLM
  src/api/                      # 路由入口 + 模块路由（AI提供者.ts / B站.ts）
  src/bili/                     # client.ts(单例) / collector.ts(采集) / login.ts(扫码) / rateLimit.ts
  src/db/                       # schema.ts(9张表) / repository.ts / 采集写入.ts / 查询.ts / 任务管理.ts / 配置.ts / 停用词.ts / AI提供者.ts / encrypted.ts
  src/llm/                      # client.ts(OpenAI兼容) / analyzer.ts(情感分析) / 容错.ts(熔断·预算·采样) / 评测.ts(标注评测) / 标注集.ts / 标注样本.ts
  src/scheduler/                # index.ts(启动调度) / 参数.ts / 采集.ts / 分析.ts
  src/logger.ts                 # console 拦截 + SSE 广播
```

**数据库表（9 张，`server/src/db/schema.ts`）**：`监控任务`、`视频`、`视频统计`、`评论`、`动态`、`情感分析`、`采集日志`、`系统配置`（`值` 列用 `encryptedText`）、`AI提供者`（API 密钥用 `encryptedText`）。

**关键流程**：
- 采集：调度器/scheduler 或手动 API → `bili/collector`（受 `rateLimit` 限速）→ `db/采集写入` → 写日志表
- 分析：`db/查询` 取未处理评论 → `llm/analyzer`（受 `容错.ts` 熔断/预算/采样控制）→ 写 `情感分析` 表
- 舆论分析：`情感分析.关键词`（JSON 数组）经 `话题统计` 展开聚合，`停用词.ts` 过滤噪音

## 工作流

```bash
bun install                  # 安装依赖
bun run check                # biome check + server tsc + client vue-tsc（提交前必跑）
bun run fix                  # biome 自动修复 + 双端类型检查
bun run lint / lint:fix      # 仅 biome
bun run type:check           # 仅双端类型检查
bun run dev                  # 同时启动前后端（scripts/dev.mjs）
bun run dev:server           # 仅后端（Hono，默认端口 5160）
bun run dev:client           # 仅前端（Vite，默认 5173）
bun run build                # 双端构建
bun run db:push              # schema 变更后推送数据库（drizzle-kit push）
bun run db:generate          # 生成迁移 SQL
bun run db:studio            # Drizzle Studio 可视化
```

**提交前必跑 `bun run check`**（biome 0 error + 双端类型 0 error）。改完 `server/src/db/schema.ts` 后提醒用户 `bun run db:push`。

## 代码风格（biome 已强制，手动也须遵守）

- 缩进 **space+4**，行尾 **LF**（Windows 下 CRLF 会被 biome 修复）；字符串双引号、分号、尾逗号。
- 中文注释与 JSDoc：模块头写清职责，函数写清入参/返回/副作用（参考 `encrypted.ts`、`容错.ts` 的注释风格）。
- 类型导入一律 `import type`；禁止 `enum`（用 `as const` 对象 + `typeof` 推导类型）；禁止无注释的 `any`。
- `noFloatingPromises` 为 error：fire-and-forget 必须有 `biome-ignore` 注释说明理由。
- 错误处理：业务错误 `throw new Error("中文描述")`，路由层统一 catch 返回 `{ 错误 }`；不静默吞错。

## 实现模式（重要）

- **一个模块一个模块实现**：改前先读对应模块源码，理解现状再动手；每完成一个改动跑一次 `bun run check`。
- **数据库改动先看 schema**：新表/新列在 `schema.ts` 加，改完提醒 `bun run db:push`；敏感字段必须 `encryptedText`。
- **LLM 调用走容错层**：任何 LLM 调用经 `llm/容错.ts`（熔断/预算/采样）与 `llm/client.ts`，勿裸调 fetch 第三方接口；新增模型提供者改 `db/AI提供者.ts` 相关逻辑。
- **B站接口走统一客户端**：`bili/client.ts` 单例 + `bili/rateLimit.ts` 限速，勿绕过直接发请求；B站 API 数据结构不稳定，解析时用 `Record<string, unknown>` + 显式类型断言（参考 `collector.ts` 的 `提取评论`）。
- **分析是长任务**：手动触发接口用 fire-and-forget + SSE 进度（`logger.ts` 广播），参考 `/api/采集/*` 的 `触发` 模式。
- **情感分析语义**：情感分数 -100~100（正/负/中性），`analyzer.ts` 的 `规范化` 兜底非法值；批量分析失败自动降级逐条。勿改变打分语义。
- **评测体系**：`llm/标注集.ts`（人工标注样本）+ `llm/评测.ts`（准确率/一致性/话题命中），改 prompt 或分析逻辑后跑 `/api/分析/评测` 验证不劣化。

## 环境

- Bun 运行时（ESM，`"type": "module"`）；服务端 TS 直接由 Bun 执行（`bun --watch src/index.ts`）。
- TypeScript：server 用 `bundler` 解析 + `types: ["bun"]`；client 用 `vue-tsc` 校验 `.vue`。
- 端口：server 5160（env `端口` 可改），client 5173，Vite 代理转发 API。
- 前端走 Geeker-Admin 模板（`client/`），保留其 hooks/directives 风格；新增页面统一放 `client/src/views/monitor/`。
