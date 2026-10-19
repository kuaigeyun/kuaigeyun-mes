---
title: 定制工程图纸详情图纸文件板块
slug: funide-oa-drawing-detail-files-section
status: delivered
domain: frontend
when: 改 funide-oa 工程图纸详情抽屉的主文件/附加文件展示或预览
keywords:
  - funide-oa
  - drawings
  - 图纸文件
  - afterBasic
  - FilePreviewModal
  - openDetailFilePreview
standard: 主文件/附加文件走 afterBasic「图纸文件」板块；点击用 openDetailFilePreview → FilePreviewModal
---

# 定制工程图纸详情图纸文件板块

## 目标

定制应用工程图纸详情中，主文件与附加文件不再塞在「基本信息」里，独立成「图纸文件」板块；点击文件名直接弹出预览组件。

## 何时读 / 禁止另起

- 何时读：改 funide-oa `pages/master-data/process/drawings` 详情抽屉文件区
- 禁止：在详情里复用列表的 `openPreview`（内联预览模式下只会改侧栏、不弹 Modal）；不要把主文件塞回 basic Descriptions

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `ProcessMasterDetailDrawer` 的 `afterBasic` / `afterBasicTitle` → `DetailDrawerTemplate.afterBasic` |
| 预览 | `openDetailFilePreview` → `FilePreviewModal`（`previewOpen \|\| largePreviewOpen`） |
| 权限 | 仍 `master-data:process:drawing`，不另开权限 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 定制页 | `riveredge-frontend/src/apps/funide-oa/pages/master-data/process/drawings/index.tsx` |
| 工艺详情壳 | `riveredge-frontend/src/apps/master-data/pages/process/shared/processMasterDetailDrawer.tsx` |
| 抽屉模板 | `riveredge-frontend/src/components/layout-templates/DetailDrawerTemplate.tsx` |

## 扩展点

1. 通用 master-data 图纸页若要对齐同一 UX，同样接 `afterBasic`，勿只改宿主再 export 定制
2. STEP 导 BOM 按钮仍挂在主文件下方

## 踩坑

- 列表 `openPreview` 在 `showInlinePreview` 时只 `setInlinePreviewFile`，详情点击必须 `setPreviewOpen` + `setLargePreviewOpen`
- Modal 取文件：`previewOpen && previewFile` 优先，否则用 `inlinePreviewFile`（大图预览按钮）
