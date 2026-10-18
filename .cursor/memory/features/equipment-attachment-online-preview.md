---
title: 设备管理附件在线预览
slug: equipment-attachment-online-preview
status: delivered
domain: frontend
when: 改设备/计量器具/模具/工装校准附件展示或「N 个附件」点击预览
keywords:
  - FilePreviewModal
  - DocumentAttachmentsReadonly
  - 计量证书
  - 校准记录
  - 个附件
  - LineAttachmentsUpload
standard: 只读附件统一 DocumentAttachmentsReadonly → FilePreviewModal；列表单元格用 variant=count
---

# 设备管理附件在线预览

## 目标

计量器具校准记录的计量证书（PDF/图片）可在线预览；设备管理模块只读附件同步同一套能力。

## 何时读 / 禁止另起

- 何时读：改校准记录附件列、设备管理详情抽屉附件区、只读「N 个附件」交互
- 禁止：页面自写 window.open 裸 download；另起一套预览 Modal；详情仍用仅图片的 LineAttachmentsUpload 展示 PDF

## 标准入口

| 层 | 标准 |
|----|------|
| 只读列表/详情 | `DocumentAttachmentsReadonly`（`variant="list"` 或 `"count"`）→ `FilePreviewModal` |
| 行级纯照片只读 | `LineAttachmentsUpload` `readOnly`；含非图片时自动改走 `DocumentAttachmentsReadonly` |
| 表单上传 | `DocumentAttachmentsField`（不变） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 只读组件 | `riveredge-frontend/src/apps/kuaizhizao/components/DocumentAttachmentsReadonly.tsx` |
| 行附件 | `riveredge-frontend/src/apps/kuaizhizao/components/LineAttachmentsUpload.tsx` |
| 计量器具详情 | `…/measuring-instruments/detail/index.tsx` |
| 模具详情校准表 | `…/molds/detail/index.tsx` |

## 扩展点

1. 其它业务列表「N 个附件」列：`variant="count"` + `showEmpty`
2. 新校准类详情抽屉：`supplementary` 用 `DocumentAttachmentsReadonly`，勿再只挂 `LineAttachmentsUpload readOnly` 展示证书

## 踩坑

- 校准上传走 `DocumentAttachmentsField`（可 PDF），详情却用 `LineAttachmentsUpload`（picture-card）→ PDF 无法预览；已在 readOnly 分支按扩展名分流
- 多附件 count：先 Popover 选文件再开 `FilePreviewModal`

## 关联

- `principles/reuse-existing-patterns.md`
- `features/funide-oa-drawing-detail-files-section.md`（同 FilePreviewModal）
