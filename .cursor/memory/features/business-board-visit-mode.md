---
title: 运营看板参观模式
keywords:
  - 参观模式
  - visit_mode
  - 运营看板
  - business-board-title
  - 手填指标
  - 系统管理员
date: 2026-10-17
---

# 运营看板参观模式

## 何时读

改系统自带运营看板设置、中心球体指标展示、或租户级 `dashboard.business_board_title` 配置时读。

## 标准入口

- 前端页：`riveredge-frontend/src/pages/system/dashboard/analysis/BusinessBoardPage.tsx`
- 前端 API：`riveredge-frontend/src/services/businessBoardTitle.ts`
- 后端：`riveredge-backend/src/core/api/dashboard/business_board_title.py`
- 配置键：`infra_tenant_configs` → `dashboard.business_board_title`

## 行为

- 看板设置弹窗内「参观模式」仅 `is_tenant_admin || is_infra_admin` 可见。
- 开启后 `HudHero` 仅覆盖已填写的 `visit_metrics` 项；`null`/未填项仍走制造/管理实时接口。
- GET 全员可读（开启后参观者也能看到演示数）；PUT 写 `visit_mode` / `visit_metrics` 须系统管理员，否则 403。

## 禁止

- 不要把参观模式入口暴露给普通用户。
- 不要在读侧伪造管理员身份；门控前后端一致。
