import { 获取客户端 } from "../bili/client";
import * as 库 from "../db/repository";

/** 读取采集参数（DB 优先，缺省回退代码默认） */
export async function 读取采集参数(): Promise<{
    间隔分钟: number;
    评论上限: number;
    视频页数: number;
    动态页数: number;
    分析批量: number;
    评论采集间隔小时: number;
    请求间隔毫秒: number;
    最大重试次数: number;
}> {
    const 取数 = async (键: string, 默认值: number) => {
        const v = await 库.读取配置项(键);
        const n = Number(v);
        return v === "" || Number.isNaN(n) ? 默认值 : n;
    };
    return {
        间隔分钟: await 取数("采集间隔分钟", 30),
        评论上限: await 取数("单视频评论上限", 500),
        视频页数: await 取数("视频采集页数", 3),
        动态页数: await 取数("动态采集页数", 5),
        分析批量: await 取数("分析批量大小", 20),
        // 同一视频两次评论采集的最小间隔（小时），避免每次全量拉取触发 B站风控
        评论采集间隔小时: await 取数("评论采集间隔小时", 6),
        // B站 API 请求间隔（毫秒）：所有采集请求全局串行限速 + 随机抖动
        请求间隔毫秒: await 取数("请求间隔毫秒", 1200),
        // 失败重试次数：指数退避重试（1s→2s→4s...上限 30s）
        最大重试次数: await 取数("最大重试次数", 3),
    };
}

/** 初始化 B站客户端，失败抛出 */
export async function 初始化客户端(): Promise<void> {
    await 获取客户端();
}
