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
      <span class="page-info">共 {{ 总数 }} 条</span>
      <el-button size="small" :disabled="页 <= 1" @click="prev(loadData)">上一页</el-button>
      <span class="page-info">第 {{ 页 }} / {{ 总页数 || '?' }} 页</span>
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
const { 页, pageSize, 总数, 总页数, hasNext, prev, next, set总数 } = usePagination(20);

/** 请求序号守卫：防止快速翻页时慢响应覆盖新数据 */
let 请求序号 = 0;
const loadData = async () => {
  const 本次 = ++请求序号;
  loading.value = true;
  try {
    const res = await getDynamicListApi(页.value, pageSize.value);
    if (本次 !== 请求序号) return;
    tableData.value = res.列表;
    set总数(res.总数);
  } catch (e) {
    if (本次 !== 请求序号) return;
    ElMessage.error(e instanceof Error ? e.message : "加载动态失败");
  } finally {
    if (本次 === 请求序号) loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
