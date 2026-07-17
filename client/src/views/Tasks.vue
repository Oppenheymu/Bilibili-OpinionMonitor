<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import { api, 格式化时间, type 任务 } from "../api";

const 列表 = ref<任务[]>([]);
const 加载中 = ref(false);
const 弹窗可见 = ref(false);
const 表单 = ref({ 类型: "up主", 目标: "" });

const 列 = [
    { colKey: "任务ID", title: "ID", width: 60 },
    { colKey: "类型", title: "类型", width: 100 },
    { colKey: "目标", title: "目标" },
    { colKey: "最后采集时间", title: "最后采集", width: 180 },
    { colKey: "操作", title: "操作", width: 180 },
];

async function 刷新() {
    加载中.value = true;
    try {
        列表.value = await api.获取任务();
    } finally {
        加载中.value = false;
    }
}
onMounted(刷新);

async function 切换状态(行: 任务) {
    await api.更新任务(行.任务ID, !行.启用);
    await 刷新();
}
async function 删除(行: 任务) {
    await api.删除任务(行.任务ID);
    MessagePlugin.success("已删除");
    await 刷新();
}
async function 提交() {
    try {
        await api.创建任务(表单.value.类型, 表单.value.目标);
        MessagePlugin.success("已创建");
        弹窗可见.value = false;
        表单.value.目标 = "";
        await 刷新();
    } catch (e) {
        MessagePlugin.error(e instanceof Error ? e.message : "创建失败");
    }
}
</script>

<template>
    <div>
        <t-button @click="弹窗可见 = true">新建任务</t-button>
        <t-button style="margin-left: 8px" @click="刷新">刷新</t-button>
        <t-table :data="列表" :columns="列" row-key="任务ID" :loading="加载中" style="margin-top: 16px">
            <template #最后采集时间="{ row }">{{ 格式化时间(row.最后采集时间) }}</template>
            <template #操作="{ row }">
                <t-button size="small" variant="text" @click="切换状态(row)">
                    {{ row.启用 ? "禁用" : "启用" }}
                </t-button>
                <t-button size="small" variant="text" theme="danger" @click="删除(row)">删除</t-button>
            </template>
        </t-table>

        <t-dialog v-model:visible="弹窗可见" header="新建监控任务" @confirm="提交">
            <t-form label-width="60px">
                <t-form-item label="类型">
                    <t-select v-model="表单.类型">
                        <t-option value="up主" label="UP主" />
                        <t-option value="关键词" label="关键词" />
                    </t-select>
                </t-form-item>
                <t-form-item label="目标">
                    <t-input v-model="表单.目标" :placeholder="表单.类型 === 'up主' ? 'UP主 UID' : '关键词文本'" />
                </t-form-item>
            </t-form>
        </t-dialog>
    </div>
</template>
