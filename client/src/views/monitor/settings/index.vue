<template>
  <div class="monitor-settings">
    <!-- 顶部工具栏 -->
    <el-card shadow="hover" class="toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <h2 class="title">系统配置</h2>
          <el-tag v-if="已修改" type="warning" effect="plain" size="small">{{ 未保存项数 }} 项待保存</el-tag>
          <el-tag v-if="加载中" type="info" effect="plain" size="small">加载中…</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button :icon="RefreshLeft" @click="重置为默认">恢复默认</el-button>
          <el-button :icon="Upload" @click="fileInput?.click()">导入 JSON</el-button>
          <el-button type="success" :icon="Download" plain @click="导出JSON">导出 JSON</el-button>
          <el-button type="primary" :icon="Check" :loading="保存中" :disabled="!已修改" @click="保存到服务端">保存配置</el-button>
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
              <!-- 文本 -->
              <el-input
                v-if="字段.type === '文本'"
                v-model="表单数据[字段.key]"
                :placeholder="字段.占位"
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
              <!-- 密码（密钥/令牌） -->
              <el-input
                v-else-if="字段.type === '密码'"
                v-model="表单数据[字段.key]"
                type="password"
                show-password
                :placeholder="密钥状态[字段.key] ? '(已配置，留空保持不变)' : (字段.占位 ?? '')"
                clearable
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
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Check, CopyDocument, Download, RefreshLeft, Upload } from "@element-plus/icons-vue";
import { getConfigApi, saveConfigApi } from "@/api/modules/monitor";

/* ── 配置 Schema（动态表单定义）── */
type 输入类型 = "文本" | "数字" | "下拉" | "开关" | "多行" | "密码";

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
        key: "视频采集页数",
        label: "视频采集页数",
        type: "数字",
        提示: "每页 30 条，控制每次抓取页数",
        默认值: 3,
        校验规则(v) {
          const n = Number(v);
          if (n < 1 || n > 20) return "范围 1 ~ 20 页";
          return "";
        }
      },
      {
        key: "动态采集页数",
        label: "动态采集页数",
        type: "数字",
        提示: "控制每次抓取 UP 主动态的页数",
        默认值: 5,
        校验规则(v) {
          const n = Number(v);
          if (n < 1 || n > 20) return "范围 1 ~ 20 页";
          return "";
        }
      },
      {
        key: "分析批量大小",
        label: "分析批量",
        type: "数字",
        提示: "每次发送给 LLM 分析的评论条数",
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
  },
  {
    标题: "安全",
    图标: "🔐",
    说明: "接口访问保护（设置后需重新登录页面生效）",
    字段: [
      {
        key: "访问令牌",
        label: "访问令牌",
        type: "密码",
        提示: "设置后所有 API 请求需携带该令牌（留空表示不启用认证）。令牌以加密形式存储，仅显示是否已配置",
        占位: "留空 = 不启用认证",
        校验规则(v) {
          const s = String(v ?? "");
          if (s && s.length < 8) return "令牌至少 8 位";
          return "";
        }
      }
    ]
  }
];

/* ── 状态管理 ── */
function 构造默认值(): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const g of 分组列表) for (const f of g.字段) d[f.key] = f.默认值 ?? "";
  return d;
}

const 表单数据 = reactive<Record<string, any>>(构造默认值());
const 错误映射 = ref<Record<string, string>>({});
const 已修改 = ref(false);
const fileInput = ref<HTMLInputElement>();
const 保存中 = ref(false);
const 加载中 = ref(false);
/** 密码/密钥字段的"是否已配置"状态（服务端只返回标记不返回明文） */
const 密钥状态 = ref<Record<string, boolean>>({});

/** 从服务端加载配置 */
async function 加载配置() {
  加载中.value = true;
  try {
    const cfg = (await getConfigApi()) as Record<string, unknown>;
    for (const g of 分组列表) {
      for (const f of g.字段) {
        const v = cfg[f.key];
        const 默认 = f.默认值 ?? (f.type === "数字" ? 0 : "");
        if (f.type === "密码") {
          // 密码字段：服务端仅返回"已配置"标记，不填充明文；留空表单框
          密钥状态.value[f.key] = Boolean(v) && v !== "";
          表单数据[f.key] = "";
          continue;
        }
        const 原始值 = v === undefined || v === null || v === "" ? 默认 : v;
        if (f.type === "数字") {
          表单数据[f.key] = Number(原始值);
        } else if (f.type === "开关") {
          表单数据[f.key] = 原始值 === true || 原始值 === "true" || 原始值 === "1";
        } else {
          表单数据[f.key] = 原始值;
        }
      }
    }
    已修改.value = false;
  } catch (e) {
    ElMessage.error("加载配置失败：" + (e instanceof Error ? e.message : "未知错误"));
  } finally {
    加载中.value = false;
    // 等 watch 队列 flush 后再重置，避免"加载即显示待保存"的误报
    await nextTick();
    已修改.value = false;
  }
}

onMounted(加载配置);

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

/* ── 持久化（写入服务端数据库，密钥加密存储）── */
async function 保存到服务端() {
  if (!全局校验()) {
    ElMessage.warning("请修正表单中的错误");
    return;
  }
  保存中.value = true;
  try {
    const payload: Record<string, string> = {};
    for (const g of 分组列表) {
      for (const f of g.字段) {
        payload[f.key] = String(表单数据[f.key] ?? "");
      }
    }
    await saveConfigApi(payload);
    // 访问令牌保存后同步到本地，供 axios 拦截器携带
    if ("访问令牌" in payload) {
      const 令牌 = payload["访问令牌"];
      if (令牌) localStorage.setItem("访问令牌", 令牌);
      // 前端未保存新令牌时，若服务端未配置则清除本地残留
      if (!令牌 && !密钥状态.value["访问令牌"]) localStorage.removeItem("访问令牌");
    }
    已修改.value = false;
    ElMessage.success("配置已保存到服务端");
  } catch (e) {
    ElMessage.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
  } finally {
    保存中.value = false;
  }
}

function 重置为默认() {
  Object.assign(表单数据, 构造默认值());
  错误映射.value = {};
  已修改.value = true;
  ElMessage.info("已恢复默认值（未保存）");
}

function 导出JSON() {
  const 安全副本: Record<string, unknown> = {};
  for (const g of 分组列表) for (const f of g.字段) {
    安全副本[f.key] = 表单数据[f.key];
  }
  const data = JSON.stringify({ 导出时间: new Date().toISOString(), ...安全副本 }, null, 4);
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

function 导入JSON(e: Event) {
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
      const 临时 = 构造默认值();
      let 导入数 = 0;
      for (const g of 分组列表) {
        for (const f of g.字段) {
          if (!(f.key in obj)) continue;
          const 值 = obj[f.key];
          if (f.type === "数字") {
            const n = Number(值);
            if (Number.isNaN(n)) {
              ElMessage.error(`字段「${f.label}」不是有效数字`);
              return;
            }
            临时[f.key] = n;
          } else if (f.type === "开关") {
            临时[f.key] = 值 === true || 值 === "true" || 值 === "1";
          } else if (f.type === "密码") {
            // 密钥字段导出时已脱敏，不导入明文
            continue;
          } else {
            临时[f.key] = String(值);
          }
          导入数++;
        }
      }
      // 校验导入值是否满足字段规则，不通过则整体拒绝导入
      const 错误集: string[] = [];
      for (const g of 分组列表) {
        for (const f of g.字段) {
          if (!(f.key in obj)) continue;
          const err = f.校验规则 ? f.校验规则(临时[f.key]) : "";
          if (err) 错误集.push(`${f.label}：${err}`);
        }
      }
      if (错误集.length > 0) {
        ElMessage.error(`导入内容校验失败：\n${错误集.join("\n")}`);
        return;
      }
      Object.assign(表单数据, 临时);
      错误映射.value = {};
      已修改.value = true;
      ElMessage.success(`已导入 ${导入数} 个配置项`);
    } catch (e) {
      ElMessage.error(e instanceof Error ? `导入失败：${e.message}` : "文件解析失败，请检查 JSON 格式");
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
  // 预览时密钥字段脱敏，避免明文暴露
  const 安全副本: Record<string, unknown> = {};
  for (const g of 分组列表) for (const f of g.字段) {
    if (f.type === "密码") {
      安全副本[f.key] = 表单数据[f.key] ? "(已输入，保存后加密)" : (密钥状态.value[f.key] ? "(已配置)" : "");
    } else {
      安全副本[f.key] = 表单数据[f.key];
    }
  }
  return JSON.stringify(安全副本, null, 4);
});

const 未保存项数 = computed(() => {
  let count = 0;
  for (const g of 分组列表) {
    for (const f of g.字段) {
      if (f.type === "密码") {
        // 密钥字段：用户填了新值才算待保存
        if (表单数据[f.key]) count++;
      } else if (String(表单数据[f.key]) !== String(f.默认值 ?? "")) {
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
