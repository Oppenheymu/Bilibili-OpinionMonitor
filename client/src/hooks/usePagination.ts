import { computed, ref } from "vue";

/**
 * 通用分页 composable（支持总数模式）
 * @param defaultPageSize 默认每页条数
 */
export function usePagination(defaultPageSize = 20) {
    const page = ref(1);
    const pageSize = ref(defaultPageSize);
    const total = ref(0);
    const dataLength = ref(0);

    /** 总数未知时用 dataLength 推断；总数已知用总数计算 */
    const hasNext = computed(() =>
        total.value > 0
            ? page.value * pageSize.value < total.value
            : dataLength.value >= pageSize.value,
    );
    const totalPages = computed(() =>
        total.value > 0 ? Math.ceil(total.value / pageSize.value) : 0,
    );

    const setDataLength = (len: number) => {
        dataLength.value = len;
    };

    const setTotal = (t: number) => {
        total.value = t;
    };

    const jumpTo = (p: number, loadFn: () => void) => {
        if (p >= 1 && p <= (totalPages.value || 9999)) {
            page.value = p;
            loadFn();
        }
    };

    const prev = (loadFn: () => void) => {
        if (page.value > 1) {
            page.value--;
            loadFn();
        }
    };

    const next = (loadFn: () => void) => {
        page.value++;
        loadFn();
    };

    const reset = (loadFn: () => void) => {
        page.value = 1;
        loadFn();
    };

    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        prev,
        next,
        reset,
        jumpTo,
        setDataLength,
        setTotal,
    };
}
