import type {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from "axios";
import axios, { type AxiosError } from "axios";
import { ElMessage, ElMessageBox } from "element-plus";
import type { ResultData } from "@/api/interface";
import { showFullScreenLoading, tryHideFullScreenLoading } from "@/components/Loading/fullScreen";
import { LOGIN_URL } from "@/config";
import { ResultEnum } from "@/enums/httpEnum";
import router from "@/routers";
import { useUserStore } from "@/stores/modules/user";
import { checkStatus } from "./helper/checkStatus";

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    loading?: boolean;
}

/** 访问令牌引导弹窗防重入：并发 401 只弹一次 */
let promptVisible = false;

/**
 * 访问令牌缺失/无效时的引导：弹窗输入令牌 → 存入 localStorage → 刷新页面
 * （刷新后所有请求自动携带令牌，重新走一遍页面加载）
 */
async function promptForAccessToken(): Promise<void> {
    if (promptVisible) return;
    promptVisible = true;
    try {
        const { value } = await ElMessageBox.prompt(
            "服务端已启用访问令牌保护，请在下方输入令牌。\n\n" +
                '令牌在哪：「系统配置」→「安全」→「访问令牌」（加密存储，仅显示"已配置"）。\n' +
                "遗忘令牌：打开系统配置页（无需令牌即可进入），将「访问令牌」留空保存即可停用认证，之后再设置新令牌。",
            "需要访问令牌",
            {
                confirmButtonText: "保存并刷新",
                cancelButtonText: "取消",
                inputType: "password",
                inputPlaceholder: "请输入访问令牌",
                inputValidator: (v) => (v && v.trim().length > 0 ? true : "令牌不能为空"),
                closeOnClickModal: false,
            },
        );
        const token = value?.trim();
        if (token) {
            localStorage.setItem("访问令牌", token);
            ElMessage.success("访问令牌已保存，正在刷新…");
            window.location.reload();
        }
    } catch {
        // 用户取消输入，保持现状
    } finally {
        promptVisible = false;
    }
}

const config = {
    // 默认地址请求地址，可在 .env.** 文件中修改
    baseURL: import.meta.env.VITE_API_URL as string,
    // 设置超时时间
    timeout: ResultEnum.TIMEOUT as number,
    // 跨域时候允许携带凭证
    withCredentials: true,
};

class RequestHttp {
    service: AxiosInstance;
    public constructor(config: AxiosRequestConfig) {
        // instantiation
        this.service = axios.create(config);

        /**
         * @description 请求拦截器
         * 客户端发送请求 -> [请求拦截器] -> 服务器
         * token校验(JWT) : 接受服务器返回的 token,存储到 vuex/pinia/本地储存当中
         */
        this.service.interceptors.request.use(
            (config: CustomAxiosRequestConfig) => {
                const userStore = useUserStore();
                // 当前请求不需要显示 loading，在 api 服务中通过指定的第三个参数: { loading: false } 来控制
                if (!config.loading) config.loading = true;
                config.loading && showFullScreenLoading();
                if (config.headers && typeof config.headers.set === "function") {
                    // 优先携带「系统配置」中设置的访问令牌（项目级认证），否则回退到登录 token
                    const accessToken = localStorage.getItem("访问令牌");
                    config.headers.set("x-access-token", accessToken ?? userStore.token);
                }
                return config;
            },
            (error: AxiosError) => {
                return Promise.reject(error);
            },
        );

        /**
         * @description 响应拦截器
         *  服务器换返回信息 -> [拦截统一处理] -> 客户端JS获取到信息
         */
        this.service.interceptors.response.use(
            (response: AxiosResponse) => {
                const { data } = response;
                tryHideFullScreenLoading();
                // 兼容直接返回数据的服务端（无 code/msg/data 结构，如本项目的 Hono 后端）
                if (data == null || typeof data !== "object" || !("code" in data)) {
                    return data;
                }
                const userStore = useUserStore();
                // 登陆失效
                if (data.code === ResultEnum.OVERDUE) {
                    userStore.setToken("");
                    router.replace(LOGIN_URL);
                    ElMessage.error(data.msg);
                    return Promise.reject(data);
                }
                // 全局错误信息拦截（防止下载文件的时候返回数据流，没有 code 直接报错）
                if (data.code && data.code !== ResultEnum.SUCCESS) {
                    ElMessage.error(data.msg);
                    return Promise.reject(data);
                }
                // 成功请求（在页面上除非特殊情况，否则不用处理失败逻辑）
                return data;
            },
            async (error: AxiosError) => {
                const { response } = error;
                tryHideFullScreenLoading();
                // 请求超时 && 网络错误单独判断，没有 response
                if (error.message.indexOf("timeout") !== -1)
                    ElMessage.error("请求超时！请您稍后重试");
                if (error.message.indexOf("Network Error") !== -1)
                    ElMessage.error("网络错误！请您稍后重试");
                // 401：本项目的认证来源是「系统配置 → 访问令牌」，不是 JWT 登录。
                // 若令牌缺失/无效，弹窗引导输入令牌存入 localStorage，而不是误导性的"登录失效"。
                if (response?.status === 401) {
                    const data = response.data as { error?: string } | undefined;
                    if (data?.error?.includes("访问令牌")) {
                        await promptForAccessToken();
                        return Promise.reject(error);
                    }
                }
                // 根据服务器响应的错误状态码，做不同的处理
                if (response) checkStatus(response.status);
                // 服务器结果都没有返回(可能服务器错误可能客户端断网)，断网处理:可以跳转到断网页面
                if (!window.navigator.onLine) router.replace("/500");
                return Promise.reject(error);
            },
        );
    }

    /**
     * @description 常用请求方法封装
     *  响应拦截器按响应结构区分：标准后端（含 code/msg/data）返回 ResultData<T>；
     *  本项目 Hono 后端直接返回数据，调用方用 direct() 解包
     */
    get<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
        return this.service.get(url, { params, ..._object });
    }
    post<T>(url: string, params?: object | string, _object = {}): Promise<ResultData<T>> {
        return this.service.post(url, params, _object);
    }
    put<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
        return this.service.put(url, params, _object);
    }
    patch<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
        return this.service.patch(url, params, _object);
    }
    delete<T>(url: string, params?: unknown, _object = {}): Promise<ResultData<T>> {
        return this.service.delete(url, { params, ..._object });
    }
    /**
     * 直接请求（本项目服务端无 code/msg/data 包裹，返回裸数据）
     * 响应拦截器对无 code 的响应直接返回 data，因此类型即为 T
     */
    direct<T>(url: string, params?: object, _object = {}): Promise<T> {
        return this.service.get(url, { params, ..._object });
    }
    directPost<T>(url: string, params?: object | string, _object = {}): Promise<T> {
        return this.service.post(url, params, _object);
    }
    directPut<T>(url: string, params?: object, _object = {}): Promise<T> {
        return this.service.put(url, params, _object);
    }
    directPatch<T>(url: string, params?: object, _object = {}): Promise<T> {
        return this.service.patch(url, params, _object);
    }
    directDelete<T>(url: string, params?: unknown, _object = {}): Promise<T> {
        return this.service.delete(url, { params, ..._object });
    }
    download(url: string, params?: object, _object = {}): Promise<BlobPart> {
        return this.service.post(url, params, { ..._object, responseType: "blob" });
    }
}

export default new RequestHttp(config);
