<template>
  <div class="monitor-overview">
    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col v-for="card in statCards" :key="card.label" :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" :style="{ color: card.color, backgroundColor: card.bg }">
              <component :is="card.icon" />
            </el-icon>
            <div class="stat-info">
              <div class="stat-num">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col v-for="card in extraCards" :key="card.label" :xs="12" :sm="12" :md="6">
        <el-tooltip v-if="card.tip" :content="card.tip" placement="top">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-content">
              <el-icon class="stat-icon" :style="{ color: card.color, backgroundColor: card.bg }">
                <component :is="card.icon" />
              </el-icon>
              <div class="stat-info">
                <div class="stat-num">
                  {{ card.value }}
                  <el-tag v-if="card.tag" size="small" :type="card.tag.startsWith('↓') ? 'danger' : card.tag.startsWith('↑') ? 'success' : 'info'">{{ card.tag }}</el-tag>
                </div>
                <div class="stat-label">{{ card.label }}</div>
              </div>
            </div>
          </el-card>
        </el-tooltip>
        <el-card v-else shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" :style="{ color: card.color, backgroundColor: card.bg }">
              <component :is="card.icon" />
            </el-icon>
            <div class="stat-info">
              <div class="stat-num">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="10">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>情感分布</span>
              <el-tag v-if="distTotal" size="small" type="info">共 {{ distTotal }} 条已分析</el-tag>
            </div>
          </template>
          <ECharts v-if="dist.length" :option="pieOption" height="320px" />
          <el-empty v-else description="暂无情感分析数据" :image-size="100" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>评论趋势</span>
              <el-radio-group v-model="趋势天数" size="small" @change="loadTrend">
                <el-radio-button :value="7">7天</el-radio-button>
                <el-radio-button :value="14">14天</el-radio-button>
                <el-radio-button :value="30">30天</el-radio-button>
                <el-radio-button :value="90">90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <ECharts v-if="trend.length" :option="lineOption" height="320px" />
          <el-empty v-else description="暂无趋势数据" :image-size="100" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 舆论分析面板：热门话题 + 舆情预警（话题 × 情感交叉，回答"在讨论什么"） -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="14">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>🔥 热门话题</span>
              <el-tag v-if="话题列表.length" size="small" type="info">TOP {{ 话题列表.length }}</el-tag>
            </div>
          </template>
          <div v-if="话题列表.length" class="topic-list">
            <div v-for="(t, i) in 话题列表" :key="t.话题" class="topic-row">
              <span class="topic-rank" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
              <span class="topic-name">{{ t.话题 }}</span>
              <span class="topic-count">{{ t.数 }} 条</span>
              <div class="topic-bar">
                <div class="topic-bar-正面" :style="{ width: 正面比例(t) + '%' }" />
                <div class="topic-bar-负面" :style="{ width: 负面比例(t) + '%' }" />
              </div>
              <span class="topic-split">{{ 正面比例(t) }}% / {{ 负面比例(t) }}%</span>
            </div>
          </div>
          <el-empty v-else description="暂无话题数据（需先运行情感分析）" :image-size="100" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>🚨 舆情预警</span>
              <el-tag v-if="舆情预警列表.length" size="small" type="danger">负面话题 {{ 舆情预警列表.length }}</el-tag>
            </div>
          </template>
          <div v-if="舆情预警列表.length" class="warning-list">
            <div v-for="w in 舆情预警列表" :key="w.话题" class="warning-row">
              <el-tag size="small" type="danger" effect="dark">负面 {{ Math.round(w.负面占比 * 100) }}%</el-tag>
              <span class="warning-name">{{ w.话题 }}</span>
              <span class="warning-count">{{ w.负面数 }} 条</span>
            </div>
          </div>
          <el-empty v-else description="暂无负面话题预警" :image-size="100" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 分析进度面板（分析进行中时显示） -->
    <el-card v-if="进度面板显示" shadow="hover" class="progress-card">
      <template #header>
        <div class="card-header">
          <span>🧠 分析进度</span>
          <div class="progress-header-right">
            <el-tag size="small" type="info">{{ 分析进度.模型 }}</el-tag>
            <span class="progress-text">{{ 分析进度.已分析 }} / {{ 分析进度.总数 }}</span>
            <el-tag v-if="分析进度.失败 > 0" size="small" type="danger">失败 {{ 分析进度.失败 }}</el-tag>
          </div>
        </div>
      </template>
      <el-progress
        :percentage="进度百分比"
        :stroke-width="18"
        :status="分析进度.失败 > 0 ? 'warning' : undefined"
      >
        <span class="progress-label">第 {{ 分析进度.批次 }} 批 · {{ 进度百分比 }}%</span>
      </el-progress>
      <div v-if="分析进度.思考" class="thinking-box">
        <div class="thinking-title">💭 思维链</div>
        <div class="thinking-content">{{ 分析进度.思考 }}</div>
      </div>
    </el-card>

    <!-- 操作区 -->
    <el-card shadow="never" class="action-card">
      <div class="action-group">
        <span class="group-label">数据</span>
        <el-button :icon="Refresh" @click="loadData">刷新数据</el-button>
        <el-tag v-if="自动刷新中" size="small" effect="dark" type="success">自动刷新中</el-tag>
        <el-tag v-if="熔断提示" size="small" effect="dark" type="danger">{{ 熔断提示 }}</el-tag>
        <el-tag v-if="预算提示" size="small" effect="plain" type="warning">{{ 预算提示 }}</el-tag>
        <el-tag v-if="采样提示" size="small" effect="plain" type="info">{{ 采样提示 }}</el-tag>
      </div>
      <div class="action-group">
        <span class="group-label">采集</span>
        <el-button :icon="VideoCamera" :loading="loading.视频" @click="触发任务(collectVideoApi, '视频', '采集视频')">采集视频</el-button>
        <el-button :icon="ChatDotRound" :loading="loading.评论" @click="触发任务(collectCommentApi, '评论', '采集评论')">采集评论</el-button>
        <el-button :icon="Bell" :loading="loading.动态" @click="触发任务(collectDynamicApi, '动态', '采集动态')">采集动态</el-button>
        <el-button type="primary" :icon="Promotion" :loading="loading.全部" @click="触发任务(collectAllApi, '全部', '一键采集')">一键采集全部</el-button>
      </div>
      <div class="action-group">
        <span class="group-label">分析</span>
        <el-button type="warning" :icon="DataAnalysis" :loading="loading.未处理" @click="触发任务(analyzePendingApi, '未处理', '分析未处理')">分析未处理评论</el-button>
        <el-button type="danger" :icon="DataAnalysis" :loading="loading.重新全部" @click="触发任务(analyzeAllApi, '重新全部', '重新分析全部')">重新分析全部评论</el-button>
        <el-button v-if="进度面板显示" type="info" :icon="VideoPause" :loading="分析停止中" @click="停止分析">停止分析</el-button>
        <el-button type="primary" plain :icon="DataAnalysis" :loading="评测中" @click="运行评测">🎯 评测准确度</el-button>
      </div>
    </el-card>

    <!-- 评测报告弹窗 -->
    <el-dialog v-model="评测弹窗显示" title="🎯 情感分析评测报告" width="720px" top="6vh">
      <div v-if="评测报告" class="评测报告">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="模型">{{ 评测报告.倾向.模型 }}</el-descriptions-item>
          <el-descriptions-item label="准确率">
            <el-tag :type="评测报告.倾向.准确率 >= 0.7 ? 'success' : 评测报告.倾向.准确率 >= 0.5 ? 'warning' : 'danger'">
              {{ (评测报告.倾向.准确率 * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="宏平均F1">{{ 评测报告.倾向.宏平均F1 }}</el-descriptions-item>
          <el-descriptions-item label="样本数">{{ 评测报告.倾向.正确数 }}/{{ 评测报告.倾向.样本总数 }}</el-descriptions-item>
          <el-descriptions-item label="特殊语境正确率">
            <el-tag :type="评测报告.倾向.特殊语境正确率 >= 0.7 ? 'success' : 'warning'">
              {{ (评测报告.倾向.特殊语境正确率 * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="单条vs批量一致率">
            <el-tag :type="评测报告.一致性.倾向一致率 >= 0.9 ? 'success' : 'warning'">
              {{ (评测报告.一致性.倾向一致率 * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h4>各类别 P/R/F1</h4>
        <el-table :data="评测报告.倾向.各类别" size="small" border>
          <el-table-column prop="类别" label="类别" width="100" />
          <el-table-column prop="样本数" label="样本数" width="80" />
          <el-table-column prop="精确率" label="精确率 P" />
          <el-table-column prop="召回率" label="召回率 R" />
          <el-table-column prop="F1" label="F1" />
        </el-table>

        <h4>特殊语境样本（反讽/梗/缩写/谐音）</h4>
        <el-table :data="评测报告.倾向.特殊语境样本" size="small" border max-height="220">
          <el-table-column prop="内容" label="内容" min-width="160" />
          <el-table-column prop="说明" label="考察点" width="140" />
          <el-table-column prop="期望" label="期望" width="70" />
          <el-table-column prop="实际" label="实际" width="70" />
          <el-table-column label="结果" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.正确 ? 'success' : 'danger'" size="small">{{ row.正确 ? "✓" : "✗" }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="评测报告.一致性.不一致样本.length" class="warn-tip">
          ⚠️ 单条与批量存在 {{ 评测报告.一致性.不一致样本.length }} 条不一致（批量注意力偏移风险，建议关注）
        </div>
        <div v-else class="ok-tip">✅ 单条与批量判定完全一致，无批量污染</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="monitorOverview">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Bell, ChatDotRound, ChatLineSquare, DataAnalysis, Promotion, Refresh, TrendCharts, VideoCamera, VideoPause, Warning } from "@element-plus/icons-vue";
import ECharts from "@/components/ECharts/index.vue";
import { ECOption } from "@/components/ECharts/config";
import type { Monitor } from "@/api/interface/monitor";
import {
  getOverviewApi,
  getSentimentDistApi,
  getTrendApi,
  get话题统计Api,
  get舆情预警Api,
  get加权情感Api,
  get容错状态Api,
  collectVideoApi,
  collectCommentApi,
  collectDynamicApi,
  collectAllApi,
  analyzePendingApi,
  analyzeAllApi,
  getConfigApi,
  stopAnalysisApi,
  run评测Api,
} from "@/api/modules/monitor";

const overview = ref({
  视频总数: 0, 评论总数: 0, 动态总数: 0, 已分析评论: 0, 已删除评论: 0,
  情感分布: {} as Record<string, number>,
});
const dist = ref<{ 倾向: string; 数: number }[]>([]);
const trend = ref<{ 日期: string; 评论数: number; 平均分数: number }[]>([]);
const 话题列表 = ref<Monitor.话题统计项[]>([]);
const 舆情预警列表 = ref<Monitor.话题统计项[]>([]);
const 趋势天数 = ref(7);

const loading = reactive({
  视频: false, 评论: false, 动态: false, 全部: false, 未处理: false, 重新全部: false,
});

const 未分析评论 = computed(() => overview.value.评论总数 - overview.value.已分析评论);
/** 加权情感指数（点赞×讨论热度加权，来自后端 SQL 聚合） */
const 加权情感 = ref<Monitor.加权情感报告 | null>(null);
const 加权情感分 = computed(() => 加权情感.value?.加权情感指数 ?? 0);
/** 加权与简单平均的差异（体现热度权重的影响） */
const 加权差异 = computed(() => {
  if (!加权情感.value) return 0;
  return Math.round((加权情感.value.加权情感指数 - 加权情感.value.简单情感指数) * 10) / 10;
});

const statCards = computed(() => [
  { label: "视频", value: overview.value.视频总数, icon: VideoCamera, color: "#409eff", bg: "#ecf5ff" },
  { label: "评论", value: overview.value.评论总数, icon: ChatDotRound, color: "#67c23a", bg: "#f0f9eb" },
  { label: "动态", value: overview.value.动态总数, icon: Bell, color: "#e6a23c", bg: "#fdf6ec" },
  { label: "已分析评论", value: overview.value.已分析评论, icon: DataAnalysis, color: "#f56c6c", bg: "#fef0f0" },
]);

const extraCards = computed(() => [
  { label: "未分析评论", value: 未分析评论.value, icon: ChatLineSquare, color: "#909399", bg: "#f4f4f5" },
  {
    // 加权情感指数：每条评论权重 = (点赞数+1) × (1+log(1+回复数))，热度越高权重越大
    label: "加权情感指数",
    value: 加权情感分.value.toFixed(1),
    icon: TrendCharts,
    color: 加权情感分.value < -10 ? "#f56c6c" : 加权情感分.value > 10 ? "#67c23a" : "#909399",
    bg: "#f5f7fa",
    tip: `加权（点赞×讨论热度）${加权情感分.value.toFixed(1)} vs 简单平均 ${加权情感.value?.简单情感指数 ?? 0}（差异 ${加权差异.value > 0 ? "+" : ""}${加权差异.value}）`,
    tag: 加权差异.value !== 0 ? `${加权差异.value > 0 ? "↑" : "↓"}${Math.abs(加权差异.value)}` : "≈",
  },
]);

/** 极端负面高赞评论（点赞>=1000 且分数<=-60）：高共鸣负面信号 */
const 极端负面高赞 = computed(() => 加权情感.value?.极端负面高赞数 ?? 0);

// ===== LLM 容错状态（熔断/预算/采样）=====
const 容错状态 = ref<Monitor.容错状态 | null>(null);
const 熔断提示 = computed(() => {
  if (!容错状态.value?.熔断.熔断中) return null;
  return `⛔ LLM 熔断中（剩 ${容错状态.value.熔断.剩余秒} 秒）`;
});
const 预算提示 = computed(() => {
  const 预算 = 容错状态.value?.预算;
  if (!预算 || 预算.预算 === null) return null;
  return `💰 预算 ${预算.已用}/${预算.预算} 次调用`;
});
const 采样提示 = computed(() => {
  const 采样 = 容错状态.value?.采样;
  if (!采样 || 采样.已跳过 === 0) return null;
  return `🎯 已采样 ${采样.已采样} 条 / 跳过 ${采样.已跳过} 条`;
});
const load容错状态 = async () => {
  try {
    容错状态.value = await get容错状态Api();
  } catch { /* 静默 */ }
};

const distTotal = computed(() => dist.value.reduce((s, d) => s + d.数, 0));

/** 话题正/负占比（用于话题条与图例） */
const 正面比例 = (t: Monitor.话题统计项) => (t.数 > 0 ? Math.round((t.正面数 / t.数) * 100) : 0);
const 负面比例 = (t: Monitor.话题统计项) => (t.数 > 0 ? Math.round((t.负面数 / t.数) * 100) : 0);

const sentimentColor: Record<string, string> = { 正面: "#67c23a", 负面: "#f56c6c", 中性: "#909399" };

const pieOption = computed<ECOption>(() => ({
  tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
  legend: { bottom: 0, left: "center" },
  series: [{
    type: "pie", radius: ["40%", "70%"], center: ["50%", "45%"],
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
    label: { show: true, formatter: "{b}: {d}%" },
    data: dist.value.map(d => ({
      name: d.倾向 || "未知", value: d.数,
      itemStyle: { color: sentimentColor[d.倾向] || "#409eff" },
    })),
  }],
}));

const lineOption = computed<ECOption>(() => {
  const sorted = [...trend.value].reverse();
  return {
    tooltip: { trigger: "axis" },
    legend: { data: ["评论数", "平均情感分"] },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: sorted.map(t => t.日期), boundaryGap: false },
    yAxis: [
      { type: "value", name: "评论数", min: 0 },
      { type: "value", name: "情感分", min: -100, max: 100 },
    ],
    series: [
      { name: "评论数", type: "line", smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: "#409eff" }, data: sorted.map(t => t.评论数) },
      { name: "平均情感分", type: "line", yAxisIndex: 1, smooth: true, itemStyle: { color: "#67c23a" }, data: sorted.map(t => t.平均分数) },
    ],
  };
});

/** 请求序号守卫：防止自动刷新与手动刷新并发时，慢响应覆盖新数据（概览与趋势各用各的序号） */
let 数据请求序号 = 0;
let 趋势请求序号 = 0;
let 话题请求序号 = 0;
const loadData = async () => {
  const 本次 = ++数据请求序号;
  try {
    const [概, 分, 加权] = await Promise.all([
      getOverviewApi(),
      getSentimentDistApi(),
      get加权情感Api().catch(() => null), // 无数据时忽略
    ]);
    if (本次 !== 数据请求序号) return;
    overview.value = 概;
    dist.value = 分;
    if (加权) 加权情感.value = 加权;
  } catch (e) {
    if (本次 !== 数据请求序号) return;
    ElMessage.error(e instanceof Error ? e.message : "加载数据失败");
  }
};

/** 加载舆论分析（话题 + 预警） */
const load话题 = async () => {
  const 本次 = ++话题请求序号;
  try {
    const [话题, 预警] = await Promise.all([get话题统计Api(20), get舆情预警Api(10)]);
    if (本次 !== 话题请求序号) return;
    话题列表.value = 话题;
    舆情预警列表.value = 预警;
  } catch (e) {
    if (本次 !== 话题请求序号) return;
    ElMessage.error(e instanceof Error ? e.message : "加载话题分析失败");
  }
};

const loadTrend = async () => {
  const 本次 = ++趋势请求序号;
  try {
    const 结果 = await getTrendApi(趋势天数.value);
    if (本次 !== 趋势请求序号) return;
    trend.value = 结果;
  } catch (e) {
    if (本次 !== 趋势请求序号) return;
    ElMessage.error(e instanceof Error ? e.message : "加载趋势失败");
  }
};

/** 自动刷新 */
let 定时器: ReturnType<typeof setInterval> | null = null;
const 自动刷新中 = ref(false);

const 启动自动刷新 = async () => {
  try {
    const cfg = await getConfigApi() as unknown as Record<string, unknown>;
    const 秒 = Number(cfg["自动刷新秒数"] ?? 0);
    if (秒 > 0) {
      自动刷新中.value = true;
      定时器 = setInterval(() => { loadData(); loadTrend(); load话题(); }, 秒 * 1000);
    }
  } catch { /* 配置读取失败不阻塞 */ }
};

/** 通用触发 */
let 刷新延迟定时器: ReturnType<typeof setTimeout> | null = null;
async function 触发任务(
  api: () => Promise<{ 消息: string }>,
  键: "视频" | "评论" | "动态" | "全部" | "未处理" | "重新全部", 名称: string,
) {
  loading[键] = true;
  try {
    const res = await api();
    ElMessage.success(res.消息 || `已触发${名称}`);
    // 分析类操作：立即显示进度面板（等待 SSE 推送进度）
    if (键 === "未处理" || 键 === "重新全部") {
      分析进度.value = { 类型: "分析进度", 已分析: 0, 总数: 0, 失败: 0, 批次: 0, 模型: "", 思考: "" };
      进度面板显示.value = true;
    }
    // 延迟刷新数据（合并多次触发，避免堆叠定时器；卸载后不再执行）
    if (刷新延迟定时器) clearTimeout(刷新延迟定时器);
    刷新延迟定时器 = setTimeout(() => {
      刷新延迟定时器 = null;
      if (已卸载) return;
      loadData();
    }, 3000);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : `触发${名称}失败`);
  } finally {
    loading[键] = false;
  }
}

/** 停止分析 */
const 分析停止中 = ref(false);
async function 停止分析() {
  分析停止中.value = true;
  try {
    await stopAnalysisApi();
    ElMessage.info("已发送停止请求");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "停止失败");
  } finally {
    分析停止中.value = false;
  }
}

// ===== 情感分析评测 =====
const 评测中 = ref(false);
const 评测弹窗显示 = ref(false);
const 评测报告 = ref<Monitor.评测报告 | null>(null);
async function 运行评测() {
  评测中.value = true;
  ElMessage.info("评测进行中（对标注集逐条+批量分析），约需 1-3 分钟…");
  try {
    const 报告 = await run评测Api();
    评测报告.value = 报告;
    评测弹窗显示.value = true;
    ElMessage.success("评测完成，已生成报告");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "评测失败（请确认已配置 AI 提供者）");
  } finally {
    评测中.value = false;
  }
}

onMounted(() => {
  loadData();
  loadTrend();
  load话题();
  load容错状态();
  启动自动刷新();
  连接分析进度SSE();
});

onBeforeUnmount(() => {
  已卸载 = true;
  if (定时器) clearInterval(定时器);
  if (重连定时器) { clearTimeout(重连定时器); 重连定时器 = null; }
  if (刷新延迟定时器) { clearTimeout(刷新延迟定时器); 刷新延迟定时器 = null; }
  断开分析进度SSE();
});

// ===== 分析进度 SSE 监听 =====
const 分析进度 = ref<Monitor.分析进度>({ 类型: "分析进度", 已分析: 0, 总数: 0, 失败: 0, 批次: 0, 模型: "", 思考: "" });
const 进度面板显示 = ref(false);
let 进度SSE: EventSource | null = null;
/** 已卸载守卫：防止组件卸载后重连定时器新建僵尸 EventSource */
let 已卸载 = false;
/** 重连定时器句柄：卸载时清理 */
let 重连定时器: ReturnType<typeof setTimeout> | null = null;

const 进度百分比 = computed(() => {
  if (分析进度.value.总数 === 0) return 0;
  return Math.round((分析进度.value.已分析 / 分析进度.value.总数) * 100);
});

function 连接分析进度SSE() {
  if (进度SSE || 已卸载) return;
  // EventSource 无法设置自定义请求头，改用 query 参数携带访问令牌（后端中间件同时支持两种方式）
  const 令牌 = localStorage.getItem("访问令牌");
  进度SSE = new EventSource(`/api/控制台日志/流${令牌 ? `?token=${encodeURIComponent(令牌)}` : ""}`);
  进度SSE.addEventListener("分析进度", (event: MessageEvent) => {
    if (已卸载) return;
    try {
      const 数据: Monitor.分析进度 = JSON.parse(event.data);
      分析进度.value = 数据;
      if (!进度面板显示.value) 进度面板显示.value = true;
      // 分析完成或停止时自动刷新数据
      if (数据.已分析 >= 数据.总数 || 数据.总数 === 0) {
        setTimeout(() => {
          if (已卸载) return;
          进度面板显示.value = false;
          loadData();
          loadTrend();
        }, 3000);
      }
    } catch { /* 忽略解析错误 */ }
  });
  进度SSE.onerror = () => {
    断开分析进度SSE();
    if (已卸载) return;
    if (重连定时器) clearTimeout(重连定时器);
    重连定时器 = setTimeout(() => {
      重连定时器 = null;
      连接分析进度SSE();
    }, 5000);
  };
}

function 断开分析进度SSE() {
  if (进度SSE) { 进度SSE.close(); 进度SSE = null; }
}
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
