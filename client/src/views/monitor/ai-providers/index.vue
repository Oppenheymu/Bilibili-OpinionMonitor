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
          <el-button type="primary" :icon="Plus" @click="打开新增">添加提供者</el-button>
        </div>
      </div>
    </el-card>

    <!-- 提供者卡片列表 -->
    <el-row :gutter="16">
      <el-col v-for="p in 提供者列表" :key="p.提供者ID" :xs="24" :md="12" :lg="8">
        <el-card shadow="hover" class="provider-card" :class="{ disabled: !p.启用 }">
          <template #header>
            <div class="card-header">
              <div class="card-title">
                <span class="provider-icon">{{ 提供商标识图标(p.提供商标识) }}</span>
                <span class="provider-name">{{ p.名称 }}</span>
                <el-tag v-if="p.是否默认" type="success" size="small" effect="dark">默认</el-tag>
                <el-tag v-if="!p.启用" type="danger" size="small">已禁用</el-tag>
              </div>
              <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, p)">
                <el-button text :icon="MoreFilled" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" :icon="Edit">编辑</el-dropdown-item>
                    <el-dropdown-item v-if="!p.是否默认" command="setDefault" :icon="Star">设为默认</el-dropdown-item>
                    <el-dropdown-item :command="p.启用 ? 'disable' : 'enable'" :icon="p.启用 ? VideoPause : VideoPlay">
                      {{ p.启用 ? '禁用' : '启用' }}
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
              <span class="info-value">{{ p.模型 }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">端点</span>
              <span class="info-value mono">{{ p.API地址 || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Temperature</span>
              <span class="info-value">{{ (p.温度 / 100).toFixed(2) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">密钥</span>
              <span class="info-value" :class="{ muted: !p.API密钥 }">{{ p.API密钥 ? '已配置' : '未配置' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 空状态 -->
    <el-empty v-if="!提供者列表.length && !加载中" description="还没有 AI 提供者，点击上方按钮添加一个">
      <el-button type="primary" :icon="Plus" @click="打开新增">添加提供者</el-button>
    </el-empty>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="弹窗显示"
      :title="编辑模式 ? '编辑提供者' : '添加 AI 提供者'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="表单引用" :model="表单" :rules="表单规则" label-width="90px">
        <el-form-item label="名称" prop="名称">
          <el-input v-model="表单.名称" placeholder="如：我的DeepSeek、公司Claude" />
        </el-form-item>
        <el-form-item label="类型" prop="提供商标识">
          <el-select v-model="表单.提供商标识" placeholder="选择或输入" filterable allow-create style="width:100%">
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Gemini" value="gemini" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="Claude" value="claude" />
            <el-option label="通义千问" value="qwen" />
            <el-option label="Moonshot" value="moonshot" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="API 地址" prop="API地址">
          <el-input v-model="表单.API地址" placeholder="https://api.deepseek.com/v1" />
          <div class="form-tip">OpenAI 兼容的 base URL（不含 /chat/completions）</div>
        </el-form-item>
        <el-form-item label="模型" prop="模型">
          <el-input v-model="表单.模型" placeholder="deepseek-chat / gpt-4o / gemini-2.5-flash" />
        </el-form-item>
        <el-form-item label="API 密钥" prop="API密钥">
          <el-input v-model="表单.API密钥" type="password" show-password
            :placeholder="编辑模式 ? '留空保留原值' : 'sk-... 或 AIza...'" />
        </el-form-item>
        <el-form-item label="系统提示词">
          <el-input
            v-model="表单.系统提示词"
            type="textarea"
            :rows="5"
            placeholder="情感分析 system prompt（留空使用内置默认）
内置默认：你是舆情分析助手。对用户给出的B站评论或动态内容进行情感分析..."
          />
          <div class="form-tip">自定义后用于所有情感分析请求；留空则使用内置默认提示词</div>
        </el-form-item>
        <el-form-item label="Temperature">
          <el-slider v-model="表单.温度" :min="0" :max="100" :step="1" show-input style="width:100%" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="表单.启用" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="表单.是否默认" />
          <div class="form-tip">只有一个默认提供者会被用于情感分析</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="弹窗显示 = false">取消</el-button>
        <el-button type="primary" :loading="提交中" @click="提交">{{ 编辑模式 ? '保存' : '添加' }}</el-button>
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

const 提供者列表 = ref<Monitor.AI提供者[]>([]);
const 加载中 = ref(false);

const 提供商标识图标 = (标识: string) => {
  const map: Record<string, string> = { deepseek: "🐋", gemini: "💎", openai: "🧠", claude: "🎵", qwen: "☁️", moonshot: "🌙", custom: "🔌" };
  return map[标识] ?? "🤖";
};

const loadData = async () => {
  加载中.value = true;
  try {
    提供者列表.value = await getAIProvidersApi();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    加载中.value = false;
  }
};

// ===== 弹窗逻辑 =====
const 弹窗显示 = ref(false);
const 编辑模式 = ref(false);
const 编辑ID = ref<number | null>(null);
const 提交中 = ref(false);
const 表单引用 = ref<FormInstance>();

const 默认表单 = () => ({
  名称: "", 提供商标识: "deepseek", API地址: "https://api.deepseek.com/v1",
  模型: "deepseek-chat", API密钥: "", 系统提示词: "", 温度: 20, 启用: true, 是否默认: false,
});

const 表单 = reactive(默认表单());

const 表单规则 = {
  名称: [{ required: true, message: "请输入名称", trigger: "blur" }],
  提供商标识: [{ required: true, message: "请选择类型", trigger: "change" }],
  API地址: [{ required: true, message: "请输入 API 地址", trigger: "blur" }],
  模型: [{ required: true, message: "请输入模型名", trigger: "blur" }],
  API密钥: [{ required: true, message: "请输入密钥", trigger: "blur", validator: (_r: unknown, _v: unknown, cb: any) => {
    if (编辑模式.value && !表单.API密钥) return cb(); // 编辑模式留空不校验
    if (!表单.API密钥) return cb(new Error("请输入密钥"));
    cb();
  }}],
};

const 打开新增 = () => {
  编辑模式.value = false;
  编辑ID.value = null;
  Object.assign(表单, 默认表单());
  弹窗显示.value = true;
};

const 打开编辑 = (p: Monitor.AI提供者) => {
  编辑模式.value = true;
  编辑ID.value = p.提供者ID;
  表单.名称 = p.名称;
  表单.提供商标识 = p.提供商标识;
  表单.API地址 = p.API地址;
  表单.模型 = p.模型;
  表单.API密钥 = "";
  表单.系统提示词 = p.系统提示词 ?? "";
  表单.温度 = p.温度;
  表单.启用 = p.启用;
  表单.是否默认 = p.是否默认;
  弹窗显示.value = true;
};

const 提交 = async () => {
  if (!表单引用.value) return;
  await 表单引用.value.validate(async (valid) => {
    if (!valid) return;
    提交中.value = true;
    try {
      if (编辑模式.value && 编辑ID.value) {
        await updateAIProviderApi(编辑ID.value, {
          名称: 表单.名称, 提供商标识: 表单.提供商标识, API地址: 表单.API地址,
          模型: 表单.模型, API密钥: 表单.API密钥, 温度: 表单.温度 / 100,
          系统提示词: 表单.系统提示词.trim() || null,
          启用: 表单.启用, 是否默认: 表单.是否默认,
        });
        ElMessage.success("已更新");
      } else {
        await createAIProviderApi({
          名称: 表单.名称, 提供商标识: 表单.提供商标识, API地址: 表单.API地址,
          模型: 表单.模型, API密钥: 表单.API密钥, 温度: 表单.温度 / 100,
          系统提示词: 表单.系统提示词.trim() || null,
          启用: 表单.启用, 是否默认: 表单.是否默认, 排序: 0,
        });
        ElMessage.success("已添加");
      }
      弹窗显示.value = false;
      await loadData();
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      提交中.value = false;
    }
  });
};

const handleAction = async (cmd: string, p: Monitor.AI提供者) => {
  switch (cmd) {
    case "edit": 打开编辑(p); break;
    case "setDefault":
      try { await setDefaultAIProviderApi(p.提供者ID); ElMessage.success(`「${p.名称}」已设为默认`); await loadData(); }
      catch (e) { ElMessage.error(e instanceof Error ? e.message : "设置失败"); }
      break;
    case "enable": case "disable":
      try {
        await updateAIProviderApi(p.提供者ID, { 启用: cmd === "enable" });
        ElMessage.success(cmd === "enable" ? "已启用" : "已禁用");
        await loadData();
      } catch (e) { ElMessage.error(e instanceof Error ? e.message : "操作失败"); }
      break;
    case "delete":
      // confirm 在 try 内，用户取消时 promise reject 被捕获，避免 unhandled rejection
      try {
        await ElMessageBox.confirm(`确认删除提供者「${p.名称}」？`, "删除确认", { type: "warning", confirmButtonText: "删除" });
        await deleteAIProviderApi(p.提供者ID);
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
