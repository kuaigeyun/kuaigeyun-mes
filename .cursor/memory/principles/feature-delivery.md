---
title: 新功能交付：迁移 + 菜单同步
slug: feature-delivery
status: active
domain: principle
when: 加菜单、权限、新表、新模块、改 manifest
keywords:
  - aerich
  - manifest
  - sync-manifest
  - 权限码
  - module_references
  - platformUpdateLog
  - 死代码
  - 交付自检
standard: 当场 upgrade + 当场 sync；用户可见改动补更新日志；死代码仅 diff 内可选自检且不阻塞推送
---

# 新功能交付：迁移 + 菜单同步

- 写入：2026-10-03；2026-10-13 补死代码交付自检
- 同步规则：`.cursor/rules/feature-delivery-checklist.mdc`（alwaysApply）
- 细节以规则全文为准，本篇只作检索摘要。

## 原则

代码合入不等于可用。有新 model / 菜单 / 权限时，必须在本环境做完迁移和菜单同步。

## 动手前 / 交付时

1. 新表：aerich 迁移 + `orm_models` 注册；Windows 用 UTF-8 跑 `aerich upgrade`
2. 改 `manifest.json`：前后端两份一起改；当场单应用 sync，不要只说「请点菜单同步」
3. 新权限码写入 manifest `permissions`；跨模块引用走 `module_references`
4. 前端：路由、懒加载、zh-CN；列表导入传 `importHeaders` 等有效字段；状态列传 `statusEnum`
5. 用户可见的功能/修复/改进：在 `platformUpdateLog.ts`（或定制 `platformUpdateLogDedicated.ts`）数组头部插一条，并写 zh-CN `pages.dashboard.updateLog.entries.{id}.*`。细则：`features/platform-update-log.md`
6. **多端改动**：更新 `principles/three-repo-map.md` 落点行，或新 feature 并链回总表；单端内部改动可跳过
7. **死代码（可选）**：只看本次触及文件里明显未用 import / 死分支 / 已替换旧块，有把握再删；**不阻塞**构建推送，不做全仓扫描

## 禁止

- 交付说明里默认假设用户会去点「一键同步全部」
- 只改前端或只改后端一份 manifest
- 用无效的整包 `importTemplate` 冒充导入模板
- 把死代码全仓清理绑进 `build.web.sh` / 「构建推送」门禁

## 关联

- `.cursor/rules/feature-delivery-checklist.mdc`
- `principles/three-repo-map.md`
- `principles/code-push-routing.md`（推送不含死代码门禁）
- `features/platform-update-log.md`
- `features/fast-deploy-scripts.md`（`deploy.sh` 的 migrate）
- `principles/reuse-existing-patterns.md`
