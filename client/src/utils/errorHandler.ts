import { ElNotification } from "element-plus";

/**
 * JS 标准错误名（Error.name 值）→ 中文描述 映射
 * 键用小写便于不区分大小写匹配（Error.name 实际为 "InternalError" 等 PascalCase）
 */
const ERROR_NAME_MAP: { [key: string]: string } = {
    internal_error: "Javascript引擎内部错误",
    reference_error: "未找到对象",
    type_error: "使用了错误的类型或对象",
    range_error: "使用内置对象时，参数超范围",
    syntax_error: "语法错误",
    eval_error: "错误的使用了Eval",
    uri_error: "URI错误",
};

/** 错误名转 snake_case 的边界正则（模块顶层） */
const ERROR_SUFFIX_PATTERN = /Error$/;
const CAMEL_BOUNDARY_PATTERN = /([a-z])([A-Z])/g;

/**
 * @description 全局代码错误捕捉
 * */
const errorHandler = (error: any): boolean | void => {
    // 过滤 HTTP 请求错误
    if (error.status || error.status === 0) return false;
    const key = String(error.name ?? "")
        .replace(ERROR_SUFFIX_PATTERN, "")
        .replace(CAMEL_BOUNDARY_PATTERN, "$1_$2")
        .toLowerCase();
    const errorName = ERROR_NAME_MAP[key] || "未知错误";
    ElNotification({
        title: errorName,
        message: error,
        type: "error",
        duration: 3000,
    });
    return;
};

export default errorHandler;
