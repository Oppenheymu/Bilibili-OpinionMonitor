<template>
  <div class="bili-service">
    <!-- 顶部工具栏 -->
    <el-card shadow="hover" class="toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <h2 class="title">B站连接服务</h2>
        </div>
        <div class="toolbar-right">
          <el-button :icon="Refresh" :loading="加载中" @click="loadData">刷新状态</el-button>
        </div>
      </div>
    </el-card>

    <!-- 凭证状态卡片 -->
    <el-row :gutter="16" class="status-row">
      <el-col v-for="card in 状态卡片" :key="card.标题" :xs="12" :sm="8" :md="6">
        <el-card shadow="hover" class="status-card" :class="{ ok: card.正常, error: !card.正常 }">
          <div class="card-inner">
            <div class="card-icon">
              <el-icon :size="28"><component :is="card.图标" /></el-icon>
            </div>
            <div class="card-body">
              <div class="card-value">{{ card.值 }}</div>
              <div class="card-label">{{ card.标题 }}</div>
            </div>
            <el-tag :type="card.正常 ? 'success' : 'danger'" size="small" effect="dark">{{ card.正常 ? "正常" : "异常" }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 详细信息 -->
    <el-row :gutter="16" class="detail-row">
      <!-- 凭证详情 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="info-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">🔐 凭证信息</span>
            </div>
          </template>
          <div class="info-list">
            <div class="info-row">
              <span class="info-label">凭证文件</span>
              <span class="info-value mono">{{ 状态?.凭证路径 || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">凭证大小</span>
              <span class="info-value">{{ 状态?.凭证大小 ? formatBytes(状态.凭证大小) : '不存在' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后修改</span>
              <span class="info-value">{{ 状态?.凭证修改时间 ? formatTime(状态.凭证修改时间) : '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">客户端状态</span>
              <span class="info-value">
                <el-tag :type="状态?.客户端已加载 ? 'success' : 'warning'" size="small">
                  {{ 状态?.客户端已加载 ? '已加载' : '未初始化' }}
                </el-tag>
              </span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 数据统计 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="info-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">📊 数据摘要</span>
            </div>
          </template>
          <div class="info-list">
            <div class="info-row" v-for="stat in 数据摘要" :key="stat.标签">
              <span class="info-label">{{ stat.图标 }} {{ stat.标签 }}</span>
              <span class="info-value highlight">{{ stat.值.toLocaleString() }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 服务说明 -->
    <el-card shadow="hover" class="info-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">📋 使用说明</span>
        </div>
      </template>
      <div class="help-text">
        <p><strong>登录方式：</strong>首次启动时终端会显示二维码，用 B站APP 扫码即可完成登录，凭证将缓存至本地文件。</p>
        <p><strong>凭证管理：</strong>凭证文件包含 cookie 令牌，请勿泄露。如需重新登录，删除凭证文件后重启服务即可。</p>
        <p><strong>环境变量覆盖：</strong>可通过 <code>端口</code>、<code>数据库路径</code>、<code>B站凭证路径</code> 在命令行指定，改后重启生效。</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="monitorBiliService">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { CircleCheck, Coin, CollectionTag, Connection, DataBoard, Document, Files, Refresh, Tickets } from "@element-plus/icons-vue";
import { getB站状态Api } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";

const 状态 = ref<Monitor.B站状态 | null>(null);
const 加载中 = ref(false);

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const loadData = async () => {
  加载中.value = true;
  try {
    状态.value = await getB站状态Api();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取状态失败");
  } finally {
    加载中.value = false;
  }
};

/** 状态指示灯卡片 */
const 状态卡片 = computed(() => {
  if (!状态.value) return [];
  return [
    {
      标题: "凭证文件",
      正常: 状态.value.凭证存在,
      值: 状态.value.凭证存在 ? "已就绪" : "缺失",
      图标: Files,
    },
    {
      标题: "客户端",
      正常: 状态.value.客户端已加载,
      值: 状态.value.客户端已加载 ? "已连接" : "待启动",
      图标: Connection,
    },
    {
      标题: "综合状态",
      正常: 状态.value.凭证存在,
      值: 状态.value.凭证存在 ? "服务正常" : "需要登录",
      图标: CircleCheck,
    },
  ];
});

const 数据摘要 = computed(() => {
  if (!状态.value?.数据摘要) return [];
  const d = 状态.value.数据摘要;
  return [
    { 图标: "🎬", 标签: "视频", 值: d.视频数 },
    { 图标: "💬", 标签: "评论", 值: d.评论数 },
    { 图标: "📢", 标签: "动态", 值: d.动态数 },
    { 图标: "📝", 标签: "日志", 值: d.日志数 },
    { 图标: "🧠", 标签: "情感分析", 值: d.情感分析数 },
  ];
});

onMounted(loadData);
</script>

<style scoped lang="scss">
.bili-service {
  .toolbar {
    margin-bottom: 16px;
    .toolbar-inner { display: flex; align-items: center; justify-content: space-between; }
    .title { font-size: 18px; font-weight: 600; margin: 0; }
  }

  .status-row { margin-bottom: 16px; }

  .status-card {
    &.ok { border-left: 4px solid var(--el-color-success); }
    &.error { border-left: 4px solid var(--el-color-danger); }
    .card-inner {
      display: flex; align-items: center; gap: 12px;
      .card-icon { color: var(--el-text-color-secondary); flex-shrink: 0; }
      .card-body { flex: 1; min-width: 0; }
      .card-value { font-size: 16px; font-weight: 600; }
      .card-label { font-size: 12px; color: var(--el-text-color-secondary); }
    }
  }

  .detail-row { margin-bottom: 16px; }

  .info-card { margin-bottom: 16px; }

  .card-header {
    display: flex; align-items: center; justify-content: space-between;
    .card-title { font-weight: 600; }
  }

  .info-list {
    .info-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
      &:last-child { border-bottom: none; }
      .info-label { font-size: 13px; color: var(--el-text-color-secondary); }
      .info-value { font-size: 13px; color: var(--el-text-color-primary); }
      .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
      .highlight { font-weight: 600; color: var(--el-color-primary); }
    }
  }

  .help-text {
    p { margin: 6px 0; font-size: 13px; color: var(--el-text-color-regular); line-height: 1.6; }
    code { padding: 1px 4px; background: var(--el-fill-color-light); border-radius: 3px; font-size: 12px; }
  }
}
</style>
