import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/modules/auth";

/**
 * @description 页面按钮权限
 * */
export const useAuthButtons = () => {
    const route = useRoute();
    const authStore = useAuthStore();
    const authButtons = authStore.authButtonListGet[route.name as string] || [];

    const buttons = computed(() => {
        const currentPageAuthButton: { [key: string]: boolean } = {};
        for (const item of authButtons) currentPageAuthButton[item] = true;
        return currentPageAuthButton;
    });

    return {
        buttons,
    };
};
