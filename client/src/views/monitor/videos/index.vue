<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="封面" width="130">
        <template #default="{ row }">
          <el-image
            v-if="row.cover"
            :src="row.cover"
            style="width: 112px; height: 63px; border-radius: 4px"
            fit="cover"
            lazy
            :preview-src-list="[row.cover]"
            preview-teleported
          />
          <span v-else class="text-secondary">无封面</span>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">
          <a :href="`https://www.bilibili.com/video/${row.bvid}`" target="_blank" class="video-link">
            {{ row.title }}
          </a>
        </template>
      </el-table-column>
      <el-table-column prop="upName" label="UP主" width="160" show-overflow-tooltip />
      <el-table-column prop="bvid" label="BV号" width="140" />
      <el-table-column label="时长" width="90" align="center">
        <template #default="{ row }">
          {{ formatDuration(row.duration) }}
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
      </el-table-column>
      <el-table-column label="采集时间" width="170">
        <template #default="{ row }">{{ formatTime(row.collectedAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <span class="page-info">共 {{ total }} 条</span>
      <el-button size="small" :disabled="page <= 1" @click="prev(loadData)">上一页</el-button>
      <span class="page-info">第 {{ page }} / {{ totalPages || '?' }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next(loadData)">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorVideos">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { getVideoListApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Video[]>([]);
const loading = ref(false);
const { page, pageSize, total, totalPages, hasNext, prev, next, setTotal } = usePagination(20);

const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};

/** 请求序号守卫：防止快速翻页时慢响应覆盖新数据 */
let requestSeq = 0;
const loadData = async () => {
    const current = ++requestSeq;
    loading.value = true;
    try {
        const res = await getVideoListApi(page.value, pageSize.value);
        if (current !== requestSeq) return;
        tableData.value = res.list;
        setTotal(res.total);
    } catch (e) {
        if (current !== requestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载视频列表失败");
    } finally {
        if (current === requestSeq) loading.value = false;
    }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
.table-box {
  .table-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .pagination {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 16px;
    .page-info {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}
.video-link { color: #409eff; text-decoration: none; &:hover { text-decoration: underline; } }
.text-secondary { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
