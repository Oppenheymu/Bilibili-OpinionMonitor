<script setup lang="ts">
import { ref, type Component } from "vue";
import Overview from "./views/Overview.vue";
import Tasks from "./views/Tasks.vue";
import Comments from "./views/Comments.vue";
import Dynamics from "./views/Dynamics.vue";
import Logs from "./views/Logs.vue";
import Settings from "./views/Settings.vue";

type 页面Key = "overview" | "tasks" | "comments" | "dynamics" | "logs" | "settings";
const 当前页 = ref<页面Key>("overview");
const 页面映射: Record<页面Key, Component> = {
    overview: Overview,
    tasks: Tasks,
    comments: Comments,
    dynamics: Dynamics,
    logs: Logs,
    settings: Settings,
};
const 菜单: { value: 页面Key; label: string }[] = [
    { value: "overview", label: "舆情概览" },
    { value: "tasks", label: "监控任务" },
    { value: "comments", label: "评论列表" },
    { value: "dynamics", label: "动态列表" },
    { value: "logs", label: "采集日志" },
    { value: "settings", label: "系统配置" },
];
</script>

<template>
    <t-layout class="root">
        <t-aside width="220px">
            <div class="logo">B站舆论监控</div>
            <t-menu v-model="当前页">
                <t-menu-item v-for="m in 菜单" :key="m.value" :value="m.value">{{ m.label }}</t-menu-item>
            </t-menu>
        </t-aside>
        <t-layout>
            <t-content class="content">
                <component :is="页面映射[当前页]" />
            </t-content>
        </t-layout>
    </t-layout>
</template>

<style scoped>
.root {
    height: 100vh;
}
.logo {
    padding: 16px 20px;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid #e5e4e7;
}
.content {
    padding: 20px;
    background: #f5f5f5;
    overflow: auto;
}
</style>
