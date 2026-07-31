import dayjs from "dayjs";

/**
 * 格式化 Unix 时间戳为可读字符串
 */
export const formatTime = (ts: number | null | undefined): string =>
  ts ? dayjs.unix(ts).format("YYYY-MM-DD HH:mm:ss") : "-";
