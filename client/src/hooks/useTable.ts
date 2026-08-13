import { computed, reactive, toRefs } from "vue";
import type { Table } from "./interface";

/**
 * @description table 页面操作方法封装
 * @param {Function} api 获取表格数据 api 方法 (必传)
 * @param {Object} initParam 获取数据初始化参数 (非必传，默认为{})
 * @param {Boolean} isPageable 是否有分页 (非必传，默认为true)
 * @param {Function} dataCallBack 对后台返回的数据进行处理的方法 (非必传)
 * */
export const useTable = (
    api?: (params: Record<string, unknown>) => Promise<Record<string, unknown>>,
    initParam: object = {},
    isPageable: boolean = true,
    dataCallBack?: (data: Record<string, unknown>) => Record<string, unknown>,
    requestError?: (error: unknown) => void,
) => {
    const state = reactive<Table.StateProps>({
        // 表格数据
        tableData: [],
        // 分页数据
        pageable: {
            // 当前页数
            pageNum: 1,
            // 每页显示条数
            pageSize: 10,
            // 总条数
            total: 0,
        },
        // 查询参数(只包括查询)
        searchParam: {},
        // 初始化默认的查询参数
        searchInitParam: {},
        // 总参数(包含分页和查询参数)
        totalParam: {},
    });

    /**
     * @description 分页查询参数(只包括分页和表格字段排序,其他排序方式可自行配置)
     * */
    const pageParam = computed({
        get: () => {
            return {
                pageNum: state.pageable.pageNum,
                pageSize: state.pageable.pageSize,
            };
        },
        set: (_newVal: unknown) => {
            // 分页更新（模板遗留 setter，暂无自定义逻辑）
        },
    });

    /**
     * @description 获取表格数据
     * @return void
     * */
    const getTableList = async () => {
        if (!api) return;
        try {
            // 先把初始化参数和分页参数放到总参数里面
            Object.assign(state.totalParam, initParam, isPageable ? pageParam.value : {});
            const response = await api({ ...state.searchInitParam, ...state.totalParam });
            const data = resolveResponseData(response);
            state.tableData = resolveTableData(data, isPageable, dataCallBack);
            // 解构后台返回的分页数据 (如果有分页更新分页信息)
            if (isPageable) updatePageableFromData(data);
        } catch (error) {
            requestError?.(error);
        }
    };

    /** 兼容两种响应结构：直接返回数据，或 { data } 包裹 */
    const resolveResponseData = (response: Record<string, unknown>): Record<string, unknown> =>
        (response["data"] as Record<string, unknown> | undefined) ?? response;

    /** 从响应中提取表格行数据（分页取 list，否则取整条；支持回调转换） */
    const resolveTableData = (
        data: Record<string, unknown>,
        withPage: boolean,
        transform?: (d: Record<string, unknown>) => Record<string, unknown>,
    ): unknown[] => {
        if (transform) return transform(data) as unknown as unknown[];
        const list = data["list"] as unknown;
        return withPage ? (Array.isArray(list) ? list : []) : ([data] as unknown[]);
    };

    /** 从响应数据中提取分页信息并更新 */
    const updatePageableFromData = (data: Record<string, unknown>) => {
        updatePageable({
            pageNum: Number(data["pageNum"] ?? 0),
            pageSize: Number(data["pageSize"] ?? 0),
            total: Number(data["total"] ?? 0),
        });
    };

    /**
     * @description 更新查询参数
     * @return void
     * */
    const updatedTotalParam = () => {
        state.totalParam = {};
        // 处理查询参数，可以给查询参数加自定义前缀操作
        const nowSearchParam: Table.StateProps["searchParam"] = {};
        // 防止手动清空输入框携带参数（这里可以自定义查询参数前缀）
        for (const key in state.searchParam) {
            // 某些情况下参数为 false/0 也应该携带参数
            if (
                state.searchParam[key] ||
                state.searchParam[key] === false ||
                state.searchParam[key] === 0
            ) {
                nowSearchParam[key] = state.searchParam[key];
            }
        }
        Object.assign(state.totalParam, nowSearchParam, isPageable ? pageParam.value : {});
    };

    /**
     * @description 更新分页信息
     * @param {Object} pageable 后台返回的分页数据
     * @return void
     * */
    const updatePageable = (pageable: Table.Pageable) => {
        Object.assign(state.pageable, pageable);
    };

    /**
     * @description 表格数据查询
     * @return void
     * */
    const search = () => {
        state.pageable.pageNum = 1;
        updatedTotalParam();
        // biome-ignore lint/nursery/noFloatingPromises: 刻意 fire-and-forget，getTableList 内部已 try/catch
        getTableList();
    };

    /**
     * @description 表格数据重置
     * @return void
     * */
    const reset = () => {
        state.pageable.pageNum = 1;
        // 重置搜索表单的时，如果有默认搜索参数，则重置默认的搜索参数
        state.searchParam = { ...state.searchInitParam };
        updatedTotalParam();
        // biome-ignore lint/nursery/noFloatingPromises: 刻意 fire-and-forget，getTableList 内部已 try/catch
        getTableList();
    };

    /**
     * @description 每页条数改变
     * @param {Number} val 当前条数
     * @return void
     * */
    const handleSizeChange = (val: number) => {
        state.pageable.pageNum = 1;
        state.pageable.pageSize = val;
        // biome-ignore lint/nursery/noFloatingPromises: 刻意 fire-and-forget，getTableList 内部已 try/catch
        getTableList();
    };

    /**
     * @description 当前页改变
     * @param {Number} val 当前页
     * @return void
     * */
    const handleCurrentChange = (val: number) => {
        state.pageable.pageNum = val;
        // biome-ignore lint/nursery/noFloatingPromises: 刻意 fire-and-forget，getTableList 内部已 try/catch
        getTableList();
    };

    return {
        ...toRefs(state),
        getTableList,
        search,
        reset,
        handleSizeChange,
        handleCurrentChange,
        updatedTotalParam,
    };
};
