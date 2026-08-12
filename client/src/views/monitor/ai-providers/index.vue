<template>
  <div class="ai-providers">
    <!-- 顶部工具栏 -->
    <el-card shadow="hover" class="toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <h2 class="title">AI 模型配置</h2>
          <el-tag size="small" type="info" effect="plain">支持任意 OpenAI 兼容接口</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" :icon="Plus" @click="openCreate">添加提供者</el-button>
        </div>
      </div>
    </el-card>

    <!-- 提供者卡片列表 -->
    <el-row :gutter="16">
      <el-col v-for="p in providerList" :key="p.id" :xs="24" :md="12" :lg="8">
        <el-card shadow="hover" class="provider-card" :class="{ disabled: !p.enabled }">
          <template #header>
            <div class="card-header">
              <div class="card-title">
                <span class="provider-icon">{{ providerIcon(p.providerKey) }}</span>
                <span class="provider-name">{{ p.name }}</span>
                <el-tag v-if="p.isDefault" type="success" size="small" effect="dark">默认</el-tag>
                <el-tag v-if="!p.enabled" type="danger" size="small">已禁用</el-tag>
              </div>
              <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, p)">
                <el-button text :icon="MoreFilled" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" :icon="Edit">编辑</el-dropdown-item>
                    <el-dropdown-item v-if="!p.isDefault" command="setDefault" :icon="Star">设为默认</el-dropdown-item>
                    <el-dropdown-item :command="p.enabled ? 'disable' : 'enable'" :icon="p.enabled ? VideoPause : VideoPlay">
                      {{ p.enabled ? '禁用' : '启用' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" :icon="Delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">模型</span>
              <span class="info-value">{{ p.model }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">端点</span>
              <span class="info-value mono">{{ p.apiBaseUrl || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Temperature</span>
              <span class="info-value">{{ (p.temperature / 100).toFixed(2) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">密钥</span>
              <span class="info-value" :class="{ muted: !p.apiKey }">{{ p.apiKey ? '已配置' : '未配置' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 空状态 -->
    <el-empty v-if="!providerList.length && !loading" description="还没有 AI 提供者，点击上方按钮添加一个">
      <el-button type="primary" :icon="Plus" @click="openCreate">添加提供者</el-button>
    </el-empty>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editMode ? '编辑提供者' : '添加 AI 提供者'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：我的DeepSeek、公司Claude" />
        </el-form-item>
        <el-form-item label="类型" prop="providerKey">
          <el-select v-model="form.providerKey" placeholder="选择或输入" filterable allow-create style="width:100%">
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Gemini" value="gemini" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="Claude" value="claude" />
            <el-option label="通义千问" value="qwen" />
            <el-option label="Moonshot" value="moonshot" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="API 地址" prop="apiBaseUrl">
          <el-input v-model="form.apiBaseUrl" placeholder="https://api.deepseek.com/v1" />
          <div class="form-tip">OpenAI 兼容的 base URL（不含 /chat/completions）</div>
        </el-form-item>
        <el-form-item label="模型" prop="model">
          <el-input v-model="form.model" placeholder="deepseek-chat / gpt-4o / gemini-2.5-flash" />
        </el-form-item>
        <el-form-item label="API 密钥" prop="apiKey">
          <el-input v-model="form.apiKey" type="password" show-password
            :placeholder="editMode ? '留空保留原值' : 'sk-... 或 AIza...'" />
        </el-form-item>
        <el-form-item label="系统提示词">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="5"
            placeholder="情感分析 system prompt（留空使用内置默认）
内置默认：你是舆情分析助手。对用户给出的B站评论或动态内容进行情感分析..."
          />
          <div class="form-tip">自定义后用于所有情感分析请求；留空则使用内置默认提示词</div>
        </el-form-item>
        <el-form-item label="Temperature">
          <el-slider v-model="form.temperature" :min="0" :max="100" :step="1" show-input style="width:100%" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.isDefault" />
          <div class="form-tip">只有一个默认提供者会被用于情感分析</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ editMode ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="monitorAIProviders">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import { Delete, Edit, MoreFilled, Plus, Star, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import {
  getAIProvidersApi, createAIProviderApi, updateAIProviderApi,
  deleteAIProviderApi, setDefaultAIProviderApi
} from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";

const providerList = ref<Monitor.AIProvider[]>([]);
const loading = ref(false);

const providerIcon = (key: string) => {
    const map: Record<string, string> = {
        deepseek: "🐋",
        gemini: "💎",
        openai: "🧠",
        claude: "🎵",
        qwen: "☁️",
        moonshot: "🌙",
        custom: "🔌",
    };
    return map[key] ?? "🤖";
};

const loadData = async () => {
    loading.value = true;
    try {
        providerList.value = await getAIProvidersApi();
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "加载失败");
    } finally {
        loading.value = false;
    }
};

// ===== 弹窗逻辑 =====
const dialogVisible = ref(false);
const editMode = ref(false);
const editId = ref<number | null>(null);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = () => ({
    name: "",
    providerKey: "deepseek",
    apiBaseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "",
    systemPrompt: "",
    temperature: 20,
    enabled: true,
    isDefault: false,
});

const form = reactive(defaultForm());

const formRules = {
    name: [{ required: true, message: "请输入名称", trigger: "blur" }],
    providerKey: [{ required: true, message: "请选择类型", trigger: "change" }],
    apiBaseUrl: [{ required: true, message: "请输入 API 地址", trigger: "blur" }],
    model: [{ required: true, message: "请输入模型名", trigger: "blur" }],
    apiKey: [
        {
            required: true,
            message: "请输入密钥",
            trigger: "blur",
            validator: (_r: unknown, _v: unknown, cb: any) => {
                if (editMode.value && !form.apiKey) return cb(); // 编辑模式留空不校验
                if (!form.apiKey) return cb(new Error("请输入密钥"));
                cb();
            },
        },
    ],
};

const openCreate = () => {
    editMode.value = false;
    editId.value = null;
    Object.assign(form, defaultForm());
    dialogVisible.value = true;
};

const openEdit = (p: Monitor.AIProvider) => {
    editMode.value = true;
    editId.value = p.id;
    form.name = p.name;
    form.providerKey = p.providerKey;
    form.apiBaseUrl = p.apiBaseUrl;
    form.model = p.model;
    form.apiKey = "";
    form.systemPrompt = p.systemPrompt ?? "";
    form.temperature = p.temperature;
    form.enabled = p.enabled;
    form.isDefault = p.isDefault;
    dialogVisible.value = true;
};

const submit = async () => {
    if (!formRef.value) return;
    await formRef.value.validate(async (valid) => {
        if (!valid) return;
        submitting.value = true;
        try {
            if (editMode.value && editId.value) {
                await updateAIProviderApi(editId.value, {
                    name: form.name,
                    providerKey: form.providerKey,
                    apiBaseUrl: form.apiBaseUrl,
                    model: form.model,
                    apiKey: form.apiKey,
                    temperature: form.temperature / 100,
                    systemPrompt: form.systemPrompt.trim() || null,
                    enabled: form.enabled,
                    isDefault: form.isDefault,
                });
                ElMessage.success("已更新");
            } else {
                await createAIProviderApi({
                    name: form.name,
                    providerKey: form.providerKey,
                    apiBaseUrl: form.apiBaseUrl,
                    model: form.model,
                    apiKey: form.apiKey,
                    temperature: form.temperature / 100,
                    systemPrompt: form.systemPrompt.trim() || null,
                    enabled: form.enabled,
                    isDefault: form.isDefault,
                    sortOrder: 0,
                });
                ElMessage.success("已添加");
            }
            dialogVisible.value = false;
            await loadData();
        } catch (e) {
            ElMessage.error(e instanceof Error ? e.message : "操作失败");
        } finally {
            submitting.value = false;
        }
    });
};

const handleAction = async (cmd: string, p: Monitor.AIProvider) => {
    switch (cmd) {
        case "edit":
            openEdit(p);
            break;
        case "setDefault":
            try {
                await setDefaultAIProviderApi(p.id);
                ElMessage.success(`「${p.name}」已设为默认`);
                await loadData();
            } catch (e) {
                ElMessage.error(e instanceof Error ? e.message : "设置失败");
            }
            break;
        case "enable":
        case "disable":
            try {
                await updateAIProviderApi(p.id, { enabled: cmd === "enable" });
                ElMessage.success(cmd === "enable" ? "已启用" : "已禁用");
                await loadData();
            } catch (e) {
                ElMessage.error(e instanceof Error ? e.message : "操作失败");
            }
            break;
        case "delete":
            // confirm 在 try 内，用户取消时 promise reject 被捕获，避免 unhandled rejection
            try {
                await ElMessageBox.confirm(`确认删除提供者「${p.name}」？`, "删除确认", {
                    type: "warning",
                    confirmButtonText: "删除",
                });
                await deleteAIProviderApi(p.id);
                ElMessage.success("已删除");
                await loadData();
            } catch (e) {
                if (e === "cancel" || e === "close") return; // 用户取消，静默返回
                ElMessage.error(e instanceof Error ? e.message : "删除失败");
            }
            break;
    }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
.ai-providers {
  .toolbar {
    margin-bottom: 16px;
    .toolbar-inner { display: flex; align-items: center; justify-content: space-between; }
    .toolbar-left { display: flex; align-items: center; gap: 12px; }
    .title { font-size: 18px; font-weight: 600; margin: 0; }
  }
  .provider-card {
    margin-bottom: 16px;
    transition: opacity 0.3s;
    &.disabled { opacity: 0.55; }
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      .card-title {
        display: flex; align-items: center; gap: 8px;
        .provider-icon { font-size: 20px; }
        .provider-name { font-weight: 600; font-size: 15px; }
      }
    }
    .card-body {
      .info-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 0;
        .info-label { font-size: 13px; color: var(--el-text-color-secondary); }
        .info-value { font-size: 13px; color: var(--el-text-color-primary); }
        .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
        .muted { color: var(--el-color-danger); }
      }
    }
  }
  .form-tip { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
}
</style>
