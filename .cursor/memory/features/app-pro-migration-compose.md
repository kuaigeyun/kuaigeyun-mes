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
- 财务管理：页面在 `kuaizhizao/pages/finance-management`；菜单路径 `/apps/kuaizhizao/finance-management/*`；轻财务启用后侧栏改挂 kuaicaiwu。接管是否生效只认 `core_applications` 已安装且启用，导航读路径不按本机 manifest 写 `is_active`（见 `features/menu-takeover-single-source.md`）

## 开源主仓

- 系统数据中心四入口（`/system/application-connections|apis|data-sources|datasets`）：`KuaiconnectRouteGate` — 快连接就绪进业务页，否则 `ProUpgradePrompt`（勿再在 SystemRoutes 写死 upgrade 页）
- 无 compose / 未启用未授权：门禁显示升级占位
- 门禁：`riveredge-backend/scripts/scan_pro_oss_layout.py`
- **ORM / 独立启动**：`TORTOISE_ORM` 静态列表只挂开源应用；`kuaicaiwu`/`kuaiplm`/行业等由 `apps/*/orm_models.py` + `plugin_orm.discover_plugin_orm_modules` 合并。宿主禁止模块级 `import apps.kuaicaiwu|kuaiplm|…`（见 `features/oss-pro-decouple-startup.md`）。禁止再硬编码 pro 模型路径，否则未 compose 时 `aerich upgrade` 报 `ModuleNotFoundError`

## 扩展

- 组装后财务 API 仍走 `/apps/kuaicaiwu/*`（须 compose kuaicaiwu 后端）
- 生产带财务/研发：部署前 `compose` 链入 pro，再跑 migrate；纯开源可不 compose，migrate 应能通过
