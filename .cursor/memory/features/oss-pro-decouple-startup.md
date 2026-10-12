---
title: 开源仓无专业包可独立启动
slug: oss-pro-decouple-startup
status: delivered
domain: deploy
when: 开源 Docker 无 pro 崩溃、No module named apps.kuaicaiwu、迁移 infra_license_keys、业务蓝图 tab=graph
keywords:
  - kuaicaiwu
  - kuaiplm
  - infra_license_keys
  - optional_pro
  - discover_plugin_orm_modules
  - IKKZ4P
  - IKL5HM
  - sales-orders
  - purchase-orders
standard: 宿主禁止模块级 import pro；ORM 仅 discover 并入；857 表存在性保护；列表财务增强走 optional_pro
---

# 开源仓无专业包可独立启动

## 目标

主仓 `develop` 仅开源应用时，后端可完成迁移与路由注册，不依赖 compose `kuaigeyun-pro`。

## 何时读 / 禁止另起

- 何时读：Issue 开源版脱离专业包无法启动；新增宿主对财务/PLM 的引用
- 禁止：在 `kuaizhizao`/`master_data`/`core` 顶层硬 `import apps.kuaicaiwu|kuaiplm|kuaioa|kuaipd`；在 `TORTOISE_ORM` 静态列表硬编码 pro 模型

## 标准入口

| 层 | 标准 |
|----|------|
| 可选导入 | `apps.common.optional_pro`（`import_pro_module` / `pro_app_available`） |
| 工程变更审核 | 真源 `master_data.services.engineering_change_audit`；kuaiplm 仅 re-export |
| ORM | `plugin_orm.discover_plugin_orm_modules`；ImportError 跳过；`database.py` 不硬编码 pro |
| 迁移 857 | `infra_license_keys` 表存在才 UPDATE |
| 上线向导 | `blueprint_config.jump_path` → `/system/config-center?tab=audit` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 可选导入 | `riveredge-backend/src/apps/common/optional_pro.py` |
| ORM 发现 | `riveredge-backend/src/infra/infrastructure/database/plugin_orm.py` |
| TORTOISE | `riveredge-backend/src/infra/infrastructure/database/database.py` |
| 迁移 | `migrations/models/857_20261011164500_rename_pro_data_center_to_kuaiconnect.py` |
| Issue | Gitee `IKKZ4P` |

## 扩展点

1. 宿主新依赖专业包能力：函数内 `import_pro_*`，缺包抛 `BusinessLogicError` 或分支 `pro_app_available` 跳过只读关联
2. 新专业包 ORM：只写该应用 `orm_models.py`，勿改静态 TORTOISE 列表

## 踩坑

- 仅去掉业务 import 不够：静态 `TORTOISE_ORM` 仍会在冷启动 import 缺失包
- `discover_plugin_orm_modules` 曾对 ImportError `raise`，compose 残缺时拖垮 database 初始化
- 本机有 junction 时「目录存在但 import 被挡」与「开源 zip 无目录」路径不同，须两处都过

## 列表运行时（IKL5HM）

启动成功后，销售/采购订单 **list** 仍可能因函数内硬 `import apps.kuaicaiwu` 返回 500。

| 路径 | 处理 |
|------|------|
| 销售列表开票余额 | `pro_app_available` 后 `import_pro_attr(SalesInvoiceService)`；无包则余量为 0 |
| 采购列表进项阻断 | enricher `_purchase_order_invoice_by_ids` 无包则全 True（阻断下推发票） |
| 月结定价辅助 | 真源 `kuaizhizao.utils.price_settlement_helpers`；kuaicaiwu re-export |
| 提交/审核预收预付 | 无包跳过 hooks；下推发票/预收仍 `import_pro_*`（缺包明确报错） |

## 关联

- `features/app-pro-migration-compose.md`
- Gitee issue IKKZ4P / IKL5HM
