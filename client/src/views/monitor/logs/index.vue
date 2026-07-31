<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column prop="阶段" label="阶段" width="140" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.状态)" effect="dark">{{ row.状态 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="采集数量" label="数量" width="90" align="center" />
      <el-table-column label="耗时" width="110" align="center">
        <template #default="{ row }">{{ row.耗时毫秒 }} ms</template>
      </el-table-column>
      <el-table-column prop="错误信息" label="错误信息" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.错误信息" class="text-danger">{{ row.错误信息 }}</span>
          <span v-else class="text-secondary">-</span>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.时间) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-button size="small" :disabled="页 <= 1" @click="prev(loadData)">上一页</el-button>
      <span class="page-info">第 {{ 页 }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next(loadData)">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorLogs">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { getLogListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Log[]>([]);
const loading = ref(false);
const { 页, pageSize, hasNext, prev, next, setDataLength } = usePagination();

const statusType = (状态: string) => {
  if (状态 === "成功") return "success";
  if (状态 === "失败") return "danger";
  return "warning";
};

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getLogListApi(页.value, pageSize);
    setDataLength(tableData.value.length);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载日志失败");
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
