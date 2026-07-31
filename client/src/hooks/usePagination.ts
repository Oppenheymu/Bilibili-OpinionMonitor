import { computed, ref, type Ref } from "vue";

/**
 * 通用分页 composable
 * @param pageSize 每页条数
 */
export function usePagination(pageSize = 20) {
  const 页 = ref(1);
  const dataLength = ref(0);

  const hasNext = computed(() => dataLength.value >= pageSize);

  const setDataLength = (len: number) => {
    dataLength.value = len;
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

  return { 页, pageSize, hasNext, prev, next, reset, setDataLength };
}
