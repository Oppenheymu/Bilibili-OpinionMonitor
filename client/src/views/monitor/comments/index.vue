<template>
  <div class="card table-box">
    <!-- 工具栏 -->
    <div class="table-header">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索评论内容..."
        clearable
        :prefix-icon="Search"
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="handleFilterChange"
      />
      <el-select
        v-model="sentimentFilter"
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
        v-model="deletedFilter"
        clearable
        placeholder="状态筛选"
        style="width: 130px"
        @change="handleFilterChange"
      >
        <el-option label="正常" :value="false" />
        <el-option label="已删除/封禁" :value="true" />
      </el-select>
      <el-select
        v-model="videoFilter"
        clearable
        filterable
        placeholder="按视频筛选"
        style="width: 220px"
        @change="handleFilterChange"
        @visible-change="loadVideoOptions"
      >
        <el-option
          v-for="v in videoOptions"
          :key="v.id"
          :label="v.title"
          :value="v.id"
        />
      </el-select>
      <el-button :icon="Refresh" @click="handleFilterChange">刷新</el-button>
      <el-button :icon="Download" @click="exportCSV" :disabled="!total" :loading="exporting">导出CSV</el-button>
      <el-popconfirm
        title="确认删除全部评论及其情感分析记录？此操作不可恢复！"
        confirm-button-text="确认删除"
        cancel-button-text="取消"
        confirm-button-type="danger"
        width="280"
        @confirm="handleClearAll"
      >
        <template #reference>
          <el-button type="danger" :icon="Delete" :loading="clearing">全部删除</el-button>
        </template>
      </el-popconfirm>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column label="来源视频" width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <a v-if="row.bvid" :href="`https://www.bilibili.com/video/${row.bvid}`" target="_blank" class="video-link">
            {{ row.videoTitle || row.bvid }}
          </a>
          <span v-else class="text-secondary">-</span>
        </template>
      </el-table-column>
      <el-table-column label="用户" width="160">
        <template #default="{ row }">
          <div class="user-cell">
            <span class="user-name">{{ row.username }}</span>
            <span class="user-uid">UID: {{ row.userUid ?? "-" }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'deleted-text': row.isDeleted }">{{ row.content }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isDeleted" type="danger" effect="dark" size="small">已删除/封禁</el-tag>
          <el-tag v-else type="success" effect="plain" size="small">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="情感" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.sentiment" :type="sentimentType(row.sentiment)" effect="plain">{{ row.sentiment }}</el-tag>
          <span v-else class="text-secondary">未分析</span>
        </template>
      </el-table-column>
      <el-table-column prop="sentimentScore" label="分数" width="70" align="center" sortable />
      <el-table-column prop="likes" label="赞" width="70" align="center" sortable />
      <el-table-column prop="replies" label="回复" width="70" align="center" sortable />
      <el-table-column label="发布时间" width="170" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.publishTime) }}</template>
      </el-table-column>
    </el-table>

    <!-- 增强分页 -->
    <div class="pagination">
      <span class="page-info">共 {{ total }} 条</span>
      <el-select v-model="pageSize" style="width: 90px" @change="handlePageSizeChange">
        <el-option label="20条" :value="20" />
        <el-option label="50条" :value="50" />
        <el-option label="100条" :value="100" />
      </el-select>
      <el-button size="small" :disabled="page <= 1" @click="prev(loadData)">上一页</el-button>
      <el-input-number
        v-model="page"
        :min="1"
        :max="totalPages || 1"
        controls-position="right"
        size="small"
        style="width: 100px"
        @change="handlePageJump"
      />
      <span class="page-info">/ {{ totalPages }} 页</span>
      <el-button size="small" :disabled="!hasNext" @click="next(loadData)">下一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="monitorComments">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Download, Refresh, Search } from "@element-plus/icons-vue";
import { clearAllCommentsApi, getCommentListApi, getVideoListApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";
import { usePagination } from "@/hooks/usePagination";

const tableData = ref<Monitor.Comment[]>([]);
const loading = ref(false);
const clearing = ref(false);
const exporting = ref(false);
const sentimentFilter = ref("");
const deletedFilter = ref<boolean | undefined>(undefined);
const searchKeyword = ref("");
const videoFilter = ref<number | undefined>();
const videoOptions = ref<Monitor.Video[]>([]);
const { page, pageSize, total, totalPages, hasNext, prev, next, reset, setTotal } = usePagination(20);

const sentimentType = (sentiment: string) => {
    if (sentiment === "正面") return "success";
    if (sentiment === "负面") return "danger";
    return "info";
};

/**
 * 请求序号守卫：防止筛选/分页/刷新并发时，慢的旧响应覆盖新的查询结果
 */
let requestSeq = 0;
const loadData = async () => {
    const current = ++requestSeq;
    loading.value = true;
    try {
        const res = await getCommentListApi({
            page: page.value,
            size: pageSize.value,
            sentiment: sentimentFilter.value || undefined,
            videoId: videoFilter.value,
            keyword: searchKeyword.value || undefined,
            deleted: deletedFilter.value,
        });
        if (current !== requestSeq) return; // 已有更新的请求，丢弃过期响应
        tableData.value = res.list;
        setTotal(res.total);
    } catch (e) {
        if (current !== requestSeq) return;
        ElMessage.error(e instanceof Error ? e.message : "加载评论失败");
    } finally {
        if (current === requestSeq) loading.value = false;
    }
};

const loadVideoOptions = async (visible: boolean) => {
    if (visible && !videoOptions.value.length) {
        try {
            const res = await getVideoListApi(1, 200);
            videoOptions.value = res.list;
        } catch {
            /* 静默失败 */
        }
    }
};

const handleSearch = () => {
    reset(loadData);
};

const handleFilterChange = () => {
    reset(loadData);
};

const handlePageJump = (val: number | undefined) => {
    if (val) {
        page.value = val;
        loadData();
    }
};

const handlePageSizeChange = () => {
    reset(loadData);
};

const handleClearAll = async () => {
    clearing.value = true;
    try {
        const res = await clearAllCommentsApi();
        ElMessage.success(res.message || `已清空 ${res.comments} 条评论`);
        page.value = 1;
        await loadData();
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "清空失败");
    } finally {
        clearing.value = false;
    }
};

/** CSV 字段转义：含逗号/引号/换行的字段统一加引号并转义内部引号，保证 CSV 结构完整 */
const csvEscape = (value: string | number | null | undefined): string => {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
};

/**
 * 导出 CSV：导出「当前筛选条件下」的全量评论（分页循环拉取），而非仅当前页
 * 上限 10000 条，防止数据量过大拉爆内存
 */
const exportCSV = async () => {
    if (!total.value) return;
    const exportLimit = 10000;
    const pageLimit = 500;
    const allRows: Monitor.Comment[] = [];
    exporting.value = true;
    const buildParams = () => ({
        sentiment: sentimentFilter.value || undefined,
        videoId: videoFilter.value,
        keyword: searchKeyword.value || undefined,
        deleted: deletedFilter.value,
    });
    try {
        const firstPage = await getCommentListApi({ page: 1, size: pageLimit, ...buildParams() });
        allRows.push(...firstPage.list);
        const pageCount = Math.min(Math.ceil(firstPage.total / pageLimit), Math.ceil(exportLimit / pageLimit));
        for (let p = 2; p <= pageCount; p++) {
            const res = await getCommentListApi({ page: p, size: pageLimit, ...buildParams() });
            allRows.push(...res.list);
        }
        const BOM = "\uFEFF";
        const headers = ["来源视频", "BV号", "用户名", "用户UID", "内容", "情感", "分数", "赞", "回复", "发布时间"];
        const rows = allRows.map((r) => [
            csvEscape(r.videoTitle),
            csvEscape(r.bvid),
            csvEscape(r.username),
            csvEscape(r.userUid),
            csvEscape(r.content),
            csvEscape(r.sentiment || "未分析"),
            csvEscape(r.sentimentScore),
            csvEscape(r.likes),
            csvEscape(r.replies),
            csvEscape(formatTime(r.publishTime)),
        ]);
        const csv = BOM + [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `评论数据_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        ElMessage.success(`已导出 ${allRows.length} 条评论`);
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "导出失败");
    } finally {
        exporting.value = false;
    }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>

