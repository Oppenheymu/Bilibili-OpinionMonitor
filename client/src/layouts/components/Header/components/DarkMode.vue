<template>
  <el-tooltip :content="isDark ? '切换亮色模式' : '切换深色模式'" placement="bottom" :show-after="200">
    <el-icon class="dark-mode" @click="toggleDark">
      <Sunny v-if="isDark" />
      <Moon v-else />
    </el-icon>
  </el-tooltip>
</template>

<script setup lang="ts" name="DarkMode">
import { computed } from "vue";
import { Sunny, Moon } from "@element-plus/icons-vue";
import { useGlobalStore } from "@/stores/modules/global";
import { useTheme } from "@/hooks/useTheme";

const { switchDark } = useTheme();
const globalStore = useGlobalStore();
const isDark = computed(() => globalStore.isDark);

const toggleDark = () => {
  globalStore.setGlobalState("isDark", !isDark.value);
  switchDark();
};
</script>

<style scoped lang="scss">
.dark-mode {
  font-size: 20px;
  cursor: pointer;
  color: var(--el-header-text-color);
  &:hover {
    opacity: 0.85;
  }
}
</style>
