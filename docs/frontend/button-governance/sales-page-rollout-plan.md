# 销售模块逐页面治理顺序与验收清单

## 推进顺序

1. 客户池 `customer-pool`
2. 报价单 `quotations`
3. 销售订单 `sales-orders`
4. 销售合同 `sales-contracts`
5. 销售预测 `sales-forecasts`
6. 销售退货 `sales-returns`
7. 发货通知 `shipment-notices`
8. 销售变更 `sales-order-changes`
9. 客户跟进 `customer-follow-ups`

## 每页验收清单

- 按钮文案是否只使用契约词：详情/编辑/删除/提交/撤回提交/审核/撤销审核/打印。
- 行操作是否仅保留该页必须的高频动作，低频动作收敛到功能区或菜单。
- `UniTable` 功能区是否具备批量能力，且文案单选/多选自动切换。
- 详情抽屉顶部操作区是否与列表能力一致，且打印按钮在最后一个。
- 权限与能力门控是否统一走 `capabilities + ResourcePermissionGates`，不出现手写旁路。
- 审核动作是否仅由 `UniWorkflowActions`/`UniAuditActions` 提供，不重复手写。

## 客户池样板规则（先文案后位置）

- 认领/分配：
  - 单选：显示 `认领` / `分配`
  - 多选：显示 `批量认领` / `批量分配`
- 列表行内仅保留记录级动作；批量动作进入 `UniTable` 工具栏。
- 与审核无关页面不引入审核术语按钮，避免概念污染。
