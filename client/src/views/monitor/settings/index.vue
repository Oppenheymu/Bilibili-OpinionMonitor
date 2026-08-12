<template>
  <div class="monitor-settings">
    <!-- 顶部工具栏 -->
    <el-card shadow="hover" class="toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <h2 class="title">系统配置</h2>
          <el-tag v-if="modified" type="warning" effect="plain" size="small">{{ pendingCount }} 项待保存</el-tag>
          <el-tag v-if="loading" type="info" effect="plain" size="small">加载中…</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button :icon="RefreshLeft" @click="resetToDefault">恢复默认</el-button>
          <el-button :icon="Upload" @click="fileInput?.click()">导入 JSON</el-button>
          <el-button type="success" :icon="Download" plain @click="exportJSON">导出 JSON</el-button>
          <el-button type="primary" :icon="Check" :loading="saving" :disabled="!modified" @click="saveToServer">保存配置</el-button>
          <input ref="fileInput" type="file" accept=".json" hidden @change="importJSON" />
        </div>
      </div>
    </el-card>

    <!-- 配置分组卡片 -->
    <el-row :gutter="16">
      <el-col v-for="(group, gi) in configGroups" :key="gi" :xs="24" :lg="12">
        <el-card shadow="hover" class="group-card">
          <template #header>
            <div class="group-header">
              <div class="group-title">
                <span class="group-icon">{{ group.icon }}</span>
                <span>{{ group.title }}</span>
              </div>
              <span class="group-desc">{{ group.desc }}</span>
            </div>
          </template>

          <el-form label-width="130px" label-position="right">
            <el-form-item
              v-for="field in group.fields"
              :key="field.key"
              :label="field.label"
              :error="errorMap[field.key]"
            >
              <!-- 文本 -->
              <el-input
                v-if="field.type === '文本'"
                v-model="formData[field.key]"
                :placeholder="field.placeholder"
                clearable
                @blur="validateSingleField(field.key)"
              />
              <!-- 数字 -->
              <el-input-number
                v-else-if="field.type === '数字'"
                v-model="formData[field.key]"
                controls-position="right"
                style="width: 100%"
                @blur="validateSingleField(field.key)"
              />
              <!-- 下拉选择 -->
              <el-select
                v-else-if="field.type === '下拉'"
                v-model="formData[field.key]"
                :placeholder="`请选择${field.label}`"
                style="width: 100%"
              >
                <el-option
                  v-for="opt in field.options"
                  :key="String(opt.value)"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <!-- 开关 -->
              <el-switch
                v-else-if="field.type === '开关'"
                v-model="formData[field.key]"
                inline-prompt
                active-text="开"
                inactive-text="关"
              />
              <!-- 多行文本 -->
              <el-input
                v-else-if="field.type === '多行'"
                v-model="formData[field.key]"
                type="textarea"
                :placeholder="field.placeholder"
                :autosize="{ minRows: 3 }"
              />
              <!-- 密码（密钥/令牌） -->
              <el-input
                v-else-if="field.type === '密码'"
                v-model="formData[field.key]"
                type="password"
                show-password
                :placeholder="secretStatus[field.key] ? '(已配置，留空保持不变)' : (field.placeholder ?? '')"
                clearable
              />
              <div v-if="field.hint" class="field-tip">{{ field.hint }}</div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- JSON 预览面板 -->
    <el-card shadow="hover" class="json-card">
      <template #header>
        <div class="group-header">
          <span class="group-title">结构化 JSON 输出</span>
          <el-button size="small" text :icon="CopyDocument" @click="copyJSON">复制</el-button>
        </div>
      </template>
      <pre class="json-preview"><code>{{ jsonPreview }}</code></pre>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="monitorSettings">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Check, CopyDocument, Download, RefreshLeft, Upload } from "@element-plus/icons-vue";
import { getConfigApi, saveConfigApi } from "@/api/modules/monitor";
import { useTheme } from "@/hooks/useTheme";
import { useGlobalStore } from "@/stores/modules/global";

const { switchDark } = useTheme();
const globalStore = useGlobalStore();

/* ── 配置 Schema（动态表单定义）── */
type InputFieldType = "文本" | "数字" | "下拉" | "开关" | "多行" | "密码";

interface FormField {
    key: string;
    label: string;
    type: InputFieldType;
    hint?: string;
    placeholder?: string;
    defaultValue?: unknown;
    options?: { label: string; value: string | number | boolean }[];
    validator?(v: unknown): string | null;
}

interface ConfigGroup {
    title: string;
    icon: string;
    desc: string;
    fields: FormField[];
}

const configGroups: ConfigGroup[] = [
    {
        title: "采集调度",
        icon: "⏱",
        desc: "控制定时采集的频率和数据量",
        fields: [
            {
                key: "采集间隔分钟",
                label: "采集间隔",
                type: "数字",
                hint: "两次自动采集之间的时间间隔",
                defaultValue: 30,
                validator(v) {
                    const n = Number(v);
                    if (n < 5) return "最小 5 分钟";
                    if (n > 1440) return "最大 1440 分钟（24 小时）";
                    return "";
                },
            },
            {
                key: "单视频评论上限",
                label: "评论采集上限",
                type: "数字",
                hint: "每个视频最多采集的评论数量",
                defaultValue: 500,
                validator(v) {
                    const n = Number(v);
                    if (n < 10) return "最少 10 条";
                    if (n > 2000) return "最多 2000 条";
                    return "";
                },
            },
            {
                key: "视频采集页数",
                label: "视频采集页数",
                type: "数字",
                hint: "每页 30 条，控制每次抓取页数",
                defaultValue: 3,
                validator(v) {
                    const n = Number(v);
                    if (n < 1 || n > 20) return "范围 1 ~ 20 页";
                    return "";
                },
            },
            {
                key: "动态采集页数",
                label: "动态采集页数",
                type: "数字",
                hint: "控制每次抓取 UP 主动态的页数",
                defaultValue: 5,
                validator(v) {
                    const n = Number(v);
                    if (n < 1 || n > 20) return "范围 1 ~ 20 页";
                    return "";
                },
            },
            {
                key: "分析批量大小",
                label: "分析批量",
                type: "数字",
                hint: "每次发送给 LLM 分析的评论条数",
                defaultValue: 20,
                validator(v) {
                    const n = Number(v);
                    if (n < 1 || n > 50) return "范围 1 ~ 50";
                    return "";
                },
            },
            {
                key: "分析预算",
                label: "分析预算上限",
                type: "数字",
                hint: "每轮分析的 LLM 调用次数上限（0=不限）。现象级舆情评论暴增时防止费用爆炸，超出部分留待下轮按热度优先分析",
                defaultValue: 500,
                validator(v) {
                    const n = Number(v);
                    if (n < 0) return "不能为负数";
                    if (n > 100000) return "最大 100000";
                    return "";
                },
            },
            {
                key: "请求间隔毫秒",
                label: "B站请求间隔",
                type: "数字",
                hint: "采集请求之间的最小间隔（毫秒），自动附加随机抖动。间隔太短易触发 B站风控导致数据被截断，建议 ≥800",
                defaultValue: 1200,
                validator(v) {
                    const n = Number(v);
                    if (n < 300) return "最小 300ms（再短会触发风控）";
                    if (n > 30000) return "最大 30000ms";
                    return "";
                },
            },
            {
                key: "最大重试次数",
                label: "失败重试次数",
                type: "数字",
                hint: "接口失败时的指数退避重试次数（1s→2s→4s…上限 30s）。风控信号会自动触发 5 分钟降速模式",
                defaultValue: 3,
                validator(v) {
                    const n = Number(v);
                    if (n < 0 || n > 10) return "范围 0 ~ 10";
                    return "";
                },
            },
        ],
    },
    {
        title: "界面与导出",
        icon: "⚙️",
        desc: "前端展示偏好和数据导出设置",
        fields: [
            {
                key: "自动刷新秒数",
                label: "自动刷新周期",
                type: "数字",
                hint: "概览页自动刷新间隔（0 表示手动刷新）",
                defaultValue: 0,
                validator(v) {
                    const n = Number(v);
                    if (n < 0 || n > 3600) return "范围 0 ~ 3600 秒";
                    return "";
                },
            },
            {
                key: "深色模式",
                label: "深色模式",
                type: "开关",
                hint: "切换界面主题（保存后立即生效，下次打开页面同样生效）",
                defaultValue: false,
            },
            {
                key: "表格行数",
                label: "默认分页大小",
                type: "下拉",
                hint: "各列表页每页显示条数",
                options: [10, 20, 50, 100].map((v) => ({ label: `${v} 条`, value: v })),
                defaultValue: 20,
            },
        ],
    },
    {
        title: "安全",
        icon: "🔐",
        desc: "接口访问保护（设置后需重新登录页面生效）",
        fields: [
            {
                key: "访问令牌",
                label: "访问令牌",
                type: "密码",
                hint: "设置后所有 API 请求需携带该令牌（留空表示不启用认证）。令牌加密存储、仅显示是否已配置；若遗忘令牌，将本项留空保存即可停用认证，再重新设置新令牌",
                placeholder: "留空 = 不启用认证",
                validator(v) {
                    const s = String(v ?? "");
                    if (s && s.length < 8) return "令牌至少 8 位";
                    return "";
                },
            },
        ],
    },
];

/* ── 状态管理 ── */
function buildDefaultValues(): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    for (const g of configGroups) for (const f of g.fields) d[f.key] = f.defaultValue ?? "";
    return d;
}

const formData = reactive<Record<string, any>>(buildDefaultValues());
const errorMap = ref<Record<string, string>>({});
const modified = ref(false);
const fileInput = ref<HTMLInputElement>();
const saving = ref(false);
const loading = ref(false);
/** 密码/密钥字段的"是否已配置"状态（服务端只返回标记不返回明文） */
const secretStatus = ref<Record<string, boolean>>({});

/** 从服务端加载配置 */
async function loadConfig() {
    loading.value = true;
    try {
        const cfg = (await getConfigApi()) as Record<string, unknown>;
        for (const g of configGroups) {
            for (const f of g.fields) {
                const v = cfg[f.key];
                const defaultValue = f.defaultValue ?? (f.type === "数字" ? 0 : "");
                if (f.type === "密码") {
                    // 密码字段：服务端仅返回"已配置"标记，不填充明文；留空表单框
                    secretStatus.value[f.key] = Boolean(v) && v !== "";
                    formData[f.key] = "";
                    continue;
                }
                const rawValue = v === undefined || v === null || v === "" ? defaultValue : v;
                if (f.type === "数字") {
                    formData[f.key] = Number(rawValue);
                } else if (f.type === "开关") {
                    formData[f.key] = rawValue === true || rawValue === "true" || rawValue === "1";
                } else {
                    formData[f.key] = rawValue;
                }
            }
        }
        modified.value = false;
    } catch (e) {
        ElMessage.error("加载配置失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
        loading.value = false;
        // 等 watch 队列 flush 后再重置，避免"加载即显示待保存"的误报
        await nextTick();
        modified.value = false;
    }
}

onMounted(loadConfig);

/* ── 校验 ── */
function findField(key: string): FormField | undefined {
    for (const g of configGroups) for (const f of g.fields) if (f.key === key) return f;
    return undefined;
}

function validateField(item: FormField): string {
    const v = formData[item.key];
    if (item.validator) return item.validator(v) ?? "";
    return "";
}

function validateSingleField(key: string) {
    const item = findField(key);
    if (!item) return;
    const err = validateField(item);
    if (err) errorMap.value[key] = err;
    else delete errorMap.value[key];
}

function validateAll(): boolean {
    errorMap.value = {};
    for (const g of configGroups) {
        for (const f of g.fields) {
            const err = validateField(f);
            if (err) errorMap.value[f.key] = err;
        }
    }
    return Object.keys(errorMap.value).length === 0;
}

/* ── 监听变化 ── */
watch(
    () => ({ ...formData }),
    () => {
        modified.value = true;
    },
    { deep: true },
);

/* ── 持久化（写入服务端数据库，密钥加密存储）── */
async function saveToServer() {
    if (!validateAll()) {
        ElMessage.warning("请修正表单中的错误");
        return;
    }
    saving.value = true;
    try {
        const payload: Record<string, string> = {};
        for (const g of configGroups) {
            for (const f of g.fields) {
                payload[f.key] = String(formData[f.key] ?? "");
            }
        }
        await saveConfigApi(payload);
    // 访问令牌保存后同步到本地，供 axios 拦截器携带
    if ("访问令牌" in payload) {
        const token = payload["访问令牌"];
        if (token) localStorage.setItem("访问令牌", token);
        // 前端未保存新令牌时，若服务端未配置则清除本地残留
        if (!token && !secretStatus.value["访问令牌"]) localStorage.removeItem("访问令牌");
    }
    // 深色模式保存后立即生效，无需刷新（刷新后由 App.vue 从服务端配置恢复）
    if ("深色模式" in payload) {
        const darkMode = payload["深色模式"] === "true";
        if (darkMode !== globalStore.isDark) {
            globalStore.setGlobalState("isDark", darkMode);
            switchDark();
        }
    }
    modified.value = false;
    ElMessage.success("配置已保存到服务端");
    } catch (e) {
        ElMessage.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
        saving.value = false;
    }
}

function resetToDefault() {
    Object.assign(formData, buildDefaultValues());
    errorMap.value = {};
    modified.value = true;
    ElMessage.info("已恢复默认值（未保存）");
}

function exportJSON() {
    const safeCopy: Record<string, unknown> = {};
    for (const g of configGroups)
        for (const f of g.fields) {
            safeCopy[f.key] = formData[f.key];
        }
    const data = JSON.stringify({ 导出时间: new Date().toISOString(), ...safeCopy }, null, 4);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bili-monitor-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success("配置 JSON 已下载（密钥已脱敏）");
}

function importJSON(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const obj = JSON.parse(reader.result as string) as Record<string, unknown>;
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
                ElMessage.error("JSON 格式不正确：应为配置对象");
                return;
            }
            delete obj["导出时间"];
            // 按字段 schema 归一化类型并过滤未知键/密钥字段，防止导入非法值破坏表单或绕过校验
            const temp = buildDefaultValues();
            let importedCount = 0;
            for (const g of configGroups) {
                for (const f of g.fields) {
                    if (!(f.key in obj)) continue;
                    const value = obj[f.key];
                    if (f.type === "数字") {
                        const n = Number(value);
                        if (Number.isNaN(n)) {
                            ElMessage.error(`字段「${f.label}」不是有效数字`);
                            return;
                        }
                        temp[f.key] = n;
                    } else if (f.type === "开关") {
                        temp[f.key] = value === true || value === "true" || value === "1";
                    } else if (f.type === "密码") {
                        // 密钥字段导出时已脱敏，不导入明文
                        continue;
                    } else {
                        temp[f.key] = String(value);
                    }
                    importedCount++;
                }
            }
            // 校验导入值是否满足字段规则，不通过则整体拒绝导入
            const errors: string[] = [];
            for (const g of configGroups) {
                for (const f of g.fields) {
                    if (!(f.key in obj)) continue;
                    const err = f.validator ? f.validator(temp[f.key]) : "";
                    if (err) errors.push(`${f.label}：${err}`);
                }
            }
            if (errors.length > 0) {
                ElMessage.error(`导入内容校验失败：\n${errors.join("\n")}`);
                return;
            }
            Object.assign(formData, temp);
            errorMap.value = {};
            modified.value = true;
            ElMessage.success(`已导入 ${importedCount} 个配置项`);
        } catch (e) {
            ElMessage.error(
                e instanceof Error ? `导入失败：${e.message}` : "文件解析失败，请检查 JSON 格式",
            );
        }
    };
    reader.readAsText(file);
    input.value = "";
}

async function copyJSON() {
    try {
        await navigator.clipboard.writeText(jsonPreview.value);
        ElMessage.success("已复制到剪贴板");
    } catch {
        ElMessage.error("复制失败，请手动选择复制");
    }
}

/* ── 计算属性 ── */
const jsonPreview = computed(() => {
    // 预览时密钥字段脱敏，避免明文暴露
    const safeCopy: Record<string, unknown> = {};
    for (const g of configGroups)
        for (const f of g.fields) {
            if (f.type === "密码") {
                safeCopy[f.key] = formData[f.key]
                    ? "(已输入，保存后加密)"
                    : secretStatus.value[f.key]
                      ? "(已配置)"
                      : "";
            } else {
                safeCopy[f.key] = formData[f.key];
            }
        }
    return JSON.stringify(safeCopy, null, 4);
});

const pendingCount = computed(() => {
    let count = 0;
    for (const g of configGroups) {
        for (const f of g.fields) {
            if (f.type === "密码") {
                // 密钥字段：用户填了新值才算待保存
                if (formData[f.key]) count++;
            } else if (String(formData[f.key]) !== String(f.defaultValue ?? "")) {
                count++;
            }
        }
    }
    return count;
});
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
