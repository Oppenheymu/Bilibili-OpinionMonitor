<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { MessagePlugin } from "tdesign-vue-next";

/* ── 类型定义 ────────────────────────────── */
type 输入类型 = "文本" | "数字" | "密码" | "下拉" | "开关" | "多行" | "JSON";

interface 表单项 {
    key: string;
    label: string;
    type: 输入类型;
    提示?: string;
    占位?: string;
    默认值?: unknown;
    选项?: { label: string; value: string | number | boolean }[];
    校验规则?(v: unknown): string | null;
    单位?: string;
}

interface 配置分组 {
    标题: string;
    图标: string;
    说明: string;
    字段: 表单项[];
}

/* ── 配置 Schema（动态表单定义）────────── */
const 分组列表: 配置分组[] = [
    {
        标题: "采集调度",
        图标: "⏱",
        说明: "控制定时采集的频率和数据量",
        字段: [
            { key: "采集间隔分钟", label: "采集间隔", type: "数字", 提示: "两次自动采集之间的时间间隔", 默认值: 30, 单位: "分钟", 校验规则(v) { const n = Number(v); if (typeof v !== "number" || isNaN(n)) return "必须为数字"; if (n < 5) return "最小 5 分钟"; if (n > 1440) return "最大 1440 分钟（24 小时）"; return null; } },
            { key: "单视频评论上限", label: "评论采集上限", type: "数字", 提示: "每个视频最多采集的评论数量", 默认值: 500, 单位: "条", 校验规则(v) { const n = Number(v); if (n < 10) return "最少 10 条"; if (n > 2000) return "最多 2000 条"; return null; } },
            { key: "分析批量大小", label: "LLM 分析批次", type: "数字", 提示: "每次发送给 LLM 分析的条目数", 默认值: 20, 单位: "条/批", 校验规则(v) { const n = Number(v); if (n < 1 || n > 50) return "范围 1 ~ 50"; return null; } },
        ],
    },
    {
        标题: "LLM 模型配置",
        图标: "🤖",
        说明: "情感分析使用的 LLM 服务设置",
        字段: [
            { key: "LLM提供商", label: "默认提供商", type: "下拉", 提示: "选择主要使用的 LLM 服务商", 选项: [{ label: "DeepSeek", value: "deepseek" }, { label: "Gemini", value: "gemini" }], 默认值: "deepseek" },
            { key: "DeepSeek密钥", label: "DeepSeek API Key", type: "密码", 提示: "sk- 开头的密钥，留空使用环境变量", 占位: "sk-xxxxxxxxxxxx", 默认值: "" },
            { key: "DeepSeek模型", label: "DeepSeek 模型", type: "文本", 提示: "指定 DeepSeek 模型名称", 占位: "deepseek-chat", 默认值: "deepseek-chat" },
            { key: "DeepSeek地址", label: "DeepSeek 端点", type: "文本", 提示: "API 基础地址，支持自定义中转", 占位: "https://api.deepseek.com/v1", 默认值: "" },
            { key: "Gemini密钥", label: "Gemini API Key", type: "密码", 提示: "Google AI 密钥，留空使用环境变量", 占位: "AIzaSy...", 默认值: "" },
            { key: "Gemini模型", label: "Gemini 模型", type: "文本", 提示: "指定 Gemini 模型名称", 占位: "gemini-2.5-flash", 默认值: "gemini-2.5-flash" },
            { key: "Gemini地址", label: "Gemini 端点", type: "文本", 提示: "API 基础地址，支持自定义中转", 占位: "https://generativelanguage.googleapis.com/v1beta/openai", 默认值: "" },
            { key: "LLMTemperature", label: "Temperature", type: "数字", 提示: "输出随机性：低=稳定，高=创意。情感分析建议用低值", 默认值: 0.2, 单位: "(0~1)", 校验规则(v) { const n = Number(v); if (n < 0 || n > 1) return "范围 0 ~ 1"; return null; } },
        ],
    },
    {
        标题: "B站服务",
        图标: "📺",
        说明: "B站 API 连接与凭证管理",
        字段: [
            { key: "端口", label: "服务端口号", type: "数字", 提示: "后端 HTTP 服务监听端口", 默认值: 5160, 校验规则(v) { const n = Number(v); if (n < 1024 || n > 65535) return "范围 1024 ~ 65535"; return null; } },
            { key: "数据库路径", label: "数据库路径", type: "文本", 提示: "SQLite 数据库文件存储位置", 占位: "./data/monitor.db", 默认值: "./data/monitor.db" },
            { key: "凭证路径", label: "B站凭证文件", type: "文本", 提示: "B站登录凭证缓存路径（TV端扫码登录生成）", 占位: "./data/bili-凭证.json", 默认值: "./data/bili-凭证.json" },
        ],
    },
    {
        标题: "界面与导出",
        图标: "⚙️",
        说明: "前端展示偏好和数据导出设置",
        字段: [
            { key: "自动刷新秒数", label: "自动刷新周期", type: "数字", 提示: "概览页数据自动刷新间隔（0 表示手动刷新）", 默认值: 0, 单位: "秒（0=关闭）", 校验规则(v) { const n = Number(v); if (n < 0 || n > 3600) return "范围 0 ~ 3600 秒"; return null; } },
            { key: "深色模式", label: "深色模式", type: "开关", 提示: "切换界面主题（需页面刷新生效）", 默认值: false },
            { key: "表格行数", label: "默认分页大小", type: "下拉", 提示: "各列表页的每页显示条数", 选项: [10, 20, 50, 100].map((v) => ({ label: `${v} 条`, value: v })), 默认值: 20 },
        ],
    },
];

/* ── 状态管理 ────────────────────────────── */
const 存储键前缀 = "bili-monitor-config";

function 构造默认值(): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    for (const g of 分组列表) for (const f of g.字段) d[f.key] = f.默认值 ?? "";
    return d;
}

function 从本地加载(): Record<string, unknown> {
    try {
        const raw = localStorage.getItem(存储键前缀);
        if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object") return parsed; }
    } catch {}
    return 构造默认值();
}

const 表单数据 = reactive<Record<string, unknown>>(从本地加载());
const 错误映射 = ref<Record<string, string>>({});
const 已修改 = ref(false);
const 文件输入 = ref<HTMLInputElement>();

/* ── 校验逻辑 ────────────────────────────── */
function 查找字段(key: string): 表单项 | undefined {
    for (const g of 分组列表) for (const f of g.字段) if (f.key === key) return f;
}

function 校验字段(item: 表单项): string | null {
    const v = 表单数据[item.key];
    if (item.type === "数字" && v !== "" && v !== null && v !== undefined) {
        if (Number.isNaN(Number(v))) return "请输入有效数字";
    }
    if (item.type === "JSON" && typeof v === "string" && v.trim()) {
        try { JSON.parse(v); } catch { return "JSON 格式无效"; }
    }
    if (item.校验规则) return item.校验规则(v);
    return null;
}

function 校验单个字段(key: string): void {
    const item = 查找字段(key);
    if (!item) return;
    const err = 校验字段(item);
    if (err) 错误映射.value[key] = err;
    else delete 错误映射.value[key];
}

function 全局校验(): boolean {
    错误映射.value = {};
    for (const g of 分组列表) for (const f of g.字段) {
        const err = 校验字段(f);
        if (err) { 错误映射.value[f.key] = err; }
    }
    return Object.keys(错误映射.value).length === 0;
}

/* ── 监听变化 ────────────────────────────── */
watch(
    () => ({ ...表单数据 }),
    () => { 已修改.value = true; },
    { deep: true },
);

/* ── 持久化操作 ──────────────────────────── */
function 保存到本地() {
    if (!全局校验()) { MessagePlugin.warning("请修正表单中的错误"); return; }
    try {
        localStorage.setItem(存储键前缀, JSON.stringify(表单数据));
        已修改.value = false;
        MessagePlugin.success("配置已保存到浏览器本地");
    } catch (e) {
        MessagePlugin.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
    }
}

function 重置为默认() {
    const defaults = 构造默认值();
    Object.assign(表单数据, defaults);
    错误映射.value = {};
    已修改.value = true;
    MessagePlugin.info("已恢复默认值（未保存）");
}

function 导出JSON() {
    const data = JSON.stringify({ 导出时间: new Date().toISOString(), ...表单数据 }, null, 4);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bili-monitor-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    MessagePlugin.success("配置 JSON 已下载");
}

function 导入JSON(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const obj = JSON.parse(reader.result as string);
            if (obj && typeof obj === "object") {
                delete obj["导出时间"];
                Object.assign(表单数据, obj);
                已修改.value = true;
                MessagePlugin.success(`已导入 ${Object.keys(obj).length} 个配置项`);
            }
        } catch {
            MessagePlugin.error("文件解析失败，请检查 JSON 格式");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

async function 复制JSON() {
    try {
        await navigator.clipboard.writeText(JSON预览.value);
        MessagePlugin.success("已复制到剪贴板");
    } catch { MessagePlugin.error("复制失败，请手动选择复制"); }
}

/* ── 计算属性 ────────────────────────────── */
const JSON预览 = computed(() => {
    try { return JSON.stringify(表单数据, null, 4); } catch { return "{}"; }
});

const 未保存项数 = computed(() => {
    let count = 0;
    for (const g of 分组列表)
        for (const f of g.字段)
            if (String(表单数据[f.key]) !== String(f.默认值 ?? "")) count++;
    return count;
});

onMounted(() => {});
</script>

<template>
    <div class="settings">
        <!-- 顶部工具栏 -->
        <t-card class="toolbar">
            <div class="toolbar-left">
                <h2 style="margin: 0">系统配置</h2>
                <t-tag v-if="已修改" theme="warning" variant="light-outline" size="small">{{ 未保存项数 }} 项待保存</t-tag>
            </div>
            <div class="toolbar-right">
                <t-button theme="default" variant="outline" @click="重置为默认">恢复默认</t-button>
                <t-button theme="default" variant="outline" @click="文件输入?.click()">导入 JSON</t-button>
                <t-button theme="primary" variant="base" @click="导出JSON">导出 JSON</t-button>
                <t-button theme="primary" :disabled="!已修改" @click="保存到本地">保存配置</t-button>
                <input ref="文件输入" type="file" accept=".json" hidden @change="导入JSON" />
            </div>
        </t-card>

        <!-- 配置分组卡片 -->
        <div class="groups">
            <t-card v-for="(分组, gi) in 分组列表" :key="gi" :header-bordered="true" hover-shadow>
                <template #header>
                    <div class="group-header">
                        <div class="group-title">
                            <span class="group-icon">{{ 分组.图标 }}</span>
                            <span>{{ 分组.标题 }}</span>
                        </div>
                        <span class="group-desc">{{ 分组.说明 }}</span>
                    </div>
                </template>

                <t-form :data="表单数据" label-width="140px" colon>
                    <t-row :gutter="[16, 12]">
                        <t-col v-for="字段 in 分组.字段" :key="字段.key" :xs="24" :sm="12" :md="8" :lg="6">
                            <t-form-item
                                :label="字段.label"
                                :help="字段.提示"
                                :status="错误映射[字段.key] ? 'error' : 'default'"
                            >
                                <!-- 文本 / 密码 -->
                                <t-input
                                    v-if="字段.type === '文本' || 字段.type === '密码'"
                                    v-model="表单数据[字段.key]"
                                    :type="字段.type === '密码' ? 'password' : 'text'"
                                    :placeholder="字段.占位"
                                    clearable
                                    @blur="校验单个字段(字段.key)"
                                />
                                <!-- 数字 -->
                                <t-input-number
                                    v-else-if="字段.type === '数字'"
                                    v-model="表单数据[字段.key]"
                                    :theme="错误映射[字段.key] ? 'error' : 'default'"
                                    style="width: 100%"
                                >
                                    <template v-if="字段单位" #suffix><span class="unit">{{ 字段单位.replace(/[()]/g, "") }}</span></template>
                                </t-input-number>
                                <!-- 下拉选择 -->
                                <t-select
                                    v-else-if="字段.type === '下拉'"
                                    v-model="表单数据[字段.key]"
                                    :options="字段.选项"
                                    filterable
                                    style="width: 100%"
                                />
                                <!-- 开关 -->
                                <t-switch
                                    v-else-if="字段.type === '开关'"
                                    v-model="表单数据[字段.key]"
                                    :labels="['开启', '关闭']"
                                />
                                <!-- 多行文本 -->
                                <t-textarea
                                    v-else-if="字段.type === '多行'"
                                    v-model="表单数据[字段.key]"
                                    :placeholder="字段.占位"
                                    autosize
                                />

                                <template v-if="错误映射[字段.key]" #tips>
                                    <span class="err-text">{{ 错误映射[字段.key] }}</span>
                                </template>
                            </t-form-item>
                        </t-col>
                    </t-row>
                </t-form>
            </t-card>
        </div>

        <!-- JSON 预览面板 -->
        <t-card header-bordered hover-shadow>
            <template #header>
                <div class="group-header">
                    <span>结构化 JSON 输出</span>
                    <t-button size="small" theme="default" variant="text" @click="复制JSON">复制</t-button>
                </div>
            </template>
            <pre class="json-preview"><code>{{ JSON预览 }}</code></pre>
        </t-card>
    </div>
</template>

<style scoped>
.settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
}
.toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
}
.toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.groups {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}
@media (min-width: 1200px) {
    .groups {
        grid-template-columns: repeat(2, 1fr);
    }
}

.group-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
}
.group-title {
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}
.group-icon {
    font-size: 18px;
}
.group-desc {
    color: #888;
    font-size: 13px;
}

.unit {
    color: #999;
    font-size: 13px;
    margin-left: 2px;
}
.err-text {
    color: var(--td-error-color, #e34d59);
    font-size: 12px;
}

.json-preview {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 14px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 12.5px;
    line-height: 1.55;
    max-height: 320px;
    overflow-y: auto;
    margin: 0;
}
.json-preview code {
    font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
}
</style>
