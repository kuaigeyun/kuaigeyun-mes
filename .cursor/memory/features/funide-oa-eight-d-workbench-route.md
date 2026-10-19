---
title: 客诉 8D 工作台路由须手挂
slug: funide-oa-eight-d-workbench-route
status: delivered
domain: funide-oa
when: 改 funide-oa 客诉 8D 列表/工作台跳转；点「工作台」落到应用首页或系统工作台
keywords:
  - eight-d-reports
  - EightDWorkbench
  - funide-oa
  - 客诉 8D
  - routes.host-mirror
standard: 列表 navigate 到 `/apps/funide-oa/quality-management/eight-d-reports/:id`；`:id` 在 funide-oa/index.tsx 手挂，勿只靠 host-mirror 列表路由。
---

# 客诉 8D 工作台路由须手挂

## 目标

定制应用「客诉 8D」列表点「工作台」进入该报告的 8D 阶段办理页，而不是被 `path="*"` 重定向到应用首页。

## 何时读 / 禁止另起

- 何时读：funide-oa 客诉 8D、质量投诉跳 8D、host-mirror 生成路由缺详情页。
- 禁止：只改 kuaizhizao 通用 8D；在 catch-all 上叠兼容跳转。

## 标准入口

| 层 | 标准 |
|----|------|
| FE 列表 | `funide-oa/pages/.../eight-d-reports/index.tsx` → `WORKBENCH_PATH/${id}` |
| FE 工作台 | `.../eight-d-reports/workbench/EightDWorkbench.tsx` |
| 路由 | `funide-oa/index.tsx` 手挂 `quality-management/eight-d-reports/:id`（`:id` 在列表路由之前） |
| 源仓 | `kuaigeyun-custom`（compose 进主仓 `src/apps/funide-oa`） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 路由手挂 | `kuaigeyun-custom/frontend/apps/funide-oa/index.tsx` |
| host-mirror（仅列表） | `.../routes.host-mirror.generated.tsx` |
| 工作台页 | `.../eight-d-reports/workbench/EightDWorkbench.tsx` |

## 扩展点

1. host-mirror 若日后能扫出 `workbench` → `:id`，仍保留 index 手挂或改为生成，勿双路径分叉。
2. 权限仍 `kuaizhizao:quality-management-eight-d-reports:*`。

## 踩坑

- host-mirror 只生成列表 `eight-d-reports`，无 `:id` → 未匹配进 `Navigate to="/apps/funide-oa"`，用户感觉像跳到系统/应用工作台。
- 通用 kuaizhizao 已有 `:id` 路由；定制副本必须各自注册。

## 关联

- `.cursor/skills/dedicated-page-split/SKILL.md`
- `features/platform-update-log.md`（dedicated `funide-oa-eight-d-workbench-route-r01`）
