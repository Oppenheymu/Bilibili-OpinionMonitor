<template>
  <div class="card table-box">
    <div class="table-header">
      <el-select v-model="情感筛选" clearable placeholder="情感筛选" style="width: 140px" @change="handleFilterChange">
        <el-option label="正面" value="正面" />
        <el-option label="负面" value="负面" />
        <el-option label="中性" value="中性" />
      </el-select>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="用户" width="160">
        <template #default="{ row }">
          <div class="user-cell">
            <span class="user-name">{{ row.用户名 }}</span>
            <span class="user-uid">UID: {{ row.用户UID ?? "-" }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="内容" label="内容" min-width="300" show-overflow-tooltip />
      <el-table-column label="情感" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.情感倾向" :type="sentimentType(row.情感倾向)" effect="plain">{{ row.情感倾向 }}</el-tag>
          <span v-else class="text-secondary">未分析</span>
        </template>
      </el-table-column>
      <el-table-column prop="情感分数" label="分数" width="80" align="center" />
      <el-table-column prop="点赞数" label="赞" width="70" align="center" />
      <el-table-column prop="回复数" label="回复" width="70" align="center" />
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

<script setup lang="ts" name="monitorComments">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import dayjs from "dayjs";
import { getCommentListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";

const tableData = ref<Monitor.Comment[]>([]);
const loading = ref(false);
const 页 = ref(1);
const pageSize = 20;
const 情感筛选 = ref("");

const formatTime = (ts: number | null | undefined) => (ts ? dayjs.unix(ts).format("YYYY-MM-DD HH:mm:ss") : "-");

const sentimentType = (倾向: string) => {
  if (倾向 === "正面") return "success";
  if (倾向 === "负面") return "danger";
  return "info";
};

// 是否还有下一页（当前页数据满 pageSize 则可能有下一页）
const hasNext = computed(() => tableData.value.length >= pageSize);

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getCommentListApi({ 页: 页.value, 大小: pageSize, 情感: 情感筛选.value || undefined });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载评论失败");
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  页.value = 1;
  loadData();
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
