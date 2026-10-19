---
title: Modal Portal 点击隔离（防穿透）
keywords:
  - Modal
  - 点击穿透
  - portal
  - maskProps
  - wrapProps
  - MODAL_ISOLATE_POINTER_PROPS
  - isolatedRcDialog
  - pointer-events
---

## 何时读

弹出 Modal 后点击仍点到下层列表/行选中；或新写 Modal 需确认全局隔离是否已覆盖。

## 禁止另起

禁止再为单页发明第二套「遮罩 pointer-events / document 捕获」旁路；统一走本笔记入口。

## 标准入口

| 层 | 路径 |
|----|------|
| 工具 | `riveredge-frontend/src/utils/modalEventIsolation.ts`（`MODAL_ISOLATE_POINTER_PROPS` / `mergeOverlayIsolateProps`） |
| 遮罩可点 | `riveredge-frontend/src/global.less` → `.ant-modal-mask { pointer-events: auto }` |
| 单页必传 | Modal 上传 `maskProps` / `wrapProps` 展开 `MODAL_ISOLATE_POINTER_PROPS`（FormModalTemplate / UniAuditModal 已带） |

## 根因

1. antd 6 默认 mask `pointer-events: none`，遮罩仅视觉。
2. Portal 挂到 body 后，React 树仍向打开弹层的父节点（常为表格行）冒泡。

## 踩坑

- **禁止**用 vite alias 替换 `@rc-component/dialog` 做全局注入：与 antd 预构建交织会拖慢/卡死首屏模块图，看门狗 15s 误报白屏。
- `wrapProps.onClick` 会盖掉 rc-dialog 内部 `maskClosable` 的 wrap onClick；合并时需自行补 `e.target === e.currentTarget` 关闭，或只用 `stopPropagation` 不覆盖业务 onClick。
