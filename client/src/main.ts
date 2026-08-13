import { createApp } from "vue";
import App from "./App.vue";
// reset style sheet
import "@/styles/reset.scss";
// CSS common style sheet
import "@/styles/common.scss";
// iconfont css
import "@/assets/iconfont/iconfont.scss";
// element css
import "element-plus/dist/index.css";
// element dark css
import "element-plus/theme-chalk/dark/css-vars.css";
// custom element dark css
import "@/styles/element-dark.scss";
// custom element css
import "@/styles/element.scss";
// element icons
import * as Icons from "@element-plus/icons-vue";
// element plus
import ElementPlus from "element-plus";
// custom directives
import directives from "@/directives/index";
// vue i18n
import I18n from "@/languages/index";
// vue Router
import router from "@/routers";
// pinia store
import pinia from "@/stores";
// errorHandler
import errorHandler from "@/utils/errorHandler";

const app = createApp(App);

app.config.errorHandler = errorHandler;

// register the element Icons component
for (const key of Object.keys(Icons)) {
    app.component(key, Icons[key as keyof typeof Icons]);
}

app.use(ElementPlus).use(directives).use(router).use(I18n).use(pinia).mount("#app");
