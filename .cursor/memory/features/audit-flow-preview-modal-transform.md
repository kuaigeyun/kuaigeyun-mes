---
title: 审核弹窗流程预览连线偏移（Modal transform）
slug: audit-flow-preview-modal-transform
status: delivered
domain: approval
when: 审核/撤销弹窗左侧流程图连线与节点错位、生产偏移本地正常
keywords:
  - ApprovalFlowPreview
  - UniAuditModal
  - React Flow
  - transform
  - fitView
  - updateNodeInternals
standard: 审核弹窗禁用 zoom；afterOpenChange 后再挂载预览；fit 前 updateNodeInternals
---

# 审核弹窗流程预览连线偏移

## 目标

审核弹窗左侧 `ApprovalFlowPreview` 连线贴合节点，本地与生产一致。

## 何时读 / 禁止另起

- 何时读：报「流程预览偏移 / 连线悬空 / 生产才坏」
- 禁止：用 `setTimeout` 碰运气重 fit；给 `.react-flow__viewport` 加 `overflow` 改坐标系；再写第二套预览组件

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `UniAuditModal` + `ApprovalFlowPreview` |
| 布局 | `utils/approvalFlowLayout.ts` + `UniFlowNode` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 弹窗 | `riveredge-frontend/src/components/uni-audit/UniAuditModal.tsx` |
| 预览 | `riveredge-frontend/src/components/uni-audit/ApprovalFlowPreview.tsx` |
| 排版 | `riveredge-frontend/src/utils/approvalFlowLayout.ts` |

## 根因

antd Modal 默认 `zoom` 进场动画给 `.ant-modal` 加 `transform`。React Flow 在动画未结束时测量手柄，连线坐标系永久偏移。生产取数更快，更易在 zoom 期间完成首次测量；本地常因接口更慢而「碰巧正常」。

## 正确修法

1. `transitionName=""` 关掉审核弹窗 zoom
2. `afterOpenChange` 置 `flowCanvasReady` 后再挂载 `ApprovalFlowPreview`
3. `fitView` 前 `updateNodeInternals`

## 踩坑

- 禁止改 `.react-flow__viewport { overflow }`（曾导致连线与节点错位）
- 节点禁止 `filter`/`transform`（见 `UniFlowNode` 注释）
