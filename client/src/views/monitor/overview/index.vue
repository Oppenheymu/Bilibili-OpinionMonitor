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
              <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
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
              <el-tag v-if="topicList.length" size="small" type="info">TOP {{ topicList.length }}</el-tag>
            </div>
          </template>
          <div v-if="topicList.length" class="topic-list">
            <div v-for="(t, i) in topicList" :key="t.topic" class="topic-row">
              <span class="topic-rank" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
              <span class="topic-name">{{ t.topic }}</span>
              <span class="topic-count">{{ t.count }} 条</span>
              <div class="topic-bar">
                <div class="topic-bar-正面" :style="{ width: positiveRatio(t) + '%' }" />
                <div class="topic-bar-负面" :style="{ width: negativeRatio(t) + '%' }" />
              </div>
              <span class="topic-split">{{ positiveRatio(t) }}% / {{ negativeRatio(t) }}%</span>
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
              <el-tag v-if="riskAlertList.length" size="small" type="danger">负面话题 {{ riskAlertList.length }}</el-tag>
            </div>
          </template>
          <div v-if="riskAlertList.length" class="warning-list">
            <div v-for="w in riskAlertList" :key="w.topic" class="warning-row">
              <el-tag size="small" type="danger" effect="dark">负面 {{ Math.round(w.negativeRatio * 100) }}%</el-tag>
              <span class="warning-name">{{ w.topic }}</span>
              <span class="warning-count">{{ w.negativeCount }} 条</span>
            </div>
          </div>
          <el-empty v-else description="暂无负面话题预警" :image-size="100" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 分析进度面板（分析进行中时显示） -->
    <el-card v-if="progressPanelVisible" shadow="hover" class="progress-card">
      <template #header>
        <div class="card-header">
          <span>🧠 分析进度</span>
          <div class="progress-header-right">
            <el-tag size="small" type="info">{{ analysisProgress.model }}</el-tag>
            <span class="progress-text">{{ analysisProgress.analyzed }} / {{ analysisProgress.total }}</span>
            <el-tag v-if="analysisProgress.failed > 0" size="small" type="danger">失败 {{ analysisProgress.failed }}</el-tag>
          </div>
        </div>
      </template>
      <el-progress
        :percentage="progressPercent"
        :stroke-width="18"
        :status="analysisProgress.failed > 0 ? 'warning' : undefined"
      >
        <span class="progress-label">第 {{ analysisProgress.batch }} 批 · {{ progressPercent }}%</span>
      </el-progress>
      <div v-if="analysisProgress.thinking" class="thinking-box">
        <div class="thinking-title">💭 思维链</div>
        <div class="thinking-content">{{ analysisProgress.thinking }}</div>
      </div>
    </el-card>

    <!-- 操作区 -->
    <el-card shadow="never" class="action-card">
      <div class="action-group">
        <span class="group-label">数据</span>
        <el-button :icon="Refresh" @click="loadData">刷新数据</el-button>
        <el-tag v-if="autoRefreshing" size="small" effect="dark" type="success">自动刷新中</el-tag>
        <el-tag v-if="circuitBreakerTip" size="small" effect="dark" type="danger">{{ circuitBreakerTip }}</el-tag>
        <el-tag v-if="budgetTip" size="small" effect="plain" type="warning">{{ budgetTip }}</el-tag>
        <el-tag v-if="samplingTip" size="small" effect="plain" type="info">{{ samplingTip }}</el-tag>
      </div>
      <div class="action-group">
        <span class="group-label">采集</span>
        <el-button :icon="VideoCamera" :loading="loading.video" @click="triggerAction(collectVideoApi, 'video', '采集视频')">采集视频</el-button>
        <el-button :icon="ChatDotRound" :loading="loading.comment" @click="triggerAction(collectCommentApi, 'comment', '采集评论')">采集评论</el-button>
        <el-button :icon="Bell" :loading="loading.dynamic" @click="triggerAction(collectDynamicApi, 'dynamic', '采集动态')">采集动态</el-button>
        <el-button type="primary" :icon="Promotion" :loading="loading.all" @click="triggerAction(collectAllApi, 'all', '一键采集')">一键采集全部</el-button>
      </div>
      <div class="action-group">
        <span class="group-label">分析</span>
        <el-button type="warning" :icon="DataAnalysis" :loading="loading.pending" @click="triggerAction(analyzePendingApi, 'pending', '分析未处理')">分析未处理评论</el-button>
        <el-button type="danger" :icon="DataAnalysis" :loading="loading.reanalyze" @click="triggerAction(analyzeAllApi, 'reanalyze', '重新分析全部')">重新分析全部评论</el-button>
        <el-button v-if="progressPanelVisible" type="info" :icon="VideoPause" :loading="stoppingAnalysis" @click="stopAnalysis">停止分析</el-button>
        <el-button type="primary" plain :icon="DataAnalysis" :loading="evaluating" @click="runEvaluation">🎯 评测准确度</el-button>
      </div>
    </el-card>

    <!-- 评测报告弹窗 -->
    <el-dialog v-model="evalDialogVisible" title="🎯 情感分析评测报告" width="780px" top="5vh">
      <div v-if="evalReport" class="评测报告">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="模型">{{ evalReport.sentiment.model }}</el-descriptions-item>
          <el-descriptions-item label="准确率">
            <el-tag :type="evalReport.sentiment.accuracy >= 0.7 ? 'success' : evalReport.sentiment.accuracy >= 0.5 ? 'warning' : 'danger'">
              {{ (evalReport.sentiment.accuracy * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="样本数">{{ evalReport.sentiment.correctCount }}/{{ evalReport.sentiment.totalSamples }}</el-descriptions-item>
          <el-descriptions-item label="95%置信区间">
            {{ (evalReport.sentiment.confidenceInterval95[0] * 100).toFixed(1) }}% ~ {{ (evalReport.sentiment.confidenceInterval95[1] * 100).toFixed(1) }}%
          </el-descriptions-item>
          <el-descriptions-item label="宏平均F1">{{ evalReport.sentiment.macroF1 }}</el-descriptions-item>
          <el-descriptions-item label="分数准确率">
            {{ (evalReport.sentiment.scoreAccuracy * 100).toFixed(1) }}%
          </el-descriptions-item>
          <el-descriptions-item label="单条vs批量一致率">
            <el-tag :type="evalReport.consistency.sentimentConsistencyRate >= 0.9 ? 'success' : 'warning'">
              {{ (evalReport.consistency.sentimentConsistencyRate * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h4>各类别 P/R/F1</h4>
        <el-table :data="evalReport.sentiment.categories" size="small" border>
          <el-table-column prop="category" label="类别" width="100" />
          <el-table-column prop="sampleCount" label="样本数" width="80" />
          <el-table-column prop="precision" label="精确率 P" />
          <el-table-column prop="recall" label="召回率 R" />
          <el-table-column prop="f1" label="F1" />
        </el-table>

        <h4>分语境准确率（B站特殊语境专项）</h4>
        <el-table :data="evalReport.sentiment.contextBreakdown" size="small" border>
          <el-table-column prop="context" label="语境" width="140" />
          <el-table-column prop="sampleCount" label="样本数" width="90" />
          <el-table-column label="准确率">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.round(row.accuracy * 100)"
                :stroke-width="12"
                :status="row.accuracy >= 0.7 ? 'success' : row.accuracy >= 0.5 ? 'warning' : 'exception'"
              />
            </template>
          </el-table-column>
          <el-table-column label="命中" width="90" align="center">
            <template #default="{ row }">{{ row.correctCount }}/{{ row.sampleCount }}</template>
          </el-table-column>
        </el-table>

        <h4>🗣 舆论话题提取质量（讨论的是什么）</h4>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="样本数">{{ evalReport.topic.sampleCount }}</el-descriptions-item>
          <el-descriptions-item label="话题命中率(Recall)">
            <el-tag :type="evalReport.topic.topicHitRate >= 0.7 ? 'success' : 'warning'">
              {{ (evalReport.topic.topicHitRate * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="话题精确率">
            <el-tag :type="evalReport.topic.topicPrecision >= 0.5 ? 'success' : 'warning'">
              {{ (evalReport.topic.topicPrecision * 100).toFixed(1) }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="话题F1">{{ evalReport.topic.topicF1 }}</el-descriptions-item>
          <el-descriptions-item label="平均提取关键词数">{{ evalReport.topic.avgKeywordCount }}</el-descriptions-item>
          <el-descriptions-item label="未命中">{{ evalReport.topic.missedSamples.length }} 条</el-descriptions-item>
        </el-descriptions>
        <el-table v-if="evalReport.topic.missedSamples.length" :data="evalReport.topic.missedSamples.slice(0, 8)" size="small" border max-height="180">
          <el-table-column prop="content" label="内容" min-width="180" />
          <el-table-column label="期望话题" width="140">
            <template #default="{ row }">{{ row.expectedTopics.join(" / ") }}</template>
          </el-table-column>
          <el-table-column label="提取关键词" width="180">
            <template #default="{ row }">{{ row.extractedKeywords.join(" / ") || "无" }}</template>
          </el-table-column>
        </el-table>

        <h4>判错样本（{{ misclassifiedSamples.length }} 条）</h4>
        <el-table v-if="misclassifiedSamples.length" :data="misclassifiedSamples" size="small" border max-height="220">
          <el-table-column prop="content" label="内容" min-width="180" />
          <el-table-column prop="note" label="语境" width="130" />
          <el-table-column label="期望→实际" width="130" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.expected === '负面' ? 'danger' : row.expected === '正面' ? 'success' : 'info'">{{ row.expected }}</el-tag>
              → <el-tag size="small" :type="row.actual === '负面' ? 'danger' : row.actual === '正面' ? 'success' : 'info'">{{ row.actual }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="ok-tip">✅ 219 条标注集全部判对，无错判样本</div>

        <div v-if="evalReport.consistency.inconsistentSamples.length" class="warn-tip">
          ⚠️ 单条与批量存在 {{ evalReport.consistency.inconsistentSamples.length }} 条不一致（批量注意力偏移风险，建议关注）
        </div>
        <div v-else class="ok-tip">✅ 单条与批量判定完全一致，无批量污染</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="monitorOverview">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Bell, ChatDotRound, ChatLineSquare, DataAnalysis, Promotion, Refresh, TrendCharts, VideoCamera, VideoPause } from "@element-plus/icons-vue";
import ECharts from "@/components/ECharts/index.vue";
import type { ECOption } from "@/components/ECharts/config";
import type { Monitor } from "@/api/interface/monitor";
import {
    getOverviewApi,
    getSentimentDistApi,
    getTrendApi,
    getTopicStatsApi,
    getRiskAlertsApi,
    getWeightedSentimentApi,
    getFaultToleranceApi,
    collectVideoApi,
    collectCommentApi,
    collectDynamicApi,
    collectAllApi,
    analyzePendingApi,
    analyzeAllApi,
    getConfigApi,
    stopAnalysisApi,
    runEvaluationApi,
} from "@/api/modules/monitor";

const overview = ref({
    videoTotal: 0,
    commentTotal: 0,
    dynamicTotal: 0,
    analyzedComments: 0,
    deletedComments: 0,
    sentimentDist: {} as Record<string, number>,
});
const dist = ref<{ sentiment: string; count: number }[]>([]);
const trend = ref<{ date: string; commentCount: number; avgScore: number }[]>([]);
const topicList = ref<Monitor.TopicStatItem[]>([]);
const riskAlertList = ref<Monitor.TopicStatItem[]>([]);
const trendDays = ref(7);

const loading = reactive({
    video: false,
    comment: false,
    dynamic: false,
    all: false,
    pending: false,
    reanalyze: false,
});

const unanalyzedCount = computed(() => overview.value.commentTotal - overview.value.analyzedComments);
/** 加权情感指数（点赞×讨论热度加权，来自后端 SQL 聚合） */
const weightedSentiment = ref<Monitor.WeightedSentimentReport | null>(null);
const weightedScore = computed(() => weightedSentiment.value?.weightedIndex ?? 0);
/** 加权与简单平均的差异（体现热度权重的影响） */
const weightedDiff = computed(() => {
    if (!weightedSentiment.value) return 0;
    return Math.round((weightedSentiment.value.weightedIndex - weightedSentiment.value.simpleIndex) * 10) / 10;
});

const statCards = computed(() => [
    { label: "视频", value: overview.value.videoTotal, icon: VideoCamera, color: "#409eff", bg: "#ecf5ff" },
    { label: "评论", value: overview.value.commentTotal, icon: ChatDotRound, color: "#67c23a", bg: "#f0f9eb" },
    { label: "动态", value: overview.value.dynamicTotal, icon: Bell, color: "#e6a23c", bg: "#fdf6ec" },
    { label: "已分析评论", value: overview.value.analyzedComments, icon: DataAnalysis, color: "#f56c6c", bg: "#fef0f0" },
]);

const extraCards = computed(() => [
    { label: "未分析评论", value: unanalyzedCount.value, icon: ChatLineSquare, color: "#909399", bg: "#f4f4f5" },
    {
        // 加权情感指数：每条评论权重 = (点赞数+1) × (1+log(1+回复数))，热度越高权重越大
        label: "加权情感指数",
        value: weightedScore.value.toFixed(1),
        icon: TrendCharts,
        color:
            weightedScore.value < -10
                ? "#f56c6c"
                : weightedScore.value > 10
                  ? "#67c23a"
                  : "#909399",
        bg: "#f5f7fa",
        tip: `加权（点赞×讨论热度）${weightedScore.value.toFixed(1)} vs 简单平均 ${weightedSentiment.value?.simpleIndex ?? 0}（差异 ${weightedDiff.value > 0 ? "+" : ""}${weightedDiff.value}）`,
        tag: weightedDiff.value !== 0 ? `${weightedDiff.value > 0 ? "↑" : "↓"}${Math.abs(weightedDiff.value)}` : "≈",
    },
]);

/** 极端负面高赞评论（点赞>=1000 且分数<=-60）：高共鸣负面信号，供预警卡片展示 */

// ===== LLM 容错状态（熔断/预算/采样）=====
const faultTolerance = ref<Monitor.FaultToleranceState | null>(null);
const circuitBreakerTip = computed(() => {
    if (!faultTolerance.value?.circuitBreaker.circuitOpen) return null;
    return `⛔ LLM 熔断中（剩 ${faultTolerance.value.circuitBreaker.remainingSeconds} 秒）`;
});
const budgetTip = computed(() => {
    const budget = faultTolerance.value?.budget;
    if (!budget || budget.budget === null) return null;
    return `💰 预算 ${budget.used}/${budget.budget} 次调用`;
});
const samplingTip = computed(() => {
    const sampling = faultTolerance.value?.sampling;
    if (!sampling || sampling.skipped === 0) return null;
    return `🎯 已采样 ${sampling.sampled} 条 / 跳过 ${sampling.skipped} 条`;
});
const loadFaultTolerance = async () => {
    try {
        faultTolerance.value = await getFaultToleranceApi();
    } catch {
        /* 静默 */
    }
};

const distTotal = computed(() => dist.value.reduce((s, d) => s + d.count, 0));

/** 话题正/负占比（用于话题条与图例） */
const positiveRatio = (t: Monitor.TopicStatItem) =>
    t.count > 0 ? Math.round((t.positiveCount / t.count) * 100) : 0;
const negativeRatio = (t: Monitor.TopicStatItem) =>
    t.count > 0 ? Math.round((t.negativeCount / t.count) * 100) : 0;

const sentimentColor: Record<string, string> = { 正面: "#67c23a", 负面: "#f56c6c", 中性: "#909399" };

const pieOption = computed<ECOption>(() => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, left: "center" },
    series: [
        {
            type: "pie",
            radius: ["40%", "70%"],
            center: ["50%", "45%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
            label: { show: true, formatter: "{b}: {d}%" },
            data: dist.value.map((d) => ({
                name: d.sentiment || "未知",
                value: d.count,
                itemStyle: { color: sentimentColor[d.sentiment] || "#409eff" },
            })),
        },
    ],
}));

const lineOption = computed<ECOption>(() => {
    const sorted = [...trend.value].reverse();
    return {
        tooltip: { trigger: "axis" },
        legend: { data: ["评论数", "平均情感分"] },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: { type: "category", data: sorted.map((t) => t.date), boundaryGap: false },
        yAxis: [
            { type: "value", name: "评论数", min: 0 },
            { type: "value", name: "情感分", min: -100, max: 100 },
        ],
        series: [
            {
                name: "评论数",
                type: "line",
                smooth: true,
                areaStyle: { opacity: 0.15 },
                itemStyle: { color: "#409eff" },
                data: sorted.map((t) => t.commentCount),
            },
            {
                name: "平均情感分",
                type: "line",
                yAxisIndex: 1,
                smooth: true,
                itemStyle: { color: "#67c23a" },
                data: sorted.map((t) => t.avgScore),
            },
        ],
    };
});

/** 请求序号守卫：防止自动刷新与手动刷新并发时，慢响应覆盖新数据（概览与趋势各用各的序号） */
let dataRequestSeq = 0;
let trendRequestSeq = 0;
let topicRequestSeq = 0;
const loadData = async () => {
    const current = ++dataRequestSeq;
    try {
        const [overviewData, distData, weighted] = await Promise.all([
            getOverviewApi(),
            getSentimentDistApi(),
            getWeightedSentimentApi().catch(() => null), // 无数据时忽略
        ]);
        if (current !== dataRequestSeq) return;
        overview.value = overviewData;
        dist.value = distData;
        if (weighted) weightedSentiment.value = weighted;
    } catch (e) {
        if (current !== dataRequestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载数据失败");
    }
};

/** 加载舆论分析（话题 + 预警） */
const loadTopics = async () => {
    const current = ++topicRequestSeq;
    try {
        const [topics, alerts] = await Promise.all([getTopicStatsApi(20), getRiskAlertsApi(10)]);
        if (current !== topicRequestSeq) return;
        topicList.value = topics;
        riskAlertList.value = alerts;
    } catch (e) {
        if (current !== topicRequestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载话题分析失败");
    }
};

const loadTrend = async () => {
    const current = ++trendRequestSeq;
    try {
        const result = await getTrendApi(trendDays.value);
        if (current !== trendRequestSeq) return;
        trend.value = result;
    } catch (e) {
        if (current !== trendRequestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载趋势失败");
    }
};

/** 自动刷新 */
let timer: ReturnType<typeof setInterval> | null = null;
const autoRefreshing = ref(false);

const startAutoRefresh = async () => {
    try {
        const cfg = (await getConfigApi()) as unknown as Record<string, unknown>;
        const seconds = Number(cfg["自动刷新秒数"] ?? 0);
        if (seconds > 0) {
            autoRefreshing.value = true;
            timer = setInterval(() => {
                loadData();
                loadTrend();
                loadTopics();
            }, seconds * 1000);
        }
    } catch {
        /* 配置读取失败不阻塞 */
    }
};

/** 通用触发 */
let refreshDebounce: ReturnType<typeof setTimeout> | null = null;
async function triggerAction(
    api: () => Promise<{ message: string }>,
    key: "video" | "comment" | "dynamic" | "all" | "pending" | "reanalyze",
    name: string,
) {
    loading[key] = true;
    try {
        const res = await api();
        ElMessage.success(res.message || `已触发${name}`);
        // 分析类操作：立即显示进度面板（等待 SSE 推送进度）
        if (key === "pending" || key === "reanalyze") {
            analysisProgress.value = {
                type: "analysis-progress",
                analyzed: 0,
                total: 0,
                failed: 0,
                batch: 0,
                model: "",
                thinking: "",
            };
            progressPanelVisible.value = true;
        }
        // 延迟刷新数据（合并多次触发，避免堆叠定时器；卸载后不再执行）
        if (refreshDebounce) clearTimeout(refreshDebounce);
        refreshDebounce = setTimeout(() => {
            refreshDebounce = null;
            if (unmounted) return;
            loadData();
        }, 3000);
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : `触发${name}失败`);
    } finally {
        loading[key] = false;
    }
}

/** 停止分析 */
const stoppingAnalysis = ref(false);
async function stopAnalysis() {
    stoppingAnalysis.value = true;
    try {
        await stopAnalysisApi();
        ElMessage.info("已发送停止请求");
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "停止失败");
    } finally {
        stoppingAnalysis.value = false;
    }
}

// ===== 情感分析评测 =====
const evaluating = ref(false);
const evalDialogVisible = ref(false);
const evalReport = ref<Monitor.EvaluationReport | null>(null);
/** 判错样本（倾向与人工标注不符） */
const misclassifiedSamples = computed(() =>
    (evalReport.value?.sentiment.allSamples ?? []).filter((s) => !s.sentimentCorrect),
);
async function runEvaluation() {
    evaluating.value = true;
    ElMessage.info("评测进行中（219 条标注集逐条分析），约需 3-8 分钟…");
    try {
        const report = await runEvaluationApi();
        evalReport.value = report;
        evalDialogVisible.value = true;
        ElMessage.success("评测完成，已生成报告");
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "评测失败（请确认已配置 AI 提供者）");
    } finally {
        evaluating.value = false;
    }
}

onMounted(() => {
    loadData();
    loadTrend();
    loadTopics();
    loadFaultTolerance();
    startAutoRefresh();
    connectProgressSSE();
});

onBeforeUnmount(() => {
    unmounted = true;
    if (timer) clearInterval(timer);
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (refreshDebounce) {
        clearTimeout(refreshDebounce);
        refreshDebounce = null;
    }
    disconnectProgressSSE();
});

// ===== 分析进度 SSE 监听 =====
const analysisProgress = ref<Monitor.AnalysisProgress>({
    type: "analysis-progress",
    analyzed: 0,
    total: 0,
    failed: 0,
    batch: 0,
    model: "",
    thinking: "",
});
const progressPanelVisible = ref(false);
let progressSSE: EventSource | null = null;
/** 已卸载守卫：防止组件卸载后重连定时器新建僵尸 EventSource */
let unmounted = false;
/** 重连定时器句柄：卸载时清理 */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const progressPercent = computed(() => {
    if (analysisProgress.value.total === 0) return 0;
    return Math.round((analysisProgress.value.analyzed / analysisProgress.value.total) * 100);
});

function connectProgressSSE() {
    if (progressSSE || unmounted) return;
    // EventSource 无法设置自定义请求头，改用 query 参数携带访问令牌（后端中间件同时支持两种方式）
    const token = localStorage.getItem("访问令牌");
    progressSSE = new EventSource(`/api/console-logs/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`);
    progressSSE.addEventListener("analysis-progress", (event: MessageEvent) => {
        if (unmounted) return;
        try {
            const data: Monitor.AnalysisProgress = JSON.parse(event.data);
            analysisProgress.value = data;
            if (!progressPanelVisible.value) progressPanelVisible.value = true;
            // 分析完成或停止时自动刷新数据
            if (data.analyzed >= data.total || data.total === 0) {
                setTimeout(() => {
                    if (unmounted) return;
                    progressPanelVisible.value = false;
                    loadData();
                    loadTrend();
                }, 3000);
            }
        } catch {
            /* 忽略解析错误 */
        }
    });
    progressSSE.onerror = () => {
        disconnectProgressSSE();
        if (unmounted) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectProgressSSE();
        }, 5000);
    };
}

function disconnectProgressSSE() {
    if (progressSSE) {
        progressSSE.close();
        progressSSE = null;
    }
}
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
