
# B站舆论监控

基于 Bun + Vue 3 的 Bilibili 舆论监控系统：定时采集指定 UP 主视频评论、关键词搜索视频评论及 UP 主动态，存入 SQLite，调用 LLM（DeepSeek / Gemini）做情感分析与量化统计，通过 Web 看板展示。


---

<div align="center" style="background-color: #fffbe6; border: 1px solid #ffe58f; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
  <h3 style="margin-top: 0; color: #faad14;">⚠️ 特别声明</h3>
  <p>本项目仅用于个人课题研究，存在较多问题。课题已结题，<b>极大概率不再维护</b>。</p>
  <p>推荐个功能更完善的开源项目：<b><a href="https://github.com/666ghj/BettaFish">BettaFish</a></b></p>
</div>

---


## 功能

- **监控目标**：UP 主视频评论、按关键词搜索的视频评论、UP 主动态正文
- **采集**：评论含楼中楼完整回复、视频统计指标快照（播放/点赞/收藏等）、动态正文
- **分析**：LLM 情感倾向分类（正/负/中）、量化分数（-100~100）、关键词、摘要；批量分析失败自动降级逐条
- **看板**：舆情概览、情感分布饼图、近 7 天趋势折线、任务管理、评论/动态/日志列表
- **调度**：定时采集，可手动触发

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

### 2. 启动

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

## 工作流程

1. 调度器按 `采集间隔分钟` 触发，或前端手动触发
2. 遍历启用的监控任务：
   - UP 主任务：获取投稿视频 → 保存视频 → 拉取视频详情统计 → 对新视频采集评论 → 采集动态
   - 关键词任务：搜索视频 → 保存视频 → 对新视频采集评论
3. 采集后批量调用 LLM 分析未处理评论，写入情感分析表
4. 全程记录采集日志，前端看板实时查询展示


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
bun run check        # biome + 双端类型检查（提交前必跑）
```
