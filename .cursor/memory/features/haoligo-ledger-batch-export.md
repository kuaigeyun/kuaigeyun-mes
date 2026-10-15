---
title: 好力 GO 模具/设备台账批量导出
slug: haoligo-ledger-batch-export
status: delivered
domain: dedicated-haoligo
when: 改 haoligo 模具台账、设备台账列表导出 / 导出选中 / 导出全部
keywords:
  - haoligo
  - 模具台账
  - 设备台账
  - showExportButton
  - onExport
  - downloadRecordsAsXlsx
standard: UniTable showExportButton + onExport + fetchAllListItems + downloadRecordsAsXlsx；权限 haoligo:*-ledger:export
---

# 好力 GO 模具/设备台账批量导出

## 目标

模具台账、设备台账列表支持导出选中 / 本页 / 全部（当前筛选），XLSX 下载。

## 何时读 / 禁止另起

- 何时读：haoligo 台账列表加导出或对齐导出列
- 禁止：另起 JSON Blob 下载；不经 UniTable `onExport`；用 `hasPermission` 旁路 `useResourcePermissions`

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `UniTable` `showExportButton={perms.canExport}` + `onExport(type, keys, pageData)` |
| 取全量 | `fetchAllListItems` + 列表当前筛选 ref / snapshot |
| 文件 | `downloadRecordsAsXlsx` |
| 权限 | `useResourcePermissions('haoligo:molds-ledger' \| 'haoligo:equipment-ledger')` → `canExport`（manifest 已有 `:export`） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 设备台账 | `riveredge-frontend/src/apps/haoligo/pages/equipment/ledger/index.tsx` |
| 模具台账 | `riveredge-frontend/src/apps/haoligo/pages/molds/ledger/index.tsx` |
| 参照 | `riveredge-frontend/src/apps/haoligo/pages/finance/supplier-prices/index.tsx` |

## 扩展点

1. 导出列与列表展示字段对齐；设备把类别/车间/厂商 ID 解析成名称与编码
2. 「全部」须带当前筛选，禁止无筛选拉全库
3. 设备台账勾选导出需 `enableRowSelection`；模具台账已有勾选（批量修改共用）

## 踩坑

- HaoliGO 变动**不写** `PLATFORM_UPDATE_LOG_*`（平台更新日志排除定制应用）
- 勾选导出的 `rowKey` 与 filter 用同一字段（此处均为 `id`）
