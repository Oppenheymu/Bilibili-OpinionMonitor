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

    <!-- 主卡片 -->
    <el-row :gutter="16" class="main-row">
      <!-- 登录账号卡片 -->
      <el-col :xs="24" :md="16">
        <el-card shadow="hover" class="user-card">
          <div class="user-section">
            <!-- 头像 + 基础信息 -->
            <div class="user-header">
              <el-avatar :size="72" :src="状态?.用户信息?.头像" class="user-avatar">
                <el-icon :size="36"><UserFilled /></el-icon>
              </el-avatar>
              <div class="user-meta">
                <div class="user-name-row">
                  <span class="user-name">{{ 状态?.用户信息?.昵称 || '未登录' }}</span>
                  <el-tag v-if="状态?.用户信息?.VIP" type="warning" size="small" effect="dark">大会员</el-tag>
                  <el-tag v-if="状态?.用户信息?.等级" size="small" effect="plain">LV{{ 状态?.用户信息?.等级 }}</el-tag>
                </div>
                <div class="user-uid">UID: {{ 状态?.用户信息?.mid || '-' }}</div>
                <div class="user-sign" v-if="状态?.用户信息?.签名">{{ 状态?.用户信息?.签名 }}</div>
              </div>
            </div>
            <!-- 登录状态灯 -->
            <div class="status-strip">
              <div class="status-light" :class="{ on: 状态?.凭证存在 }">
                <span class="light-dot"></span>
                <span>凭证 {{ 状态?.凭证存在 ? '已就绪' : '缺失' }}</span>
              </div>
              <div class="status-light" :class="{ on: 状态?.客户端已加载 }">
                <span class="light-dot"></span>
                <span>客户端 {{ 状态?.客户端已加载 ? '已连接' : '待初始化' }}</span>
              </div>
              <div class="status-light" :class="{ on: 状态?.用户信息 }">
                <span class="light-dot"></span>
                <span>登录 {{ 状态?.用户信息 ? '已完成' : '未登录' }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 凭证详情卡片 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="hover" class="info-card">
          <template #header>
            <span class="card-label">🔐 凭证文件</span>
          </template>
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">路径</span>
              <span class="kv-val mono">{{ 状态?.凭证路径 || '-' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">大小</span>
              <span class="kv-val">{{ 状态?.凭证大小 ? formatBytes(状态.凭证大小) : '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">修改时间</span>
              <span class="kv-val">{{ 状态?.凭证修改时间 ? formatTime(状态.凭证修改时间) : '—' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据统计 -->
    <el-row :gutter="16" class="stat-row">
      <el-col v-for="stat in 数据摘要" :key="stat.标签" :xs="6" :sm="4" :md="4">
        <el-card shadow="hover" class="data-card">
          <div class="data-inner">
            <span class="data-icon">{{ stat.图标 }}</span>
            <span class="data-val">{{ stat.值.toLocaleString() }}</span>
            <span class="data-label">{{ stat.标签 }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 使用说明 -->
    <el-card shadow="hover" class="help-card">
      <template #header><span class="card-label">📋 使用说明</span></template>
      <div class="help-text">
        <p><strong>登录方式：</strong>首次启动时终端会显示二维码，用 B站APP 扫码即可完成登录，凭证将缓存至本地文件。</p>
        <p><strong>凭证管理：</strong>凭证文件包含 cookie 令牌，请勿泄露。如需重新登录，删除凭证文件后重启服务即可。</p>
        <p><strong>环境变量：</strong>可通过 <code>端口</code> / <code>数据库路径</code> / <code>B站凭证路径</code> 覆盖默认值。</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="monitorBiliService">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, UserFilled } from "@element-plus/icons-vue";
import { getB站状态Api } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
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

  .main-row { margin-bottom: 16px; }

  // ── 用户卡片 ──
  .user-card {
    height: 100%;
    :deep(.el-card__body) { padding: 24px; }
    .user-section {
      display: flex; flex-direction: column; gap: 20px;
      .user-header {
        display: flex; align-items: center; gap: 20px;
        .user-avatar { flex-shrink: 0; border: 3px solid var(--el-color-primary-light-5); }
        .user-meta {
          flex: 1; min-width: 0;
          .user-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .user-name { font-size: 22px; font-weight: 700; }
          .user-uid { font-size: 13px; color: var(--el-text-color-secondary); margin-top: 4px; }
          .user-sign { font-size: 13px; color: var(--el-text-color-regular); margin-top: 6px; opacity: 0.85; }
        }
      }
      .status-strip {
        display: flex; gap: 24px;
        .status-light {
          display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--el-text-color-secondary);
          .light-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-danger); flex-shrink: 0; }
          &.on .light-dot { background: var(--el-color-success); }
        }
      }
    }
  }

  // ── 凭证卡片 ──
  .info-card {
    height: 100%;
    .card-label { font-weight: 600; }
    .kv-list {
      .kv-row {
        display: flex; align-items: flex-start; gap: 8px; padding: 8px 0;
        border-bottom: 1px solid var(--el-border-color-lighter);
        &:last-child { border-bottom: none; }
        .kv-key { font-size: 13px; color: var(--el-text-color-secondary); flex-shrink: 0; min-width: 56px; }
        .kv-val { font-size: 13px; color: var(--el-text-color-primary); word-break: break-all; }
        .mono { font-family: monospace; font-size: 12px; }
      }
    }
  }

  // ── 数据统计 ──
  .stat-row { margin-bottom: 16px; }

  .data-card {
    text-align: center;
    :deep(.el-card__body) { padding: 18px 12px; }
    .data-inner {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      .data-icon { font-size: 24px; }
      .data-val { font-size: 20px; font-weight: 700; color: var(--el-color-primary); }
      .data-label { font-size: 12px; color: var(--el-text-color-secondary); }
    }
  }

  // ── 帮助卡片 ──
  .help-card {
    .card-label { font-weight: 600; }
    p { margin: 6px 0; font-size: 13px; line-height: 1.6; color: var(--el-text-color-regular); }
    code { padding: 1px 6px; background: var(--el-fill-color-light); border-radius: 3px; font-size: 12px; }
  }
}
</style>
