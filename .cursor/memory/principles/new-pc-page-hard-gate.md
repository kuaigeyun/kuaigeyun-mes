---
title: 新建 PC 页硬门禁（禁止等用户提醒）
keywords:
  - new-document-page
  - showCreateButton
  - UniTable
  - 新建XXX
  - permissionResource
  - onTableDataChange
when: 任何新建或大幅补全 PC 业务列表/单据页、质检/主数据/设置类 UniTable 页
---

## 硬门禁（写第一行 JSX 之前）

1. **读 Skill**：`.cursor/skills/new-document-page/SKILL.md`（全篇勾一遍，不是扫一眼）。
2. **AOCI**：`aoci_search keyword=new-document-page` 或 `keyword=UniTable` 命中 Skill 条目后再写壳。
3. **抄样板**：同类型最近页（单据→报价单/销售合同；主数据→收支类别/固定资产类别；质检→同模块已规范列表）。

**禁止**：先堆业务 API/编辑器路由，最后再「补列表工具栏」——必漏 `showCreateButton`、行缓存、权限 resource。

## UniTable 壳（缺任一项 = 未交付）

| 项 | 真源 |
|---|---|
| 权限 | `permissionResource` = manifest 模块 resource |
| 新建 | `showCreateButton` + `createButtonText`「新建XXX」+ `onCreate`（**默认 false，仅 onCreate 无效**） |
| 行缓存 | `onTableDataChange` → ref；**禁止**在 `request` 写 `tableRowsRef` |
| 批量 | `enableRowSelection`；删/批按 `canDelete` 与业务状态门控 |
| 列 | `alignProColumns` + rank；状态 `lifecycle` 右固定；`columnPersistenceId` bump |

## 血泪（2026-10-13 气泡标注）

- 列表能打开但无新建：未设 `showCreateButton`。
- `withSingleNewShortcutHint` 包整页 → `label.replace is not a function`；快捷键 hint 只包 `createButtonText`。
- 隐藏列 builder 漏传 `t` → 列表白屏。

## i18n（备注血泪）

- 备注标签：**只用** `t('common.remark')`（zh-CN 已有「备注」）。
- **禁止** `common.remarks`（不存在，界面会露出 key 原文）。
- 交页前：`cd riveredge-frontend && python scripts/scan_forbidden_i18n_keys.py --fail-on high`

## 交付

- zh-CN「新建XXX」、manifest 权限、更新日志（用户可见时）。
- 功能笔记：若新模块，更新 `features/<slug>.md` + `README.md` 路由表。
