import { createApp } from "vue";
import TDesign from "tdesign-vue-next";
import "tdesign-vue-next/es/style/index.css";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import App from "./App.vue";
import "./style.css";

use([
    CanvasRenderer,
    LineChart,
    PieChart,
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
]);

createApp(App)
    .use(TDesign)
    .component("VChart", VChart)
    .mount("#app");
