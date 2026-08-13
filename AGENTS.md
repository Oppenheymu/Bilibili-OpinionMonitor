# bili-opinion-monitor 工程指南

> 本文件是项目级指令（VS Code Copilot 自动加载）。开始任何工作前，先读本文件；涉及数据库、LLM、B站采集的改动，先读对应模块源码再动手。

## 项目是什么

B站舆情监控系统：采集指定 UP 主/关键词的视频、评论、动态，用 LLM 做情感分析与舆论分析，后台看板展示趋势与预警。**双包 monorepo**：`client`（Vue 3 后台看板）+ `server`（Hono 后端）。包管理器 Bun，数据库 SQLite（Drizzle ORM），B站接口走 `@renmu/bili-api`，LLM 走 OpenAI 兼容接口（DeepSeek/Gemini 等）。

## 硬性约束（违反 = 错误）

1. **标识符用英文（开源规范）**：函数名、变量名、API 路由、数据库列名/表名、文件名均用英文（camelCase / PascalCase / snake_case / kebab-case）。**中文只出现在注释、界面文案与业务数据里**（如任务类型值 `up主`/`关键词`、情感倾向 `正面`/`负面`/`中性`、配置键 `采集间隔分钟` 等是存储于数据库的业务数据，保留中文）。biome 已开启 `useNamingConvention`（requireAscii: true，中文标识符直接报 error）与 `useFilenamingConvention`（camelCase/kebab-case）——新代码必须通过 biome 检查。
2. **敏感数据必须加密存储**：`server/src/db/encrypted.ts` 的 `encryptedText` 类型（AES-256-GCM）不可绕过。AI 提供者的 API 密钥、访问令牌等一律用该类型；主密钥存 `data/.enc-key`（自动生成，**不入库、不入 git**）。明文 `enc:` 前缀的兼容逻辑勿破坏。
3. **访问令牌认证**：系统配置设置"访问令牌"后，除 `/api/config`（GET/PUT 豁免防死锁）外所有接口需 `Authorization: Bearer` / `x-access-token` / SSE `?token=` 携带令牌。勿削弱该机制。
4. **日志统一走 console**：`server/src/logger.ts` 拦截 console 并 SSE 广播到看板控制台。不要引入 pino 等替代（会脱离控制台页面）。biome `noConsole` 为 error（client 端生效），**server 端已在 biome.jsonc override 关闭**——因为服务端日志机制依赖 console（拦截 + 广播），勿移除该 override。
5. **B站凭证**：扫码登录产物存 `server/data/bili-凭证.json`（不入 git）。含 Cookie，勿打印、勿提交。
6. **类型安全**：严格 TS 全家桶（`noUncheckedIndexedAccess`、`verbatimModuleSyntax`、`erasableSyntaxOnly` 等均为 error）。类型导入一律 `import type`；禁止 `enum`（`erasableSyntaxOnly` 限制，用 `as const` 对象）；禁止无注释的 `any`。
7. **异步纪律**：`noFloatingPromises` 为 error——异步调用必须 `await` 或显式 `.catch`；有意的 fire-and-forget（如触发采集、调度循环）须加 `// biome-ignore lint/nursery/noFloatingPromises: 理由` 注释。
8. **fire-and-forget 是项目模式**：手动采集/分析接口刻意不等待（长任务），进度通过 SSE 推送；勿改成同步等待（会阻塞请求）。
9. **HTTP 头键用小写**：fetch/Headers 大小写不敏感，对象字面量里用 `referer`/`cookie`/`authorization`/`connection` 等 camelCase（biome 的 objectLiteralMember 规则限制），勿写 `Referer`/`Cookie` 等 PascalCase 键。
10. **正则提升到模块顶层**：`useTopLevelRegex` 为 error——函数内勿写正则字面量，提到模块级常量（如 `const PATTERN = /.../`）。

## 架构速览

```
client/   Vue 3 + Vite 4 + Element Plus + Pinia（后台看板）
  src/api/modules/monitor.ts    # 全部业务接口（英文路径）
  src/views/monitor/            # 看板页面：overview/comments/videos/dynamics/tasks/ai-providers/bili-service
server/   Hono + Bun + SQLite(Drizzle) + LLM
  src/api/                      # 路由入口 + 模块路由（modules/ai-providers.ts / modules/bili.ts）
  src/bili/                     # client.ts(单例) / collector.ts(采集) / login.ts(扫码) / rateLimit.ts
  src/db/                       # schema.ts(9张表) / repository.ts / collection-write.ts / queries.ts / task-management.ts / config.ts / stopwords.ts / ai-providers.ts / encrypted.ts
  src/llm/                      # client.ts(OpenAI兼容) / analyzer.ts(情感分析) / fault-tolerance.ts(熔断·预算·采样) / evaluation.ts(标注评测) / annotation-set.ts / annotation-sample.ts
  src/scheduler/                # index.ts(启动调度) / params.ts / collection.ts / analysis.ts
  src/logger.ts                 # console 拦截 + SSE 广播
```

**数据库表（9 张，`server/src/db/schema.ts`）**：`monitor_tasks`、`videos`、`video_stats`、`comments`、`dynamics`、`sentiment_analysis`、`collection_logs`、`system_config`（`value` 列用 `encryptedText`）、`ai_providers`（API 密钥用 `encryptedText`）。

**关键流程**：
- 采集：调度器/scheduler 或手动 API → `bili/collector`（受 `rateLimit` 限速）→ `db/collection-write` → 写日志表
- 分析：`db/queries` 取未处理评论 → `llm/analyzer`（受 `fault-tolerance.ts` 熔断/预算/采样控制）→ 写 `sentiment_analysis` 表
- 舆论分析：`sentiment_analysis.keywords`（JSON 数组）经 `topicStats` 展开聚合，`stopwords.ts` 过滤噪音

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

## 设计先行原则（最高优先级）

**任何交付物（代码改动、报告、PPT、文档）动手前，必须先产出设计方案并落盘 `docs/`**，方案经确认（大改动）或简述（小改动）后再实施：

1. **先设计后编码**：先写清「目标 / 范围 / 影响面 / 内容草案」，涉及跨模块或破坏性改动必须设计先行 + 用户确认。
2. **报告 / PPT / 文档类交付**：先列「每页 / 每节填什么、数据从哪来（代码事实 or 用户提供）」，再批量填充。
3. **设计文档落盘**：代码模块设计放各模块 `docs/design.md`；报告 / 汇报类设计放根 `docs/`（如 `docs/ppt-design.md`）。
4. **诚实原则**：不编造数据（评测准确率、样本数等以实际运行为准）；评测不达标时如实写入「不足」页，并给出下阶段优化方向。
5. **交付优先级**：deadline 临近时按「报告材料 > 核心功能 > 调试优化」排序，先保证交付物完整可用。

## 自主迭代工作流（默认模式）

面向持续迭代的默认工作模式，**每轮改动遵循以下循环**：

1. **读指令**：先读本文件（AGENTS.md）与对应模块源码（`server/src/db/schema.ts`、`llm/analyzer.ts`、`bili/collector.ts` 等），理解现状再动手。
2. **定方案**：遵循「设计先行原则」，简述改动方案与影响面（涉及 DB 改动先看 schema；涉及 LLM 调用走容错层；涉及 B站采集走统一客户端）。
3. **小步实现**：一个模块一个模块实现，**每次只改一个文件的单个逻辑点**，改完立即验证，不堆叠改动。
4. **自动修复**：跑 `bunx biome check --write .`（安全修复）+ `bunx biome check --unsafe --write .`（含 unsafe 修复）处理可自动修复项。
5. **验证**：跑 `bun run check`（biome + 双端类型必须 0 error）；必要时 `bun run dev` 起服务人工验证（前端改动建议用浏览器工具验证）。
6. **收尾提交**：确认通过后提交 git（中文提交信息，如 `feat: 新增xxx` / `fix: 修复xxx` / `refactor: 重构xxx` / `chore: 更新配置`）。

**例外（先说明方案再动手）**：删除数据库表/列、修改情感分析打分语义、修改访问令牌认证机制、更换日志机制、破坏性迁移——这些必须先向用户说明方案与影响，确认后再实施。

**biome 冲突处理原则**：若 biome 规则与项目机制冲突（如 `noConsole` vs 服务端日志拦截），优先在 `biome.jsonc` 加 override 说明理由，而非删除日志/绕过机制；override 的 `includes` 要精确到文件或目录。

## 代码风格（biome 已强制，手动也须遵守）

- 缩进 **space+4**，行尾 **LF**（Windows 下 CRLF 会被 biome 修复）；字符串双引号、分号、尾逗号。
- 中文注释与 JSDoc：模块头写清职责，函数写清入参/返回/副作用（参考 `encrypted.ts`、`fault-tolerance.ts` 的注释风格）。
- 类型导入一律 `import type`；禁止 `enum`（用 `as const` 对象 + `typeof` 推导类型）；禁止无注释的 `any`。
- `noFloatingPromises` 为 error：fire-and-forget 必须有 `biome-ignore` 注释说明理由。
- 错误处理：业务错误 `throw new Error("中文描述")`，路由层统一 catch 返回 `{ 错误 }`；不静默吞错。

## 实现模式（重要）

- **一个模块一个模块实现**：改前先读对应模块源码，理解现状再动手；每完成一个改动跑一次 `bun run check`。
- **数据库改动先看 schema**：新表/新列在 `schema.ts` 加，改完提醒 `bun run db:push`；敏感字段必须 `encryptedText`。
- **LLM 调用走容错层**：任何 LLM 调用经 `llm/fault-tolerance.ts`（熔断/预算/采样）与 `llm/client.ts`，勿裸调 fetch 第三方接口；新增模型提供者改 `db/ai-providers.ts` 相关逻辑。
- **B站接口走统一客户端**：`bili/client.ts` 单例 + `bili/rateLimit.ts` 限速，勿绕过直接发请求；B站 API 数据结构不稳定，解析时用 `Record<string, unknown>` + 显式类型断言（参考 `collector.ts` 的 `extractComment`）。
- **分析是长任务**：手动触发接口用 fire-and-forget + SSE 进度（`logger.ts` 广播），参考 `/api/collect/*` 的触发模式。
- **情感分析语义**：情感分数 -100~100（正/负/中性），`analyzer.ts` 的 `normalize` 兜底非法值；批量分析失败自动降级逐条。勿改变打分语义。
- **评测体系**：`llm/annotation-set.ts`（人工标注样本）+ `llm/evaluation.ts`（准确率/一致性/话题命中），改 prompt 或分析逻辑后跑 `/api/analyze/evaluate` 验证不劣化。

## 环境

- Bun 运行时（ESM，`"type": "module"`）；服务端 TS 直接由 Bun 执行（`bun --watch src/index.ts`）。
- TypeScript：server 用 `bundler` 解析 + `types: ["bun"]`；client 用 `vue-tsc` 校验 `.vue`。
- 端口：server 5160（env `PORT` 可改），client 5173，Vite 代理转发 API。
- 前端走 Geeker-Admin 模板（`client/`），保留其 hooks/directives 风格；新增页面统一放 `client/src/views/monitor/`。
