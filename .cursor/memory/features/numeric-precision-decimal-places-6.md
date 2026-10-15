---
title: 配置中心数值精度 0–6
slug: numeric-precision-decimal-places-6
status: delivered
domain: platform-config
when: 数量/单价/金额小数位上限、配置中心数值精度、库表 scale、与金蝶 6 位对齐
keywords:
  - numeric precision
  - quantity_decimal_places
  - price_decimal_places
  - amount_decimal_places
  - NUMERIC_PRECISION_STORAGE_CEILING
  - decimal_limits
  - 数值精度
  - 0-6
standard: 配置 max=6 + DECIMAL(20,6) + 迁移 888 扩 scale；禁止只改 UI 不改库
---

# 配置中心数值精度 0–6

## 目标

数量、单价、金额小数位可配置范围 **0–6**（默认 2），与常见 ERP（如金蝶）上限对齐；配置值须能真实落库。

## 何时读 / 禁止另起

- 何时读：扩精度上限、改 configTree max、修「配了 5/6 位却存成 4 位」
- 禁止：只改前端 InputNumber max；在业务页硬编码 `toFixed(2|4)`；批量改 Tortoise `decimal_places` 冒充迁移

## 标准入口

| 层 | 标准 |
|----|------|
| FE 配置树 | `configTree.ts` → `common.*_decimal_places` `max: 6` |
| FE 缓存上限 | `NUMERIC_PRECISION_STORAGE_CEILING`（`businessConfig.ts`） |
| FE 输入上限 | `numericFieldLimits.ts` ↔ DECIMAL(20,6) |
| BE 校验 | `business_config_service` parameters max=6 + `get_*_decimal_places(max_places=6)` |
| BE 落库断言 | `core/utils/decimal_limits.py` → `(20, 6)` |
| DB | 迁移 `888_*_numeric_precision_decimal_places_6.py`：scale 4→6 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 配置 UI | `riveredge-frontend/src/pages/system/config-center/configTree.ts` |
| 精度解析 | `riveredge-frontend/src/services/businessConfig.ts` |
| 文案 | `zh-CN` `paramSection.common_numeric_precision*` / `param.common_*_decimal_places_desc` |
| 迁移 | `riveredge-backend/migrations/models/888_20261015200000_numeric_precision_decimal_places_6.py` |

## 扩展点

1. 新数量/单价/金额列：建表即 `NUMERIC(..., 6)`，并走 `assert_quantity` / `assert_price` / `assert_amount`
2. 展示/录入：`formatQuantity` / `formatPrice` / `formatAmount` + `getCachedNumericPrecisionPlaces`
3. 单据合计：见 `document-amount-summary-precision.md`（先乘后按金额位舍入）

## 踩坑

- 配置允许 6 但库仍 scale=4 → 第 5/6 位被截断；必须跑迁移 888
- Tortoise 模型里大量 `decimal_places=4` 可滞后于库表（与当初 2→4 同策略）；真源是迁移 + `decimal_limits`，勿用脚本批量改 model
- 下次再扩上限须同步：configTree / CEILING / BE max / decimal_limits / 新迁移 scale

## 相关

- `features/document-amount-summary-precision.md`
