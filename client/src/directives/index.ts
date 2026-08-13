import type { App, Directive } from "vue";
import auth from "./modules/auth";
import copy from "./modules/copy";
import debounce from "./modules/debounce";
import draggable from "./modules/draggable";
import longpress from "./modules/longpress";
import throttle from "./modules/throttle";
import waterMarker from "./modules/waterMarker";

const directivesList: { [key: string]: Directive } = {
    auth,
    copy,
    waterMarker,
    draggable,
    debounce,
    throttle,
    longpress,
};

const directives = {
    install: (app: App<Element>) => {
        for (const key of Object.keys(directivesList)) {
            const directive = directivesList[key];
            if (directive) app.directive(key, directive);
        }
    },
};

export default directives;
