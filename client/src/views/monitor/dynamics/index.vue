<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="类型" width="160">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.类型 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="正文" label="正文" show-overflow-tooltip />
      <el-table-column prop="UP主UID" label="UP主 UID" width="120" align="center" />
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.发布时间) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-button size="small" :disabled="页 <= 1" @click="prev">上一页</el-button>
      <span class="page-info">第 {{ 页 }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorDynamics">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import dayjs from "dayjs";
import { getDynamicListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";

const tableData = ref<Monitor.Dynamic[]>([]);
const loading = ref(false);
const 页 = ref(1);
const pageSize = 20;

const formatTime = (ts: number | null | undefined) => (ts ? dayjs.unix(ts).format("YYYY-MM-DD HH:mm:ss") : "-");

const hasNext = computed(() => tableData.value.length >= pageSize);

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getDynamicListApi(页.value, pageSize);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载动态失败");
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
