<template>
  <div class="monitor-settings">
    <!-- 顶部工具栏 -->
    <el-card shadow="hover" class="toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <h2 class="title">系统配置</h2>
          <el-tag v-if="已修改" type="warning" effect="plain" size="small">{{ 未保存项数 }} 项待保存</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button :icon="RefreshLeft" @click="重置为默认">恢复默认</el-button>
          <el-button :icon="Upload" @click="fileInput?.click()">导入 JSON</el-button>
          <el-button type="success" :icon="Download" plain @click="导出JSON">导出 JSON</el-button>
          <el-button type="primary" :icon="Check" :disabled="!已修改" @click="保存到本地">保存配置</el-button>
          <input ref="fileInput" type="file" accept=".json" hidden @change="导入JSON" />
        </div>
      </div>
    </el-card>

    <!-- 配置分组卡片 -->
    <el-row :gutter="16">
      <el-col v-for="(分组, gi) in 分组列表" :key="gi" :xs="24" :lg="12">
        <el-card shadow="hover" class="group-card">
          <template #header>
            <div class="group-header">
              <div class="group-title">
                <span class="group-icon">{{ 分组.图标 }}</span>
                <span>{{ 分组.标题 }}</span>
              </div>
              <span class="group-desc">{{ 分组.说明 }}</span>
            </div>
          </template>

          <el-form label-width="130px" label-position="right">
            <el-form-item
              v-for="字段 in 分组.字段"
              :key="字段.key"
              :label="字段.label"
              :error="错误映射[字段.key]"
            >
              <!-- 文本 / 密码 -->
              <el-input
                v-if="字段.type === '文本' || 字段.type === '密码'"
                v-model="表单数据[字段.key]"
                :type="字段.type === '密码' ? 'password' : 'text'"
                :placeholder="字段.占位"
                show-password
                clearable
                @blur="校验单个字段(字段.key)"
              />
              <!-- 数字 -->
              <el-input-number
                v-else-if="字段.type === '数字'"
                v-model="表单数据[字段.key]"
                controls-position="right"
                style="width: 100%"
                @blur="校验单个字段(字段.key)"
              />
              <!-- 下拉选择 -->
              <el-select
                v-else-if="字段.type === '下拉'"
                v-model="表单数据[字段.key]"
                :placeholder="`请选择${字段.label}`"
                style="width: 100%"
              >
                <el-option
                  v-for="opt in 字段.选项"
                  :key="String(opt.value)"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <!-- 开关 -->
              <el-switch
                v-else-if="字段.type === '开关'"
                v-model="表单数据[字段.key]"
                inline-prompt
                active-text="开"
                inactive-text="关"
              />
              <!-- 多行文本 -->
              <el-input
                v-else-if="字段.type === '多行'"
                v-model="表单数据[字段.key]"
                type="textarea"
                :placeholder="字段.占位"
                :autosize="{ minRows: 3 }"
              />
              <div v-if="字段.提示" class="field-tip">{{ 字段.提示 }}</div>
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
          <el-button size="small" text :icon="CopyDocument" @click="复制JSON">复制</el-button>
        </div>
      </template>
      <pre class="json-preview"><code>{{ JSON预览 }}</code></pre>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="monitorSettings">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Check, CopyDocument, Download, RefreshLeft, Upload } from "@element-plus/icons-vue";

/* ── 配置 Schema（动态表单定义）── */
type 输入类型 = "文本" | "数字" | "密码" | "下拉" | "开关" | "多行";

interface 表单项 {
  key: string;
  label: string;
  type: 输入类型;
  提示?: string;
  占位?: string;
  默认值?: unknown;
  选项?: { label: string; value: string | number | boolean }[];
  校验规则?(v: unknown): string | null;
}

interface 配置分组 {
  标题: string;
  图标: string;
  说明: string;
  字段: 表单项[];
}

const 分组列表: 配置分组[] = [
  {
    标题: "采集调度",
    图标: "⏱",
    说明: "控制定时采集的频率和数据量",
    字段: [
      {
        key: "采集间隔分钟",
        label: "采集间隔",
        type: "数字",
        提示: "两次自动采集之间的时间间隔",
        默认值: 30,
        校验规则(v) {
          const n = Number(v);
          if (n < 5) return "最小 5 分钟";
          if (n > 1440) return "最大 1440 分钟（24 小时）";
          return "";
        }
      },
      {
        key: "单视频评论上限",
        label: "评论采集上限",
        type: "数字",
        提示: "每个视频最多采集的评论数量",
        默认值: 500,
        校验规则(v) {
          const n = Number(v);
          if (n < 10) return "最少 10 条";
          if (n > 2000) return "最多 2000 条";
          return "";
        }
      },
      {
        key: "分析批量大小",
        label: "LLM 分析批次",
        type: "数字",
        提示: "每次发送给 LLM 分析的条目数",
        默认值: 20,
        校验规则(v) {
          const n = Number(v);
          if (n < 1 || n > 50) return "范围 1 ~ 50";
          return "";
        }
      }
    ]
  },
  {
    标题: "LLM 模型配置",
    图标: "🤖",
    说明: "情感分析使用的 LLM 服务设置",
    字段: [
      {
        key: "LLM提供商",
        label: "默认提供商",
        type: "下拉",
        提示: "选择主要使用的 LLM 服务商",
        选项: [
          { label: "DeepSeek", value: "deepseek" },
          { label: "Gemini", value: "gemini" }
        ],
        默认值: "deepseek"
      },
      { key: "DeepSeek密钥", label: "DeepSeek Key", type: "密码", 提示: "sk- 开头，留空使用环境变量", 占位: "sk-xxxxxxxx", 默认值: "" },
      { key: "DeepSeek模型", label: "DeepSeek 模型", type: "文本", 占位: "deepseek-chat", 默认值: "deepseek-chat" },
      { key: "DeepSeek地址", label: "DeepSeek 端点", type: "文本", 提示: "支持自定义中转", 占位: "https://api.deepseek.com/v1", 默认值: "" },
      { key: "Gemini密钥", label: "Gemini Key", type: "密码", 提示: "留空使用环境变量", 占位: "AIzaSy...", 默认值: "" },
      { key: "Gemini模型", label: "Gemini 模型", type: "文本", 占位: "gemini-2.5-flash", 默认值: "gemini-2.5-flash" },
      {
        key: "LLMTemperature",
        label: "Temperature",
        type: "数字",
        提示: "低=稳定，高=创意，情感分析建议低值",
        默认值: 0.2,
        校验规则(v) {
          const n = Number(v);
          if (n < 0 || n > 1) return "范围 0 ~ 1";
          return "";
        }
      }
    ]
  },
  {
    标题: "B站服务",
    图标: "📺",
    说明: "B站 API 连接与凭证管理",
    字段: [
      {
        key: "端口",
        label: "服务端口号",
        type: "数字",
        提示: "后端 HTTP 服务监听端口",
        默认值: 5160,
        校验规则(v) {
          const n = Number(v);
          if (n < 1024 || n > 65535) return "范围 1024 ~ 65535";
          return "";
        }
      },
      { key: "数据库路径", label: "数据库路径", type: "文本", 占位: "./data/monitor.db", 默认值: "./data/monitor.db" },
      { key: "凭证路径", label: "B站凭证文件", type: "文本", 占位: "./data/bili-凭证.json", 默认值: "./data/bili-凭证.json" }
    ]
  },
  {
    标题: "界面与导出",
    图标: "⚙️",
    说明: "前端展示偏好和数据导出设置",
    字段: [
      {
        key: "自动刷新秒数",
        label: "自动刷新周期",
        type: "数字",
        提示: "概览页自动刷新间隔（0 表示手动刷新）",
        默认值: 0,
        校验规则(v) {
          const n = Number(v);
          if (n < 0 || n > 3600) return "范围 0 ~ 3600 秒";
          return "";
        }
      },
      { key: "深色模式", label: "深色模式", type: "开关", 提示: "切换界面主题（需刷新生效）", 默认值: false },
      {
        key: "表格行数",
        label: "默认分页大小",
        type: "下拉",
        提示: "各列表页每页显示条数",
        选项: [10, 20, 50, 100].map(v => ({ label: `${v} 条`, value: v })),
        默认值: 20
      }
    ]
  }
];

/* ── 状态管理 ── */
const 存储键 = "bili-monitor-config";

function 构造默认值(): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const g of 分组列表) for (const f of g.字段) d[f.key] = f.默认值 ?? "";
  return d;
}

function 从本地加载(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(存储键);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return { ...构造默认值(), ...parsed };
    }
  } catch {
    /* ignore */
  }
  return 构造默认值();
}

const 表单数据 = reactive<Record<string, any>>(从本地加载());
const 错误映射 = ref<Record<string, string>>({});
const 已修改 = ref(false);
const fileInput = ref<HTMLInputElement>();

/* ── 校验 ── */
function 查找字段(key: string): 表单项 | undefined {
  for (const g of 分组列表) for (const f of g.字段) if (f.key === key) return f;
  return undefined;
}

function 校验字段(item: 表单项): string {
  const v = 表单数据[item.key];
  if (item.校验规则) return item.校验规则(v) ?? "";
  return "";
}

function 校验单个字段(key: string) {
  const item = 查找字段(key);
  if (!item) return;
  const err = 校验字段(item);
  if (err) 错误映射.value[key] = err;
  else delete 错误映射.value[key];
}

function 全局校验(): boolean {
  错误映射.value = {};
  for (const g of 分组列表) {
    for (const f of g.字段) {
      const err = 校验字段(f);
      if (err) 错误映射.value[f.key] = err;
    }
  }
  return Object.keys(错误映射.value).length === 0;
}

/* ── 监听变化 ── */
watch(
  () => ({ ...表单数据 }),
  () => {
    已修改.value = true;
  },
  { deep: true }
);

/* ── 持久化 ── */
function 保存到本地() {
  if (!全局校验()) {
    ElMessage.warning("请修正表单中的错误");
    return;
  }
  try {
    localStorage.setItem(存储键, JSON.stringify(表单数据));
    已修改.value = false;
    ElMessage.success("配置已保存到浏览器本地");
  } catch (e) {
    ElMessage.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
  }
}

function 重置为默认() {
  Object.assign(表单数据, 构造默认值());
  错误映射.value = {};
  已修改.value = true;
  ElMessage.info("已恢复默认值（未保存）");
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
  ElMessage.success("配置 JSON 已下载");
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
        ElMessage.success(`已导入 ${Object.keys(obj).length} 个配置项`);
      }
    } catch {
      ElMessage.error("文件解析失败，请检查 JSON 格式");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

async function 复制JSON() {
  try {
    await navigator.clipboard.writeText(JSON预览.value);
    ElMessage.success("已复制到剪贴板");
  } catch {
    ElMessage.error("复制失败，请手动选择复制");
  }
}

/* ── 计算属性 ── */
const JSON预览 = computed(() => {
  try {
    return JSON.stringify(表单数据, null, 4);
  } catch {
    return "{}";
  }
});

const 未保存项数 = computed(() => {
  let count = 0;
  for (const g of 分组列表) {
    for (const f of g.字段) {
      if (String(表单数据[f.key]) !== String(f.默认值 ?? "")) count++;
    }
  }
  return count;
});
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
