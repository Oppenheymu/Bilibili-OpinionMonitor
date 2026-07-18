<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import { api, type 概览统计 } from "../api";

const 概览 = ref<概览统计>({
    视频总数: 0,
    评论总数: 0,
    动态总数: 0,
    已分析评论: 0,
    情感分布: {},
});
const 分布 = ref<{ 倾向: string; 数: number }[]>([]);
const 趋势 = ref<{ 日期: string; 评论数: number; 平均分数: number }[]>([]);
const 加载中 = ref(false);

async function 刷新() {
    加载中.value = true;
    try {
        const [概, 分, 趋] = await Promise.all([api.概览(), api.情感分布(), api.趋势(7)]);
        概览.value = 概;
        分布.value = 分;
        趋势.value = 趋;
    } catch (e) {
        MessagePlugin.error(e instanceof Error ? e.message : "加载数据失败");
    } finally {
        加载中.value = false;
    }
}
onMounted(刷新);

const 统计卡片 = computed(() => [
    { label: "视频", value: 概览.value.视频总数 },
    { label: "评论", value: 概览.value.评论总数 },
    { label: "动态", value: 概览.value.动态总数 },
    { label: "已分析评论", value: 概览.value.已分析评论 },
]);

const 饼图配置 = computed(
    () =>
        ({
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [
                {
                    type: "pie",
                    radius: ["40%", "70%"],
                    data: 分布.value.map((d) => ({ name: d.倾向, value: d.数 })),
                },
            ],
        }) as unknown,
);

const 折线配置 = computed(
    () =>
        ({
            tooltip: { trigger: "axis" },
            legend: { data: ["评论数", "平均情感分"] },
            xAxis: { type: "category", data: 趋势.value.map((t) => t.日期) },
            yAxis: [
                { type: "value", name: "评论数" },
                { type: "value", name: "情感分", min: -100, max: 100 },
            ],
            series: [
                { name: "评论数", type: "line", data: 趋势.value.map((t) => t.评论数) },
                { name: "平均情感分", type: "line", yAxisIndex: 1, data: 趋势.value.map((t) => t.平均分数) },
            ],
        }) as unknown,
);

async function 触发采集() {
    await api.触发采集();
    刷新();
}
</script>

<template>
    <t-loading :loading="加载中">
        <t-row :gutter="16">
            <t-col v-for="c in 统计卡片" :key="c.label" :span="6">
                <t-card>
                    <div class="stat">
                        <div class="num">{{ c.value }}</div>
                        <div class="lbl">{{ c.label }}</div>
                    </div>
                </t-card>
            </t-col>
        </t-row>
        <t-row :gutter="16" style="margin-top: 16px">
            <t-col :span="6">
                <t-card title="情感分布">
                    <v-chart :option="饼图配置" autoresize style="height: 300px" />
                </t-card>
            </t-col>
            <t-col :span="6">
                <t-card title="近7天趋势">
                    <v-chart :option="折线配置" autoresize style="height: 300px" />
                </t-card>
            </t-col>
        </t-row>
        <div style="margin-top: 16px">
            <t-button @click="刷新">刷新数据</t-button>
            <t-button theme="primary" style="margin-left: 8px" @click="触发采集">触发采集</t-button>
        </div>
    </t-loading>
</template>

<style scoped>
.stat {
    text-align: center;
}
.stat .num {
    font-size: 32px;
    font-weight: 600;
}
.stat .lbl {
    color: #888;
    margin-top: 4px;
}
</style>
