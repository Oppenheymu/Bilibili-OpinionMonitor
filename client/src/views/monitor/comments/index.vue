<template>
  <div class="card table-box">
    <!-- 工具栏 -->
    <div class="table-header">
      <el-input
        v-model="搜索词"
        placeholder="搜索评论内容..."
        clearable
        :prefix-icon="Search"
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="handleFilterChange"
      />
      <el-select
        v-model="情感筛选"
        clearable
        placeholder="情感筛选"
        style="width: 130px"
        @change="handleFilterChange"
      >
        <el-option label="正面" value="正面" />
        <el-option label="负面" value="负面" />
        <el-option label="中性" value="中性" />
      </el-select>
      <el-select
        v-model="删除筛选"
        clearable
        placeholder="状态筛选"
        style="width: 130px"
        @change="handleFilterChange"
      >
        <el-option label="正常" :value="false" />
        <el-option label="已删除/封禁" :value="true" />
      </el-select>
      <el-select
        v-model="视频筛选"
        clearable
        filterable
        placeholder="按视频筛选"
        style="width: 220px"
        @change="handleFilterChange"
        @visible-change="loadVideoOptions"
      >
        <el-option
          v-for="v in 视频选项"
          :key="v.视频ID"
          :label="v.标题"
          :value="v.视频ID"
        />
      </el-select>
      <el-button :icon="Refresh" @click="handleFilterChange">刷新</el-button>
      <el-button :icon="Download" @click="导出CSV" :disabled="!总数" :loading="导出中">导出CSV</el-button>
      <el-popconfirm
        title="确认删除全部评论及其情感分析记录？此操作不可恢复！"
        confirm-button-text="确认删除"
        cancel-button-text="取消"
        confirm-button-type="danger"
        width="280"
        @confirm="handleClearAll"
      >
        <template #reference>
          <el-button type="danger" :icon="Delete" :loading="清空中">全部删除</el-button>
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
      <el-table-column prop="内容" label="内容" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'deleted-text': row.是否已删除 }">{{ row.内容 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.是否已删除" type="danger" effect="dark" size="small">已删除/封禁</el-tag>
          <el-tag v-else type="success" effect="plain" size="small">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="情感" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.情感倾向" :type="sentimentType(row.情感倾向)" effect="plain">{{ row.情感倾向 }}</el-tag>
          <span v-else class="text-secondary">未分析</span>
        </template>
      </el-table-column>
      <el-table-column prop="情感分数" label="分数" width="70" align="center" sortable />
      <el-table-column prop="点赞数" label="赞" width="70" align="center" sortable />
      <el-table-column prop="回复数" label="回复" width="70" align="center" sortable />
      <el-table-column label="发布时间" width="170" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.发布时间) }}</template>
      </el-table-column>
    </el-table>

    <!-- 增强分页 -->
    <div class="pagination">
      <span class="page-info">共 {{ 总数 }} 条</span>
      <el-select v-model="pageSize" style="width: 90px" @change="handlePageSizeChange">
        <el-option label="20条" :value="20" />
        <el-option label="50条" :value="50" />
        <el-option label="100条" :value="100" />
      </el-select>
      <el-button size="small" :disabled="页 <= 1" @click="prev(loadData)">上一页</el-button>
      <el-input-number
        v-model="页"
        :min="1"
        :max="总页数 || 1"
        controls-position="right"
        size="small"
        style="width: 100px"
        @change="handlePageJump"
      />
      <span class="page-info">/ {{ 总页数 }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next(loadData)">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorComments">
import { onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Download, Refresh, Search } from "@element-plus/icons-vue";
import { clearAllCommentsApi, getCommentListApi, getVideoListApi } from "@/api/modules/monitor";
import { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Comment[]>([]);
const loading = ref(false);
const 清空中 = ref(false);
const 导出中 = ref(false);
const 情感筛选 = ref("");
const 删除筛选 = ref<boolean | undefined>(undefined);
const 搜索词 = ref("");
const 视频筛选 = ref<number | undefined>();
const 视频选项 = ref<Monitor.Video[]>([]);
const { 页, pageSize, 总数, 总页数, hasNext, prev, next, reset, set总数 } = usePagination(20);

const sentimentType = (倾向: string) => {
  if (倾向 === "正面") return "success";
  if (倾向 === "负面") return "danger";
  return "info";
};

/**
 * 请求序号守卫：防止筛选/分页/刷新并发时，慢的旧响应覆盖新的查询结果
 */
let 请求序号 = 0;
const loadData = async () => {
  const 本次 = ++请求序号;
  loading.value = true;
  try {
    const res = await getCommentListApi({
      页: 页.value,
      大小: pageSize.value,
      情感: 情感筛选.value || undefined,
      视频ID: 视频筛选.value,
      搜索: 搜索词.value || undefined,
      已删除: 删除筛选.value,
    });
    if (本次 !== 请求序号) return; // 已有更新的请求，丢弃过期响应
    tableData.value = res.列表;
    set总数(res.总数);
  } catch (e) {
    if (本次 !== 请求序号) return;
    ElMessage.error(e instanceof Error ? e.message : "加载评论失败");
  } finally {
    if (本次 === 请求序号) loading.value = false;
  }
};

const loadVideoOptions = async (visible: boolean) => {
  if (visible && !视频选项.value.length) {
    try {
      const res = await getVideoListApi(1, 200);
      视频选项.value = res.列表;
    } catch { /* 静默失败 */ }
  }
};

const handleSearch = () => {
  reset(loadData);
};

const handleFilterChange = () => {
  reset(loadData);
};

const handlePageJump = (val: number | undefined) => {
  if (val) { 页.value = val; loadData(); }
};

const handlePageSizeChange = () => {
  reset(loadData);
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

/** CSV 字段转义：含逗号/引号/换行的字段统一加引号并转义内部引号，保证 CSV 结构完整 */
const CSV转义 = (值: string | number | null | undefined): string => {
  const s = String(值 ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

/**
 * 导出 CSV：导出「当前筛选条件下」的全量评论（分页循环拉取），而非仅当前页
 * 上限 10000 条，防止数据量过大拉爆内存
 */
const 导出CSV = async () => {
  if (!总数.value) return;
  const 导出上限 = 10000;
  const 每页 = 500;
  const 全部行: Monitor.Comment[] = [];
  导出中.value = true;
  const 参数 = () => ({
    情感: 情感筛选.value || undefined,
    视频ID: 视频筛选.value,
    搜索: 搜索词.value || undefined,
    已删除: 删除筛选.value,
  });
  try {
    const 首页 = await getCommentListApi({ 页: 1, 大小: 每页, ...参数() });
    全部行.push(...首页.列表);
    const 总页 = Math.min(Math.ceil(首页.总数 / 每页), Math.ceil(导出上限 / 每页));
    for (let 页号 = 2; 页号 <= 总页; 页号++) {
      const res = await getCommentListApi({ 页: 页号, 大小: 每页, ...参数() });
      全部行.push(...res.列表);
    }
    const BOM = "\uFEFF";
    const 表头 = ["来源视频", "BV号", "用户名", "用户UID", "内容", "情感", "分数", "赞", "回复", "发布时间"];
    const 行数据 = 全部行.map(r => [
      CSV转义(r.视频标题),
      CSV转义(r.BV号),
      CSV转义(r.用户名),
      CSV转义(r.用户UID),
      CSV转义(r.内容),
      CSV转义(r.情感倾向 || "未分析"),
      CSV转义(r.情感分数),
      CSV转义(r.点赞数),
      CSV转义(r.回复数),
      CSV转义(formatTime(r.发布时间)),
    ]);
    const csv = BOM + [表头, ...行数据].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `评论数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出 ${全部行.length} 条评论`);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出失败");
  } finally {
    导出中.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>

