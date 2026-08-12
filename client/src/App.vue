<template>
  <el-config-provider :locale="locale" :size="assemblySize" :button="buttonConfig">
    <router-view></router-view>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted, reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import { getBrowserLang } from "@/utils";
import { useTheme } from "@/hooks/useTheme";
import { getConfigApi } from "@/api/modules/monitor";
import { ElConfigProvider } from "element-plus";
import type { LanguageType } from "./stores/interface";
import { useGlobalStore } from "@/stores/modules/global";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";

const globalStore = useGlobalStore();

// init theme
const { initTheme, switchDark } = useTheme();
initTheme();

// init language
const i18n = useI18n();
onMounted(async () => {
  const language = globalStore.language ?? getBrowserLang();
  i18n.locale.value = language;
  globalStore.setGlobalState("language", language as LanguageType);

  // 应用服务端「深色模式」配置（设置页保存的偏好，优先级高于本地）；失败时保持本地主题
  try {
    const cfg = (await getConfigApi()) as Record<string, unknown>;
    const darkMode = cfg["深色模式"];
    if (darkMode !== undefined && darkMode !== null && darkMode !== "") {
      const shouldBeDark = darkMode === true || darkMode === "true" || darkMode === "1";
      if (shouldBeDark !== globalStore.isDark) {
        globalStore.setGlobalState("isDark", shouldBeDark);
        switchDark();
      }
    }
  } catch {
    /* 服务端不可达时保持本地主题 */
  }
});

// element language
const locale = computed(() => {
  if (globalStore.language == "zh") return zhCn;
  if (globalStore.language == "en") return en;
  return getBrowserLang() == "zh" ? zhCn : en;
});

// element assemblySize
const assemblySize = computed(() => globalStore.assemblySize);

// element button config
const buttonConfig = reactive({ autoInsertSpace: false });
</script>
