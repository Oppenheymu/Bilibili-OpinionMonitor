<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, 格式化时间 } from "../api";

const 列表 = ref<unknown[]>([]);
const 页 = ref(1);
const 加载中 = ref(false);

const 列 = [
    { colKey: "类型", title: "类型", width: 160 },
    { colKey: "正文", title: "正文", ellipsis: true },
    { colKey: "UP主UID", title: "UP主", width: 120 },
    { colKey: "发布时间", title: "发布时间", width: 180 },
];

async function 刷新() {
    加载中.value = true;
    try {
        列表.value = await api.动态(页.value);
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
        <t-button @click="刷新">刷新</t-button>
        <t-table :data="列表" :columns="列" row-key="动态ID" :loading="加载中" style="margin-top: 16px">
            <template #发布时间="{ row }">{{ 格式化时间(row.发布时间) }}</template>
        </t-table>
        <div style="margin-top: 16px">
            <t-button size="small" :disabled="页 <= 1" @click="上一页">上一页</t-button>
            <span style="margin: 0 12px">第 {{ 页 }} 页</span>
            <t-button size="small" @click="下一页">下一页</t-button>
        </div>
    </div>
</template>
