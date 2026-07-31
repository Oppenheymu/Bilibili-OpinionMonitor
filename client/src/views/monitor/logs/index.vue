<template>
  <div class="logs-page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ 统计.总计 }}</div>
        <div class="stat-label">总日志</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ 统计.成功数 }}</div>
        <div class="stat-label">成功</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">{{ 统计.失败数 }}</div>
        <div class="stat-label">失败</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ 统计.进行中数 }}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div v-for="p in 统计.按阶段" :key="p.阶段" class="stat-card info">
        <div class="stat-value">{{ p.数 }}</div>
        <div class="stat-label">{{ p.阶段 }}</div>
        <div class="stat-sub">✓{{ p.成功 }} ✗{{ p.失败 }}</div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-left">
        <el-select v-model="筛选_阶段" placeholder="全部阶段" clearable size="default" @change="重置并加载">
          <el-option v-for="p in 可选阶段" :key="p" :label="p" :value="p" />
        </el-select>
        <el-select v-model="筛选_状态" placeholder="全部状态" clearable size="default" @change="重置并加载">
          <el-option label="成功" value="成功" />
          <el-option label="失败" value="失败" />
          <el-option label="进行中" value="进行中" />
        </el-select>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
        <el-tooltip content="每 5 秒自动刷新">
          <el-switch
            v-model="自动刷新"
            active-text="自动"
            size="default"
            @change="切换自动刷新"
          />
        </el-tooltip>
      </div>
      <div class="filter-right">
        <el-popconfirm title="确定清除所有日志？" @confirm="清空日志">
          <template #reference>
            <el-button :icon="Delete" type="danger" plain>清空日志</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <!-- 日志表格 -->
    <div class="card table-box">
      <el-table :data="tableData" v-loading="loading" border stripe size="default" style="width: 100%" :max-height="500">
        <el-table-column label="阶段" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.阶段 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="状态类型(row.状态)" effect="dark" size="small">{{ row.状态 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="采集数量" label="采集量" width="80" align="center" />
        <el-table-column label="耗时" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.耗时毫秒 > 0">{{ (row.耗时毫秒 / 1000).toFixed(1) }}s</span>
            <span v-else class="text-secondary">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="错误信息" label="错误信息" show-overflow-tooltip min-width="200">
          <template #default="{ row }">
            <span v-if="row.错误信息" class="text-danger">{{ row.错误信息 }}</span>
            <span v-else class="text-secondary">-</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="175" align="center">
          <template #default="{ row }">{{ formatTime(row.时间) }}</template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <div class="page-left">
          <span>每页</span>
          <el-select v-model="pageSize" size="small" style="width: 80px" @change="重新加载">
            <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="String(s)" :value="s" />
          </el-select>
          <span>条，共 {{ 总数 }} 条</span>
        </div>
        <div class="page-right">
          <el-button size="small" :disabled="页 <= 1" @click="上一页(loadData)">上一页</el-button>
          <span class="page-num">第 {{ 页 }} / {{ 总页数 || '?' }} 页</span>
          <el-button size="small" :disabled="!hasNext" @click="下一页(loadData)">下一页</el-button>
          <span style="margin-left: 8px">跳至</span>
          <el-input-number
            v-model="跳转页"
            :min="1"
            :max="总页数 || 1"
            size="small"
            style="width: 70px"
            controls-position="right"
            @keyup.enter="跳转到(跳转页, loadData)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorLogs">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Refresh } from "@element-plus/icons-vue";
import { clearLogsApi, getLogListApi, getLogStatsApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Log[]>([]);
const loading = ref(false);
const 自动刷新 = ref(true);
let 定时器: ReturnType<typeof setInterval> | null = null;

const 筛选_阶段 = ref("");
const 筛选_状态 = ref("");

const 统计 = ref<Monitor.日志统计>({ 总计: 0, 成功数: 0, 失败数: 0, 进行中数: 0, 按阶段: [] });

const { 页, pageSize, 总数, 总页数, hasNext, prev: 上一页, next: 下一页, reset: 重置页码, 跳转到, set总数 } = usePagination(20);
const 跳转页 = ref(1);

/** 可用阶段列表 */
const 可选阶段 = computed(() => 统计.value.按阶段.map((p) => p.阶段));

/** 重置页码并加载 */
const 重置并加载 = () => { 重置页码(); loadData(); };
const 重新加载 = () => { 重置页码(); loadData(); };

const 状态类型 = (状态: string) => {
  if (状态 === "成功") return "success";
  if (状态 === "失败") return "danger";
  return "warning";
};

const loadStats = async () => {
  try {
    统计.value = await getLogStatsApi();
  } catch { /* 静默忽略 */ }
};

const loadData = async () => {
  loading.value = true;
  try {
    const [res] = await Promise.all([
      getLogListApi({ 页: 页.value, 大小: pageSize.value, 阶段: 筛选_阶段.value || undefined, 状态: 筛选_状态.value || undefined }),
      loadStats(),
    ]);
    tableData.value = res.列表;
    set总数(res.总数);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载日志失败");
  } finally {
    loading.value = false;
  }
};

const 清空日志 = async () => {
  try {
    const res = await clearLogsApi();
    ElMessage.success(res.消息);
    重置并加载();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "清空失败");
  }
};

const 切换自动刷新 = (val: boolean) => {
  if (val) 启动自动刷新();
  else 停止自动刷新();
};

const 启动自动刷新 = () => {
  停止自动刷新();
  定时器 = setInterval(loadData, 5000);
};

const 停止自动刷新 = () => {
  if (定时器) { clearInterval(定时器); 定时器 = null; }
};

onMounted(() => {
  loadData();
  启动自动刷新();
});

onBeforeUnmount(停止自动刷新);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
