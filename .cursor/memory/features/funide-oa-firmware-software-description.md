---
title: 产品固件软件12位编码与软件描述
slug: funide-oa-firmware-software-description
status: delivered
domain: funide-oa
when: 改定制产品固件新建表单的软件编码、软件描述
keywords:
  - software_item_code
  - software_description
  - 软件12位编码
  - 软件描述
  - product-firmwares
standard: 定制页表单半宽并排；编码与描述都写在产品固件主表，经 ProductFirmwareService 归一化后落库
---

# 产品固件软件12位编码与软件描述

## 目标

定制产品固件新建编辑弹窗：软件编码文案为「软件12位编码」，输入框半宽，右侧手工填写「软件描述」，并随单据保存。

## 何时读 / 禁止另起

- 何时读：改 `/apps/funide-oa/product-firmwares` 新建产品固件的编码或描述。
- 禁止：不要另建扩展表，也不要只改展示不写主表。

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `kuaigeyun-custom/frontend/apps/funide-oa/pages/kuaiplm/product-firmwares/index.tsx`，组装副本同步到主仓同路径 |
| BE | `ProductFirmware.software_item_code` / `software_description`，服务 `_normalize_software_item_code` / `_normalize_software_description` |
| 权限 | 沿用 `kuaiplm:product-firmware` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 定制页 | `kuaigeyun-custom/frontend/apps/funide-oa/pages/kuaiplm/product-firmwares/index.tsx` |
| 模型 | `riveredge-backend/src/apps/kuaiplm/models/product_firmware.py` |
| 迁移 | `riveredge-backend/migrations/models/896_20261018210000_product_firmware_software_description.py` |

## 扩展点

1. 编码最长 50，描述最长 200。空串归一为 null。
2. 升版时未传描述则沿用上一版。

## 踩坑

- 编码列曾经是 12 字符，后放宽到 50。文案写「12位」只约束展示，不要把列改回 VARCHAR(12)。
- 定制页真源在定制仓，改完要覆盖主仓组装副本，否则本地页面仍是旧表单。
- 发布日期：新建用 `todaySiteDateString()`，控件 `disabled`；保存时新建强制当天，编辑沿用原值，禁止表单改写。
