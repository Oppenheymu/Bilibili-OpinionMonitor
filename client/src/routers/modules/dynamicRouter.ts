import { ElNotification } from "element-plus";
import type { RouteRecordRaw } from "vue-router";
import router from "@/routers/index";
import { useAuthStore } from "@/stores/modules/auth";

// 引入 views 文件夹下所有 vue 文件
const modules = import.meta.glob("@/views/**/*.vue");

/**
 * @description 初始化动态路由（本项目菜单数据来自本地 json，无登录鉴权）
 */
export const initDynamicRouter = async () => {
    const authStore = useAuthStore();

    try {
        // 1.获取菜单列表 && 按钮权限列表（本地数据）
        await authStore.getAuthMenuList();
        await authStore.getAuthButtonList();

        // 2.判断是否有菜单数据
        if (!authStore.authMenuListGet.length) {
            ElNotification({
                title: "无菜单数据",
                message: "本地菜单数据为空，请检查 authMenuList.json 配置！",
                type: "warning",
                duration: 3000,
            });
            return Promise.reject("No menu data");
        }

        // 3.添加动态路由
        authStore.flatMenuListGet.forEach((item) => {
            item.children && delete item.children;
            if (item.component && typeof item.component == "string") {
                const component = modules["/src/views" + item.component + ".vue"];
                if (component) item.component = component;
            }
            if (item.meta.isFull) {
                router.addRoute(item as unknown as RouteRecordRaw);
            } else {
                router.addRoute("layout", item as unknown as RouteRecordRaw);
            }
        });
    } catch (error) {
        console.error("初始化动态路由失败：", error);
        return Promise.reject(error);
    }
};
