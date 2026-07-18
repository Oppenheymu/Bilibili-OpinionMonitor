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
          <template #header>近7天评论趋势</template>
          <ECharts v-if="trend.length" :option="lineOption" height="320px" />
          <el-empty v-else description="暂无趋势数据" :image-size="100" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作区 -->
    <el-card shadow="never" class="action-card">
      <el-button :icon="Refresh" @click="loadData">刷新数据</el-button>
      <el-button type="primary" :icon="Promotion" :loading="collecting" @click="handleCollect">触发采集</el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="monitorOverview">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Bell, ChatDotRound, DataAnalysis, Promotion, Refresh, VideoCamera } from "@element-plus/icons-vue";
import ECharts from "@/components/ECharts/index.vue";
import { ECOption } from "@/components/ECharts/config";
import { getOverviewApi, getSentimentDistApi, getTrendApi, triggerCollectApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";

const overview = ref<Monitor.OverviewStats>({
  视频总数: 0,
  评论总数: 0,
  动态总数: 0,
  已分析评论: 0,
  情感分布: {}
});
const dist = ref<Monitor.SentimentDist[]>([]);
const trend = ref<Monitor.Trend[]>([]);
const collecting = ref(false);

const statCards = computed(() => [
  { label: "视频", value: overview.value.视频总数, icon: VideoCamera, color: "#409eff", bg: "#ecf5ff" },
  { label: "评论", value: overview.value.评论总数, icon: ChatDotRound, color: "#67c23a", bg: "#f0f9eb" },
  { label: "动态", value: overview.value.动态总数, icon: Bell, color: "#e6a23c", bg: "#fdf6ec" },
  { label: "已分析评论", value: overview.value.已分析评论, icon: DataAnalysis, color: "#f56c6c", bg: "#fef0f0" }
]);

const distTotal = computed(() => dist.value.reduce((s, d) => s + d.数, 0));

const sentimentColor: Record<string, string> = {
  正面: "#67c23a",
  负面: "#f56c6c",
  中性: "#909399"
};

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
      data: dist.value.map(d => ({
        name: d.倾向 || "未知",
        value: d.数,
        itemStyle: { color: sentimentColor[d.倾向] || "#409eff" }
      }))
    }
  ]
}));

const lineOption = computed<ECOption>(() => {
  // 趋势数据按日期倒序返回，图表需升序展示
  const sorted = [...trend.value].reverse();
  return {
    tooltip: { trigger: "axis" },
    legend: { data: ["评论数", "平均情感分"] },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: sorted.map(t => t.日期), boundaryGap: false },
    yAxis: [
      { type: "value", name: "评论数", min: 0 },
      { type: "value", name: "情感分", min: -100, max: 100 }
    ],
    series: [
      {
        name: "评论数",
        type: "line",
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: "#409eff" },
        data: sorted.map(t => t.评论数)
      },
      {
        name: "平均情感分",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: "#67c23a" },
        data: sorted.map(t => t.平均分数)
      }
    ]
  };
});

const loadData = async () => {
  try {
    const [概, 分, 趋] = await Promise.all([getOverviewApi(), getSentimentDistApi(), getTrendApi(7)]);
    overview.value = 概;
    dist.value = 分;
    trend.value = 趋;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载数据失败");
  }
};

const handleCollect = async () => {
  collecting.value = true;
  try {
    const res = await triggerCollectApi();
    ElMessage.success(res.消息 || "已触发采集");
    setTimeout(loadData, 3000);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "触发采集失败");
  } finally {
    collecting.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
