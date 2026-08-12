import { computed, ref } from "vue";

/**
 * 通用分页 composable（支持总数模式）
 * @param defaultPageSize 默认每页条数
 */
export function usePagination(defaultPageSize = 20) {
    const 页 = ref(1);
    const pageSize = ref(defaultPageSize);
    const 总数 = ref(0);
    const dataLength = ref(0);

    /** 总数未知时用 dataLength 推断；总数已知用总数计算 */
    const hasNext = computed(() =>
        总数.value > 0
            ? 页.value * pageSize.value < 总数.value
            : dataLength.value >= pageSize.value,
    );
    const 总页数 = computed(() => (总数.value > 0 ? Math.ceil(总数.value / pageSize.value) : 0));

    const setDataLength = (len: number) => {
        dataLength.value = len;
    };

    const set总数 = (t: number) => {
        总数.value = t;
    };

    const 跳转到 = (p: number, loadFn: () => void) => {
        if (p >= 1 && p <= (总页数.value || 9999)) {
            页.value = p;
            loadFn();
        }
    };

    const prev = (loadFn: () => void) => {
        if (页.value > 1) {
            页.value--;
            loadFn();
        }
    };

    const next = (loadFn: () => void) => {
        页.value++;
        loadFn();
    };

    const reset = (loadFn: () => void) => {
        页.value = 1;
        loadFn();
    };

    return {
        页,
        pageSize,
        总数,
        总页数,
        hasNext,
        prev,
        next,
        reset,
        跳转到,
        setDataLength,
        set总数,
    };
}
