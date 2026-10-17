/**
 * @deprecated 勿再经 vite alias 挂接本文件。
 *
 * 曾用 alias 替换 `@rc-component/dialog` 做全局 Portal 点击隔离，
 * 与 antd 预构建图交织后会拖慢/卡死首屏模块图，导致看门狗误报白屏。
 *
 * 标准做法见 `utils/modalEventIsolation.ts`：
 * - 单页 Modal：`maskProps` / `wrapProps` = `MODAL_ISOLATE_POINTER_PROPS`
 * - 全局遮罩可点：`global.less` `.ant-modal-mask { pointer-events: auto }`
 */
export {};
