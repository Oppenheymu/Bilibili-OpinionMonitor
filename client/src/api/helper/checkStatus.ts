import { ElMessage } from "element-plus";

/**
 * @description: 校验网络请求状态码
 * @param {Number} status
 * @return void
 */
export const checkStatus = (status: number) => {
  switch (status) {
    case 400:
      ElMessage.error("请求失败！请您稍后重试");
      break;
    case 401:
      // 本项目无 JWT 登录体系，401 来自「访问令牌」认证（已由拦截器引导输入）
      ElMessage.error("认证失败：访问令牌缺失或无效");
      break;
    case 403:
      ElMessage.error("当前账号无权限访问！");
      break;
    case 404:
      ElMessage.error("你所访问的资源不存在！");
      break;
    case 405:
      ElMessage.error("请求方式错误！请您稍后重试");
      break;
    case 408:
      ElMessage.error("请求超时！请您稍后重试");
      break;
    case 500:
      ElMessage.error("服务异常！");
      break;
    case 502:
      ElMessage.error("网关错误！");
      break;
    case 503:
      ElMessage.error("服务不可用！");
      break;
    case 504:
      ElMessage.error("网关超时！");
      break;
    default:
      ElMessage.error("请求失败！");
  }
};
