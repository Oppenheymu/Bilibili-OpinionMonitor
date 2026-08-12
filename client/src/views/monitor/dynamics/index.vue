<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="类型" width="160">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="正文" show-overflow-tooltip />
      <el-table-column prop="upUid" label="UP主 UID" width="120" align="center" />
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
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

<script setup lang="ts" name="monitorDynamics">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { getDynamicListApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Dynamic[]>([]);
const loading = ref(false);
const { page, pageSize, total, totalPages, hasNext, prev, next, setTotal } = usePagination(20);

/** 请求序号守卫：防止快速翻页时慢响应覆盖新数据 */
let requestSeq = 0;
const loadData = async () => {
    const current = ++requestSeq;
    loading.value = true;
    try {
        const res = await getDynamicListApi(page.value, pageSize.value);
        if (current !== requestSeq) return;
        tableData.value = res.list;
        setTotal(res.total);
    } catch (e) {
        if (current !== requestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载动态失败");
    } finally {
        if (current === requestSeq) loading.value = false;
    }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
