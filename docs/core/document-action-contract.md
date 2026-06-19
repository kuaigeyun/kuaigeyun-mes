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

- **Phase 1**：报价单（`derive_quotation_capabilities`）
- Phase 2+：销售合同、销售订单等按同一契约增量注册

## CI

```bash
cd riveredge-backend && python scripts/scan_document_action_bypass.py --fail-on high
```

报价单试点阶段对页面 `can*` 模式为 warn；推广后升为 high。
