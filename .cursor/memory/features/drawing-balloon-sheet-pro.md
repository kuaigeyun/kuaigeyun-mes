---
title: 图纸气泡标注 PRO 独立单据
keywords:
  - drawing_balloon_sheet
  - drawing_balloon_annotation
  - BalloonSheetEditor
  - quality-management-drawing-balloon-sheets
  - FAI import-from-balloon-sheet
when: 改图纸气泡 OCR、首件导入特性、PRO 门控或菜单 sort 8
---

## 标准入口

- **列表**：`riveredge-frontend/.../drawing-balloon-sheets/index.tsx`，权限 `kuaizhizao:quality-management-drawing-balloon-sheets`
  - UniTable 壳：`permissionResource`、`showCreateButton`、`createButtonText`「新建气泡标注」、`onTableDataChange` 写行缓存、批量删仅 draft；列序含 `sheet_code` rank。见 `principles/new-pc-page-hard-gate.md`
- **编辑器**：`.../drawing-balloon-sheets/editor.tsx` + `BalloonSheetEditor.tsx`
- **API**：`drawing-balloon-sheet.ts` → `/apps/kuaizhizao/drawing-balloon-sheets/*`（OCR 用 `:execute`）
- **后端服务**：`drawing_balloon_sheet_service.py`；PRO 码 `drawing_balloon_annotation`（`BusinessConfigService.PRO_FEATURES`）
- **首件衔接**：`POST /fai-orders/{id}/import-from-balloon-sheet`（仅已确认 sheet lines）

## 禁止

- 在 FAI 单上继续写 `balloon-ocr` / `balloon-candidates` / `confirm-balloons`（已移除）
- 首件列表 `request` 里用 FAI 头字段冒充独立气泡列表

## 菜单

- kuaiqms manifest：质量巡检 sort 7 后，图纸气泡标注 sort 8，`meta.is_pro: true`
- 侧栏 PRO 徽标：`BasicLayout` `menuTextRender` 读 `meta.is_pro`；角标 key `drawing_balloon_sheet`

## 迁移

- `871_20261013100000_drawing_balloon_sheets.py`：建表 + 编码规则 + 从 FAI 回填（`linked_fai_order_id`）

## 旧路由

- `/fai-orders/:id/balloon` → `balloon.tsx` 查 `by-fai-order` 后跳转 editor 或列表
