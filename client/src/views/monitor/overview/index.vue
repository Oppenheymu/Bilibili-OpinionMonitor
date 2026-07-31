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
      </div>
    </el-card>
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
  collectVideoApi,
  collectCommentApi,
  collectDynamicApi,
  collectAllApi,
  analyzePendingApi,
  analyzeAllApi,
  getConfigApi,
  stopAnalysisApi,
} from "@/api/modules/monitor";

const overview = ref({
  视频总数: 0, 评论总数: 0, 动态总数: 0, 已分析评论: 0,
  情感分布: {} as Record<string, number>,
});
const dist = ref<{ 倾向: string; 数: number }[]>([]);
const trend = ref<{ 日期: string; 评论数: number; 平均分数: number }[]>([]);
const 趋势天数 = ref(7);

const loading = reactive({
  视频: false, 评论: false, 动态: false, 全部: false, 未处理: false, 重新全部: false,
});

const 未分析评论 = computed(() => overview.value.评论总数 - overview.value.已分析评论);
const 平均分 = computed(() => {
  if (!dist.value.length) return "0";
  const 加权 = dist.value.reduce((s, d) => {
    const 分 = d.倾向 === "正面" ? 50 : d.倾向 === "负面" ? -50 : 0;
    return s + 分 * d.数;
  }, 0);
  return (加权 / distTotal.value).toFixed(1);
});

const statCards = computed(() => [
  { label: "视频", value: overview.value.视频总数, icon: VideoCamera, color: "#409eff", bg: "#ecf5ff" },
  { label: "评论", value: overview.value.评论总数, icon: ChatDotRound, color: "#67c23a", bg: "#f0f9eb" },
  { label: "动态", value: overview.value.动态总数, icon: Bell, color: "#e6a23c", bg: "#fdf6ec" },
  { label: "已分析评论", value: overview.value.已分析评论, icon: DataAnalysis, color: "#f56c6c", bg: "#fef0f0" },
]);

const extraCards = computed(() => [
  { label: "未分析评论", value: 未分析评论.value, icon: ChatLineSquare, color: "#909399", bg: "#f4f4f5" },
  { label: "整体情感分", value: 平均分.value, icon: TrendCharts, color: 平均分.value.startsWith("-") ? "#f56c6c" : "#67c23a", bg: "#f5f7fa" },
]);

const distTotal = computed(() => dist.value.reduce((s, d) => s + d.数, 0));

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

const loadData = async () => {
  try {
    const [概, 分] = await Promise.all([getOverviewApi(), getSentimentDistApi()]);
    overview.value = 概;
    dist.value = 分;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载数据失败");
  }
};

const loadTrend = async () => {
  try {
    trend.value = await getTrendApi(趋势天数.value);
  } catch (e) {
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
      定时器 = setInterval(() => { loadData(); loadTrend(); }, 秒 * 1000);
    }
  } catch { /* 配置读取失败不阻塞 */ }
};

/** 通用触发 */
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
    setTimeout(() => { loadData(); }, 3000);
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

onMounted(() => {
  loadData();
  loadTrend();
  启动自动刷新();
  连接分析进度SSE();
});

onBeforeUnmount(() => {
  if (定时器) clearInterval(定时器);
  断开分析进度SSE();
});

// ===== 分析进度 SSE 监听 =====
const 分析进度 = ref<Monitor.分析进度>({ 类型: "分析进度", 已分析: 0, 总数: 0, 失败: 0, 批次: 0, 模型: "", 思考: "" });
const 进度面板显示 = ref(false);
let 进度SSE: EventSource | null = null;

const 进度百分比 = computed(() => {
  if (分析进度.value.总数 === 0) return 0;
  return Math.round((分析进度.value.已分析 / 分析进度.value.总数) * 100);
});

function 连接分析进度SSE() {
  if (进度SSE) return;
  // EventSource 无法设置自定义请求头，改用 query 参数携带访问令牌（后端中间件同时支持两种方式）
  const 令牌 = localStorage.getItem("访问令牌");
  进度SSE = new EventSource(`/api/控制台日志/流${令牌 ? `?token=${encodeURIComponent(令牌)}` : ""}`);
  进度SSE.addEventListener("分析进度", (event: MessageEvent) => {
    try {
      const 数据: Monitor.分析进度 = JSON.parse(event.data);
      分析进度.value = 数据;
      if (!进度面板显示.value) 进度面板显示.value = true;
      // 分析完成或停止时自动刷新数据
      if (数据.已分析 >= 数据.总数 || 数据.总数 === 0) {
        setTimeout(() => {
          进度面板显示.value = false;
          loadData();
          loadTrend();
        }, 3000);
      }
    } catch { /* 忽略解析错误 */ }
  });
  进度SSE.onerror = () => {
    断开分析进度SSE();
    setTimeout(连接分析进度SSE, 5000);
  };
}

function 断开分析进度SSE() {
  if (进度SSE) { 进度SSE.close(); 进度SSE = null; }
}
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
