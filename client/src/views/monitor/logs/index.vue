<template>
  <div class="logs-page">
    <!-- 标签页切换 -->
    <el-tabs v-model="activeTab" type="card" @tab-change="switchTab">
      <el-tab-pane label="采集日志" name="采集">
        <!-- 统计卡片 -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">总日志</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{{ stats.successCount }}</div>
            <div class="stat-label">成功</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-value">{{ stats.failureCount }}</div>
            <div class="stat-label">失败</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">{{ stats.inProgressCount }}</div>
            <div class="stat-label">进行中</div>
          </div>
          <div v-for="p in stats.byStage" :key="p.stage" class="stat-card info">
            <div class="stat-value">{{ p.count }}</div>
            <div class="stat-label">{{ p.stage }}</div>
            <div class="stat-sub">✓{{ p.success }} ✗{{ p.failure }}</div>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="filter-bar">
          <div class="filter-left">
            <el-select v-model="stageFilter" placeholder="全部阶段" clearable size="default" @change="resetAndLoad">
              <el-option v-for="p in stageOptions" :key="p" :label="p" :value="p" />
            </el-select>
            <el-select v-model="statusFilter" placeholder="全部状态" clearable size="default" @change="resetAndLoad">
              <el-option label="成功" value="成功" />
              <el-option label="失败" value="失败" />
              <el-option label="进行中" value="进行中" />
            </el-select>
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-tooltip content="每 5 秒自动刷新">
              <el-switch
                v-model="autoRefresh"
                active-text="自动"
                size="default"
                @change="toggleAutoRefresh"
              />
            </el-tooltip>
          </div>
          <div class="filter-right">
            <el-popconfirm title="确定清除所有日志？" @confirm="clearLogs">
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
                <el-tag size="small" effect="plain">{{ row.stage }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" effect="dark" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="collectedCount" label="采集量" width="80" align="center" />
            <el-table-column label="耗时" width="100" align="center">
              <template #default="{ row }">
                <span v-if="row.durationMs > 0">{{ (row.durationMs / 1000).toFixed(1) }}s</span>
                <span v-else class="text-secondary">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="errorMessage" label="错误信息" show-overflow-tooltip min-width="200">
              <template #default="{ row }">
                <span v-if="row.errorMessage" class="text-danger">{{ row.errorMessage }}</span>
                <span v-else class="text-secondary">-</span>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="175" align="center">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination">
            <div class="page-left">
              <span>每页</span>
              <el-select v-model="pageSize" size="small" style="width: 80px" @change="reload">
                <el-option v-for="s in [10, 20, 50, 100]" :key="s" :label="String(s)" :value="s" />
              </el-select>
              <span>条，共 {{ total }} 条</span>
            </div>
            <div class="page-right">
              <el-button size="small" :disabled="page <= 1" @click="prevPage(loadData)">上一页</el-button>
              <span class="page-num">第 {{ page }} / {{ totalPages || '?' }} 页</span>
              <el-button size="small" :disabled="!hasNext" @click="nextPage(loadData)">下一页</el-button>
              <span style="margin-left: 8px">跳至</span>
              <el-input-number
                v-model="jumpPage"
                :min="1"
                :max="totalPages || 1"
                size="small"
                style="width: 70px"
                controls-position="right"
                @keyup.enter="jumpTo(jumpPage, loadData)"
              />
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 控制台标签页 -->
      <el-tab-pane label="控制台" name="控制台">
        <div class="filter-bar">
          <div class="filter-left">
            <el-button :icon="Refresh" @click="reconnectSSE" :loading="sseStatus === '连接中'">
              {{ sseStatus === "已连接" ? "已连接" : sseStatus === "连接中" ? "连接中" : "重新连接" }}
            </el-button>
            <el-switch v-model="autoScroll" active-text="自动滚动" size="default" />
            <el-select v-model="consoleFilter" placeholder="全部级别" clearable size="default">
              <el-option label="log" value="log" />
              <el-option label="warn" value="warn" />
              <el-option label="error" value="error" />
            </el-select>
          </div>
          <div class="filter-right">
            <span class="line-count">{{ filteredCount }} 行</span>
            <el-button size="small" @click="clearConsole">清屏</el-button>
          </div>
        </div>

        <!-- 终端模拟区域 -->
        <div class="console-box card" ref="consoleContainer">
          <div
            v-for="(entry, i) in visibleEntries"
            :key="i"
            :class="['console-line', 'level-' + entry.level]"
          >
            <span class="console-time">{{ entry.time }}</span>
            <span class="console-level">{{ levelLabel(entry.level) }}</span>
            <span class="console-text">{{ entry.content }}</span>
          </div>
          <div v-if="visibleEntries.length === 0" class="console-empty">
            <span v-if="sseStatus === '连接中'">⏳ 等待连接...</span>
            <span v-else-if="sseStatus === '已连接'">已连接，等待日志输出...</span>
            <span v-else>未连接</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts" name="monitorLogs">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Refresh } from "@element-plus/icons-vue";
import { clearLogsApi, getLogListApi, getLogStatsApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

// ===== 标签页 =====
const activeTab = ref("采集");

// ===== 采集日志 =====
const tableData = ref<Monitor.Log[]>([]);
const loading = ref(false);
const autoRefresh = ref(true);
let collectTimer: ReturnType<typeof setInterval> | null = null;

const stageFilter = ref("");
const statusFilter = ref("");

const stats = ref<Monitor.LogStats>({
    total: 0,
    successCount: 0,
    failureCount: 0,
    inProgressCount: 0,
    byStage: [],
});

const { page, pageSize, total, totalPages, hasNext, prev: prevPage, next: nextPage, reset: resetPage, jumpTo, setTotal } = usePagination(20);
const jumpPage = ref(1);

const stageOptions = computed(() => stats.value.byStage.map((p) => p.stage));
const resetAndLoad = () => {
    resetPage(loadData);
};
const reload = () => {
    resetPage(loadData);
};

const statusType = (status: string) => {
    if (status === "成功") return "success";
    if (status === "失败") return "danger";
    return "warning";
};

const loadStats = async () => {
    try {
        stats.value = await getLogStatsApi();
    } catch {
        /* 静默忽略 */
    }
};

/** 请求序号守卫：防止 5s 自动刷新与手动筛选/翻页并发时，慢响应覆盖新数据 */
let requestSeq = 0;
const loadData = async () => {
    const current = ++requestSeq;
    loading.value = true;
    try {
        const [res] = await Promise.all([
            getLogListApi({
                page: page.value,
                size: pageSize.value,
                stage: stageFilter.value || undefined,
                status: statusFilter.value || undefined,
            }),
            loadStats(),
        ]);
        if (current !== requestSeq) return;
        tableData.value = res.list;
        setTotal(res.total);
    } catch (e) {
        if (current !== requestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载日志失败");
    } finally {
        if (current === requestSeq) loading.value = false;
    }
};

const clearLogs = async () => {
    try {
        const res = await clearLogsApi();
        ElMessage.success(res.message);
        resetAndLoad();
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "清空失败");
    }
};

const toggleAutoRefresh = (val: string | number | boolean) => {
    if (val) startCollectRefresh();
    else stopCollectRefresh();
};
const startCollectRefresh = () => {
    stopCollectRefresh();
    collectTimer = setInterval(loadData, 5000);
};
const stopCollectRefresh = () => {
    if (collectTimer) {
        clearInterval(collectTimer);
        collectTimer = null;
    }
};

// ===== 控制台（SSE）=====
const consoleContainer = ref<HTMLElement | null>(null);
const consoleEntries = ref<Monitor.ConsoleLogEntry[]>([]);
const consoleFilter = ref("");
const autoScroll = ref(true);
const sseStatus = ref<"未连接" | "连接中" | "已连接">("未连接");
let sseConnection: EventSource | null = null;

const filteredCount = computed(() => visibleEntries.value.length);

const visibleEntries = computed(() => {
    if (!consoleFilter.value) return consoleEntries.value;
    return consoleEntries.value.filter((e) => e.level === consoleFilter.value);
});

const levelLabel = (level: string) => {
    if (level === "warn") return "WARN";
    if (level === "error") return "ERR ";
    return "INFO";
};

/** 已卸载守卫：防止组件卸载后重连定时器/异步回调继续执行 */
let unmounted = false;
/** 重连定时器句柄：卸载时清理，避免僵尸 EventSource 泄漏 */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 拼接访问令牌查询参数
 * EventSource/fetch 无法自定义请求头，后端中间件支持 ?token= 方式（与 overview 页一致）
 */
const withTokenUrl = (path: string): string => {
    const token = localStorage.getItem("访问令牌");
    if (!token) return path;
    return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
};

/** 连接 SSE */
const connectSSE = () => {
    if (sseConnection || unmounted) return;
    sseStatus.value = "连接中";

    // 先拉取历史日志（必须带令牌，否则配置访问令牌后 401 静默失败）
    fetch(withTokenUrl("/api/console-logs/history?limit=200"))
        .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then((data: Monitor.ConsoleLogEntry[]) => {
            if (unmounted) return;
            consoleEntries.value = data;
            scrollToBottom();
        })
        .catch(() => {
            if (unmounted) return;
            sseStatus.value = "未连接";
        });

    // 建立 SSE 长连接
    sseConnection = new EventSource(withTokenUrl("/api/console-logs/stream"));
    sseConnection.onopen = () => {
        sseStatus.value = "已连接";
    };
    sseConnection.onmessage = (event) => {
        if (unmounted) return;
        try {
            const entry: Monitor.ConsoleLogEntry = JSON.parse(event.data);
            consoleEntries.value.push(entry);
            // 保持最多 1000 行
            if (consoleEntries.value.length > 1000) {
                consoleEntries.value = consoleEntries.value.slice(-1000);
            }
            scrollToBottom();
        } catch {
            /* 忽略解析错误 */
        }
    };
    sseConnection.onerror = () => {
        sseStatus.value = "未连接";
        disconnectSSE();
        if (unmounted) return;
        // 3 秒后自动重连；保存句柄以便卸载时清理
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSSE();
        }, 3000);
    };
};

/** 断开 SSE */
const disconnectSSE = () => {
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
};

/** 重连 SSE */
const reconnectSSE = () => {
    disconnectSSE();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    connectSSE();
};

const clearConsole = () => {
    consoleEntries.value = [];
};

/** 滚动到终端底部 */
const scrollToBottom = () => {
    if (!autoScroll.value) return;
    nextTick(() => {
        const el = consoleContainer.value;
        if (el) el.scrollTop = el.scrollHeight;
    });
};

// 监听过滤变化时滚动
watch(visibleEntries, () => scrollToBottom());

/** 标签切换时管理连接 */
const switchTab = (tab: string | number) => {
    if (tab === "控制台") {
        if (sseStatus.value !== "已连接" && sseStatus.value !== "连接中") connectSSE();
        if (collectTimer) stopCollectRefresh();
    } else {
        if (collectTimer === null && autoRefresh.value) startCollectRefresh();
    }
};

// ===== 生命周期 =====
onMounted(() => {
    loadData();
    startCollectRefresh();
});

onBeforeUnmount(() => {
    unmounted = true;
    stopCollectRefresh();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    disconnectSSE();
});
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
