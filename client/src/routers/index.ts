import { createRouter, createWebHashHistory, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/modules/auth";
import { ROUTER_WHITE_LIST } from "@/config";
import { initDynamicRouter } from "@/routers/modules/dynamicRouter";
import { staticRouter, errorRouter } from "@/routers/modules/staticRouter";
import NProgress from "@/config/nprogress";

const mode = import.meta.env.VITE_ROUTER_MODE;

const routerMode = {
  hash: () => createWebHashHistory(),
  history: () => createWebHistory()
};

const router = createRouter({
  history: routerMode[mode](),
  routes: [...staticRouter, ...errorRouter],
  strict: false,
  scrollBehavior: () => ({ left: 0, top: 0 })
});

/**
 * @description 路由拦截 beforeEach（本项目无登录鉴权，直接初始化动态路由并放行）
 */
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // 1.NProgress 开始
  NProgress.start();

  // 2.动态设置标题
  const title = import.meta.env.VITE_GLOB_APP_TITLE;
  document.title = to.meta.title ? `${to.meta.title} - ${title}` : title;

  // 3.白名单直接放行
  if (ROUTER_WHITE_LIST.includes(to.path)) return next();

  // 4.如果没有菜单列表，就初始化本地动态路由
  if (!authStore.authMenuListGet.length) {
    await initDynamicRouter();
    return next({ ...to, replace: true });
  }

  // 5.存储 routerName 做按钮权限筛选
  authStore.setRouteName(to.name as string);

  // 6.正常访问页面
  next();
});

/**
 * @description 重置路由
 */
export const resetRouter = () => {
  const authStore = useAuthStore();
  authStore.flatMenuListGet.forEach(route => {
    const { name } = route;
    if (name && router.hasRoute(name)) router.removeRoute(name);
  });
};

router.onError(error => {
  NProgress.done();
  console.warn("路由错误", error.message);
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
