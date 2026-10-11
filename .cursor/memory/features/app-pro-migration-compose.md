---
title: APP 转 PRO 与 compose
slug: app-pro-migration-compose
status: active
domain: feature
when: 改快交付/快研发/轻财务/轻办公、行业包、数据中心、PRO 占位、财务管理托管
keywords:
  - PRO_ENABLED
  - kuaigeyun-pro
  - pro_app_catalog
  - menu_takeover
  - finance-management
  - kuaiconnect
standard: 真源在 pro 仓；主仓 gitignore + 占位；`scan_pro_oss_layout.py`
---

# APP 转 PRO 与 compose

## 真源

- 私仓：`f:/dev/kuaigeyun-pro`（backend/apps、frontend/apps）
- 主仓：`PRO_ENABLED=1` + `fast-deploy/tools/workspace/compose.py` junction

## 目录

- 专业 APP 清单：`pro_app_catalog.py` / `proAppCatalog.ts`（含 kuaipd、kuaiplm、kuaicaiwu、kuaioa、kuaiconnect）
- 行业：原免费 `ind-*` 已并入 `PRO_INDUSTRY_APP_CODES`
- 财务管理：页面在 `kuaizhizao/pages/finance-management`；菜单路径 `/apps/kuaizhizao/finance-management/*`；轻财务 `menu_takeover`

## 开源主仓

- 系统数据中心四入口（`/system/application-connections|apis|data-sources|datasets`）：`KuaiconnectRouteGate` — 快连接就绪进业务页，否则 `ProUpgradePrompt`（勿再在 SystemRoutes 写死 upgrade 页）
- 无 compose / 未启用未授权：门禁显示升级占位
- 门禁：`riveredge-backend/scripts/scan_pro_oss_layout.py`

## 扩展

- 组装后财务 API 仍走 `/apps/kuaicaiwu/*`（须 compose kuaicaiwu 后端）
