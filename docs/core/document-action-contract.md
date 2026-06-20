# 单据动作契约（Capabilities 层）

在 [permission-contract.md](./permission-contract.md) 与 [permission-responsibility.md](./permission-responsibility.md) 之上，新增 **业务态 capabilities** 层，回答「单据当前状态是否允许某动作」。

## 分层

| 层 | 回答 | 唯一真源 | 前端 |
|----|------|----------|------|
| RBAC | 用户有没有权限 | manifest + `useResourcePermissions` | `canRead` / `canUpdate` / `canAction` |
| **Capabilities** | 单据状态是否允许 | 后端 `document_action_policy` | `record.capabilities.*` |
| DataScope | 能否看到该行 | `DataScopeService` | 不变 |
| Audit workflow | submit/approve/… | `audit_phase.py` + `record.audit` | `UniWorkflowActions` |

**按钮最终可用** = `capabilities.xxx.allowed && RBAC`（由 `useQuotationCapabilities` 等 hook 合成 `disabled`）。

## 后端约定

1. 每个试点单据在 `apps/kuaizhizao/services/document_action_policy/` 实现 `derive_*_capabilities`。
2. list/detail 响应 schema 含 `capabilities` 字段，由 enricher 注入。
3. Service 执行动作前 **必须** 调用 `assert_*_capability`，禁止在 service 内再写平行 `status ==` 门禁（policy 模块自身除外）。
4. `next_step_suggestions` 由 capabilities 派生，禁止 lifecycle 与按钮各写一套。

### Capability 结构

```python
class ActionCapability(BaseModel):
    allowed: bool
    reason: str | None  # 稳定码，如 quotation.delete.not_allowed
```

## 前端约定

1. 禁止页面内 `canXxxQuotation` 类业务门控；读 `record.capabilities` + `useQuotationCapabilities`。
2. 审核按钮继续用 `UniWorkflowActions` + `record.audit`，不重复实现审核门控。
3. `disabled = !capabilities.allowed || !RBAC`。

## 试点范围

| Phase | 单据 | policy 模块 | 状态 |
|-------|------|-------------|------|
| 1 | 报价单 | `quotation.py` | 已完成 |
| 2 | 销售订单 | `sales_order.py` | 已完成 |
| 3 | 销售变更单 | `sales_order_change.py` | 已完成 |
| 3 | 销售合同 | `sales_contract.py` | 已完成 |
| 4 | 销售预测 | `sales_forecast.py` | 已完成 |
| 5 | 发货通知 | `shipment_notice.py` | 已完成 |
| 6 | 销售退货 | `sales_return.py` | 已完成 |

审核类动作（submit/approve/reject/withdraw）在 capabilities 中表达**业务态是否允许**；行级审核按钮以 `UniWorkflowActions` + `record.audit` 为门控，并与 capabilities 合成 disabled。

### 批量审核操作（与行级对称）

| 层 | 约定 |
|----|------|
| UI 组件 | `UniAuditBatchMenuButton`（`components/uni-batch`），内部挂 `UniBatchMenuButton` |
| 业务门控 | `record.capabilities`：`submit` / `withdraw_submit` / `approve` / `revoke_approval` |
| RBAC | `submit`→`canAction('submit')`；撤回/反审→`canAction('revoke')`；审核→`canAction('audit')` |
| 执行 | 无 bulk API 时组件内逐条调用页面传入的 `handlers`；有 bulk API 时传 `bulkHandlers` |
| 文案 | 默认 `components.uniBatch.audit.*`，禁止每页再写一套 batchSubmit/batchWithdraw |

**菜单语义（固定，禁止用 `withdraw` 冒充反审核）**：

| 菜单 key | 含义 | capability | RBAC |
|----------|------|------------|------|
| `submit` | 批量提交 | `submit` | `submit` |
| `withdraw` | 批量撤回**提交** | `withdraw_submit` | `revoke` |
| `approve` | 批量审核通过 | `approve` | `audit` |
| `revoke` | 批量**反审核** | `revoke_approval` | `revoke` |

页面仅在 `handlers` / `bulkHandlers` 中声明该单据**实际存在**的动作；无 `withdraw_submit` 能力时不传 `withdraw` handler 即可。

**禁止**：各列表页手写四套 `handleBatchSubmit` + 独立 i18n；禁止 `preset` / `capabilityKeys` / `actionOverrides` 等映射层。

非审核类 capabilities 批量（客户确认、发货通知、关单等）使用 `UniCapabilityBatchButton` 放在 `toolBarActionsAfterBatch`（菜单外层），支持单条/多条文案混合；禁止放入审核批量下拉内。

```tsx
<UniAuditBatchMenuButton
  selectedRowKeys={selectedRowKeys}
  selectedRecords={selectedRows}
  auditEnabled={auditRequired}
  permGates={perms}
  handlers={{ submit, withdraw, approve, revoke }}
  onSuccess={() => actionRef.current?.reload()}
/>
```

## CI

```bash
cd riveredge-backend && python scripts/scan_document_action_bypass.py --fail-on high
```

报价单试点阶段对页面 `can*` 模式为 warn；推广后升为 high。
