<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, 格式化时间 } from "../api";

const 列表 = ref<unknown[]>([]);
const 页 = ref(1);
const 加载中 = ref(false);

const 列 = [
    { colKey: "阶段", title: "阶段", width: 120 },
    { colKey: "状态", title: "状态", width: 80 },
    { colKey: "采集数量", title: "数量", width: 80 },
    { colKey: "耗时毫秒", title: "耗时(ms)", width: 100 },
    { colKey: "错误信息", title: "错误", ellipsis: true },
    { colKey: "时间", title: "时间", width: 180 },
];

async function 刷新() {
    加载中.value = true;
    try {
        列表.value = await api.日志(页.value);
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
        <t-table :data="列表" :columns="列" row-key="日志ID" :loading="加载中" style="margin-top: 16px">
            <template #时间="{ row }">{{ 格式化时间(row.时间) }}</template>
        </t-table>
        <div style="margin-top: 16px">
            <t-button size="small" :disabled="页 <= 1" @click="上一页">上一页</t-button>
            <span style="margin: 0 12px">第 {{ 页 }} 页</span>
            <t-button size="small" @click="下一页">下一页</t-button>
        </div>
    </div>
</template>
