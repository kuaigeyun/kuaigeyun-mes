---
title: AOCI Safe Inventory 孤儿 Entry
slug: aoci-safe-inventory-orphan
status: active
domain: tooling
when: aoci_maintain blocked、explicit_orphan_remove、773 orphan、check blocked 2230
keywords:
  - orphan
  - gitignore
  - kuaicaiwu
  - scope activate
  - aoci.code.txt
standard: 主仓索引只覆盖 Git 跟踪的 Safe Inventory；gitignore 下 pro 组装目录须清 Entry，认知走 aoci-pro
---

# AOCI Safe Inventory 孤儿 Entry

## 根因

`.gitignore` 排除 `riveredge-backend/src/apps/kuaicaiwu/`、`kuaiplm/` 等 **pro/组装应用** 路径。磁盘可有 compose 源码，但 **Safe Inventory v2 不进 Git 跟踪** → 索引里若仍有这些文件的 Entry，治理报 **orphan**，`aoci_maintain` **blocked**（`candidates: []`）。

## 标准处置（无需 scope TTY 时）

1. `aoci check --json` → 取 `governance.code_drift.orphan` 列表（与 missing 不交叠）。
2. 按 **section 路径 + 条目文件名** 从 `aoci.code.txt` 删除对应行（勿手改 900 条 stale；只清 orphan）。
3. 更新 `.aoci/baseline.json` 中 `aoci.code.txt` 的 `sha256` / `size` / `normalized_sha256`（与磁盘文件一致）。
4. 验收：`orphan` 为 0；`aoci_maintain` 返回 `authoring_required` 且带 `candidates`。

`aoci scope activate` + 人工 TTY 审批可一次性 `index_removed`，但 **802 覆盖缩减** 会触发 `APPLY MANAGED SCOPE …` 确认；Agent 环境通常无法代批。

## 禁止

- 对 orphan 路径逐条 `remove-entry` 当批量方案（慢；且 `__init__.py[XC1T]` 重复行会 **重复污染** 拒绝删）。
- 以为「本机有快财务源码」就必须进 **主仓** `aoci.code.txt`（应 **aoci-pro** / 对应私有仓）。

## 关联

- `features/aoci-mcp-three-repos.md`
- `principles/aoci-git-commit.md`
- 规则 `model-audit-write.mdc`（组织主数据审计写路径）
