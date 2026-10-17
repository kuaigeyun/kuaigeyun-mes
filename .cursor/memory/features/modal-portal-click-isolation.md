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
| 全局 Dialog 注入 | `riveredge-frontend/src/patches/isolatedRcDialog.tsx`（vite alias `@rc-component/dialog`） |
| 工具 | `riveredge-frontend/src/utils/modalEventIsolation.ts`（`MODAL_ISOLATE_POINTER_PROPS` / `mergeOverlayIsolateProps`） |
| 遮罩可点 | `riveredge-frontend/src/global.less` → `.ant-modal-mask { pointer-events: auto }` |
| 单页补强（可选） | Modal 上传 `maskProps` / `wrapProps` 展开 `MODAL_ISOLATE_POINTER_PROPS` |

## 根因

1. antd 6 默认 mask `pointer-events: none`，遮罩仅视觉。
2. Portal 挂到 body 后，React 树仍向打开弹层的父节点（常为表格行）冒泡。

## 踩坑

- `wrapProps.onClick` 会盖掉 rc-dialog 内部 `maskClosable` 的 wrap onClick；全局 patch 已按 `e.target === e.currentTarget` 补回关闭。
- vite `optimizeDeps.exclude` 须含 `@rc-component/dialog`，避免预构建绕过 alias。
- 子路径 `@rc-component/dialog/es/DialogWrap` 不走 alias，供 patch 引用原实现。
