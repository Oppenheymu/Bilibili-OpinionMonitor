# B站舆论监控

基于 Bun + Vue 3 的 Bilibili 舆论监控系统：定时采集指定 UP 主视频评论、关键词搜索视频评论及 UP 主动态，存入 SQLite，调用 LLM（DeepSeek / Gemini）做情感分析与量化统计，通过 Web 看板展示。

## 功能

- **监控目标**：UP 主视频评论、按关键词搜索的视频评论、UP 主动态正文
- **采集**：评论含楼中楼完整回复、视频统计指标快照（播放/点赞/收藏等）、动态正文
- **分析**：LLM 情感倾向分类（正/负/中）、量化分数（-100~100）、关键词、摘要；批量分析失败自动降级逐条
- **看板**：舆情概览、情感分布饼图、近 7 天趋势折线、任务管理、评论/动态/日志列表
- **调度**：定时采集，可手动触发

## 技术栈

- 运行时 / 包管理：Bun
- 后端：TypeScript (ESM)、Hono、drizzle-orm、bun:sqlite、@renmu/bili-api
- 前端：Vue 3、Vite、TDesign Vue Next、ECharts
- LLM：DeepSeek / Gemini（统一走 OpenAI 兼容接口）
- 格式化 / Lint：Biome

## 项目结构

```
bili-opinion-monitor/
├─ package.json            # workspace 根
├─ biome.json
├─ server/                 # 后端
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ drizzle.config.ts
│  ├─ .env.example
│  └─ src/
│     ├─ index.ts          # 入口（HTTP 服务 + 调度器）
│     ├─ env.d.ts
│     ├─ api/              # Hono 路由
│     ├─ bili/             # B站登录与采集（client/login/collector/types）
│     ├─ db/               # schema、连接、repository
│     ├─ llm/              # LLM 客户端与情感分析
│     └─ scheduler/        # 定时调度
└─ client/                 # 前端
   ├─ package.json
   ├─ vite.config.ts       # /api 代理到 5160
   └─ src/
      ├─ api.ts            # 请求封装
      ├─ App.vue           # 主布局
      └─ views/            # Overview/Tasks/Comments/Dynamics/Logs
```

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，至少填写一个 LLM 密钥：

```
端口=5160
数据库路径=./data/monitor.db
B站凭证路径=./data/bili-凭证.json
LLM默认提供商=deepseek
DeepSeek密钥=sk-xxxx
DeepSeek地址=https://api.deepseek.com/v1
DeepSeek模型=deepseek-chat
Gemini密钥=
Gemini地址=https://generativelanguage.googleapis.com/v1beta/openai
Gemini模型=gemini-2.5-flash
采集间隔分钟=30
单视频评论上限=500
```

### 3. 初始化数据库

```bash
cd server
bun run db:推送
```

### 4. 启动

开发模式（前后端并行）：

```bash
bun run dev
```

或分别启动：

```bash
bun run dev:server   # 后端 http://localhost:5160
bun run dev:client   # 前端 http://localhost:5173
```

首次启动后端会打印 B 站登录二维码，用哔哩哔哩 APP 扫码登录，凭证缓存后无需重复登录。

### 5. 添加监控任务

通过前端「监控任务」页新建，或直接 SQL：

```sql
INSERT INTO 监控任务 (类型, 目标, 启用, 创建时间) VALUES ('up主', '946974', 1, strftime('%s','now'));
INSERT INTO 监控任务 (类型, 目标, 启用, 创建时间) VALUES ('关键词', '某话题', 1, strftime('%s','now'));
```

## 数据库表（SQLite，中文命名）

| 表 | 说明 |
|---|---|
| 监控任务 | UP 主 / 关键词任务 |
| 视频 | 采集到的视频元信息 |
| 视频统计 | 每次采集的指标快照（观察趋势） |
| 评论 | 评论含楼中楼，`根rpid` 关联 |
| 动态 | UP 主动态正文 |
| 情感分析 | LLM 分析结果（倾向/分数/关键词/摘要） |
| 采集日志 | 采集执行记录 |

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/任务` | 列出任务 |
| POST | `/api/任务` | 创建任务 `{类型, 目标}` |
| PATCH | `/api/任务/:id` | 启用/禁用 `{启用}` |
| DELETE | `/api/任务/:id` | 删除任务 |
| GET | `/api/视频` `/api/评论` `/api/动态` `/api/日志` | 分页查询（`?页=&大小=&视频ID=&情感=`） |
| GET | `/api/统计/概览` `/api/统计/情感分布` `/api/统计/趋势` | 舆情统计 |
| POST | `/api/采集/触发` | 手动触发一次采集 |

## 工作流程

1. 调度器按 `采集间隔分钟` 触发，或前端手动触发
2. 遍历启用的监控任务：
   - UP 主任务：获取投稿视频 → 保存视频 → 拉取视频详情统计 → 对新视频采集评论 → 采集动态
   - 关键词任务：搜索视频 → 保存视频 → 对新视频采集评论
3. 采集后批量调用 LLM 分析未处理评论，写入情感分析表
4. 全程记录采集日志，前端看板实时查询展示

## 命名约定

- 文件夹与文件名：英文
- 代码标识符（变量/函数/类/类型）、数据库表名/列名、API 路径、环境变量键：中文

## 后续改进方向

供后续用 AI 迭代参考：

- [ ] 评论情感分析准确率优化（prompt 调优、few-shot 示例）
- [ ] 敏感词/关键词预警（命中后 webhook/邮件通知）
- [ ] 视频指标趋势可视化（多时间点对比折线）
- [ ] 楼中楼完整采集的风控应对（cookie 注入到楼中楼请求）
- [ ] 动态正文也接入 LLM 分析
- [ ] 评论话题聚合提取（聚类找热点）
- [ ] 分页返回总数、前端完善分页器
- [ ] 登录态过期检测与自动重登
- [ ] Docker 化部署
- [ ] 单元测试

## 常用命令

```bash
# 后端
cd server
bun run dev          # 热重载开发
bun run db:推送      # 推送 schema 到 SQLite
bun run db:查看      # drizzle studio 可视化数据库

# 前端
cd client
bun run dev          # 开发
bun run build        # 构建

# 根目录
bun run dev          # 并行启动前后端
```
