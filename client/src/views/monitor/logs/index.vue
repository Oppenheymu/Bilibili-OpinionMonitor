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
      <el-button size="small" :disabled="页 <= 1" @click="prev">上一页</el-button>
      <span class="page-info">第 {{ 页 }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorLogs">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import dayjs from "dayjs";
import { getLogListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";

const tableData = ref<Monitor.Log[]>([]);
const loading = ref(false);
const 页 = ref(1);
const pageSize = 20;

const formatTime = (ts: number | null | undefined) => (ts ? dayjs.unix(ts).format("YYYY-MM-DD HH:mm:ss") : "-");

const statusType = (状态: string) => {
  if (状态 === "成功") return "success";
  if (状态 === "失败") return "danger";
  return "warning";
};

const hasNext = computed(() => tableData.value.length >= pageSize);

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getLogListApi(页.value, pageSize);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载日志失败");
  } finally {
    loading.value = false;
  }
};

const prev = () => {
  if (页.value > 1) {
    页.value--;
    loadData();
  }
};
const next = () => {
  页.value++;
  loadData();
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
