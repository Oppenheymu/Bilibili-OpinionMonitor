import { 获取客户端 } from "../bili/client";
import * as 库 from "../db/repository";

/** 读取采集参数（DB 优先，缺省回退代码默认） */
export async function 读取采集参数(): Promise<{
    间隔分钟: number;
    评论上限: number;
    视频页数: number;
    动态页数: number;
    分析批量: number;
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
    };
}

/** 初始化 B站客户端，失败抛出 */
export async function 初始化客户端(): Promise<void> {
    await 获取客户端();
}
