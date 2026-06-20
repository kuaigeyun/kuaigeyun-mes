# 销售模块按钮文案契约（阶段 0）

适用范围：`riveredge-frontend/src/apps/kuaizhizao/pages/sales-management`

## 核心动作统一词

- 详情
- 编辑
- 删除
- 提交
- 撤回提交
- 审核
- 撤销审核
- 打印

## 执行规则

- 行内按钮必须优先使用 `rowActionKind` + 统一词条，不手写同义词。
- 审核流按钮统一由 `UniWorkflowActions` / `UniAuditActions` 渲染，不在页面手写「审核通过/撤回审核」。
- 批量审核菜单统一使用 `UniAuditBatchMenuButton` 文案口径：
  - `批量提交 / 批量撤回提交 / 批量审核 / 批量撤销审核`
- 打印入口策略（销售模块）：
  - 列表行内不显示打印；
  - 统一放在 `UniTable` 功能区；
  - 详情抽屉顶部保留打印，且顺序在最后一个。

## 单选 / 多选文案规则

- 同一个能力按钮，单选和多选必须动态切换文案：
  - 单选：`认领` / `分配`
  - 多选：`批量认领` / `批量分配`
- 能力按钮使用 `UniCapabilityBatchButton` 时，必须配置 `labels.single` 与 `labels.batch`。
