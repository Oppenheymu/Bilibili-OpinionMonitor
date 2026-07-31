<template>
  <div class="card table-box">
    <div class="table-header">
      <el-select v-model="情感筛选" clearable placeholder="情感筛选" style="width: 140px" @change="handleFilterChange">
        <el-option label="正面" value="正面" />
        <el-option label="负面" value="负面" />
        <el-option label="中性" value="中性" />
      </el-select>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      <el-popconfirm
        title="确认删除全部评论及其情感分析记录？此操作不可恢复！"
        confirm-button-text="确认删除"
        cancel-button-text="取消"
        confirm-button-type="danger"
        width="280"
        @confirm="handleClearAll"
      >
        <template #reference>
          <el-button type="danger" :icon="Delete" :loading="清空中" class="clear-btn">全部删除</el-button>
        </template>
      </el-popconfirm>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="来源视频" width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <a v-if="row.BV号" :href="`https://www.bilibili.com/video/${row.BV号}`" target="_blank" class="video-link">
            {{ row.视频标题 || row.BV号 }}
          </a>
          <span v-else class="text-secondary">-</span>
        </template>
      </el-table-column>
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
      <el-button size="small" :disabled="页 <= 1" @click="prev(loadData)">上一页</el-button>
      <span class="page-info">第 {{ 页 }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next(loadData)">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorComments">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Refresh } from "@element-plus/icons-vue";
import { clearAllCommentsApi, getCommentListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Comment[]>([]);
const loading = ref(false);
const 清空中 = ref(false);
const 情感筛选 = ref("");
const { 页, pageSize, hasNext, prev, next, setDataLength } = usePagination();

const sentimentType = (倾向: string) => {
  if (倾向 === "正面") return "success";
  if (倾向 === "负面") return "danger";
  return "info";
};

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getCommentListApi({ 页: 页.value, 大小: pageSize, 情感: 情感筛选.value || undefined });
    setDataLength(tableData.value.length);
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

const handleClearAll = async () => {
  清空中.value = true;
  try {
    const res = await clearAllCommentsApi();
    ElMessage.success(res.消息 || `已清空 ${res.评论} 条评论`);
    页.value = 1;
    await loadData();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "清空失败");
  } finally {
    清空中.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
