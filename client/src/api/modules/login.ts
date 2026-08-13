import http from "@/api";
import { PORT1 } from "@/api/config/servicePort";
import type { Login } from "@/api/interface/index";
import authButtonList from "@/assets/json/authButtonList.json";
import authMenuList from "@/assets/json/authMenuList.json";

/**
 * @name 登录模块
 */
// 用户登录
export const loginApi = (params: Login.ReqLoginForm) => {
    return http.post<Login.ResLogin>(`${PORT1}/login`, params, { loading: false }); // 正常 post json 请求  ==>  application/json
    // return http.post<Login.ResLogin>(PORT1 + `/login`, params, { loading: false }); // 控制当前请求不显示 loading
    // return http.post<Login.ResLogin>(PORT1 + `/login`, {}, { params }); // post 请求携带 query 参数  ==>  ?username=admin&password=123456
    // return http.post<Login.ResLogin>(PORT1 + `/login`, qs.stringify(params)); // post 请求携带表单参数  ==>  application/x-www-form-urlencoded
    // return http.get<Login.ResLogin>(PORT1 + `/login?${qs.stringify(params, { arrayFormat: "repeat" })}`); // get 请求可以携带数组等复杂参数
};

// 获取菜单列表（本项目使用本地数据，不依赖网络请求）
export const getAuthMenuListApi = () => {
    return authMenuList;
};

// 获取按钮权限（本项目无按钮权限控制，返回本地数据）
export const getAuthButtonListApi = () => {
    return authButtonList;
};

// 用户退出登录
export const logoutApi = () => {
    return http.post(`${PORT1}/logout`);
};
