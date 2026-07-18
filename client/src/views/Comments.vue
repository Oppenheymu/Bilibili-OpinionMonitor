<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import { api, 格式化时间 } from "../api";

const 列表 = ref<unknown[]>([]);
const 页 = ref(1);
const 情感筛选 = ref("");
const 加载中 = ref(false);

const 列 = [
    { colKey: "用户名", title: "用户", width: 120 },
    { colKey: "内容", title: "内容", ellipsis: true },
    { colKey: "情感倾向", title: "情感", width: 80 },
    { colKey: "情感分数", title: "分数", width: 80 },
    { colKey: "点赞数", title: "赞", width: 80 },
    { colKey: "发布时间", title: "时间", width: 180 },
];

async function 刷新() {
    加载中.value = true;
    try {
        列表.value = await api.评论({ 情感: 情感筛选.value || undefined, 页: 页.value });
    } catch (e) {
        MessagePlugin.error(e instanceof Error ? e.message : "加载失败");
    } finally {
        加载中.value = false;
    }
}
onMounted(刷新);
function 上一页() {
    if (页.value > 1) {
        页.value--;
        刷新();
    }
}
function 下一页() {
    页.value++;
    刷新();
}
</script>

<template>
    <div>
        <t-select v-model="情感筛选" clearable placeholder="情感筛选" style="width: 140px" @change="刷新">
            <t-option value="正面" label="正面" />
            <t-option value="负面" label="负面" />
            <t-option value="中性" label="中性" />
        </t-select>
        <t-button style="margin-left: 8px" @click="刷新">刷新</t-button>
        <t-table :data="列表" :columns="列" row-key="评论ID" :loading="加载中" style="margin-top: 16px">
            <template #发布时间="{ row }">{{ 格式化时间(row.发布时间) }}</template>
        </t-table>
        <div style="margin-top: 16px">
            <t-button size="small" :disabled="页 <= 1" @click="上一页">上一页</t-button>
            <span style="margin: 0 12px">第 {{ 页 }} 页</span>
            <t-button size="small" @click="下一页">下一页</t-button>
        </div>
    </div>
</template>
