// 临时脚本：直接调用采集评论，抓取真实错误
import { 采集评论 } from "./src/scheduler/采集";
import { 获取客户端 } from "./src/bili/client";

try {
    console.log("开始初始化客户端...");
    await 获取客户端();
    console.log("客户端就绪，开始采集评论...");
    const 结果 = await 采集评论();
    console.log("采集评论完成:", JSON.stringify(结果));
} catch (e) {
    console.error("捕获到错误:", e);
    console.error("错误堆栈:", e?.stack ?? "无堆栈");
}
process.exit(0);
