/**
 * v-copy
 * 复制某个值至剪贴板
 * 接收参数：string类型/Ref<string>类型/Reactive<string>类型
 */

import { ElMessage } from "element-plus";
import type { Directive, DirectiveBinding } from "vue";

interface ElType extends HTMLElement {
    copyData: string | number;
    handleClick: EventListener;
}
const copy: Directive = {
    mounted(el: ElType, binding: DirectiveBinding) {
        el.copyData = binding.value;
        el.addEventListener("click", handleClick);
    },
    updated(el: ElType, binding: DirectiveBinding) {
        el.copyData = binding.value;
    },
    beforeUnmount(el: ElType) {
        el.removeEventListener("click", el.handleClick);
    },
};

async function handleClick(this: ElType) {
    try {
        await navigator.clipboard.writeText(String(this.copyData));
    } catch (_err) {
        ElMessage.warning("复制操作不被支持或失败，请手动复制");
    }
    ElMessage({
        type: "success",
        message: "复制成功",
    });
}

export default copy;
