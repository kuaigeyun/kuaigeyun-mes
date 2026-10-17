---
title: 轻办公费用报销单
slug: kuaioa-expense-reimbursement
status: delivered
domain: kuaioa
when: 改报销单、费用报销、kuaioa_expense 审核流、报销明细行
keywords:
  - 报销单
  - 费用报销
  - kuaioa_expense
  - kuaioa:expense
  - ExpenseRequest
standard: KuaioaCrudListPage + KuaioaApprovalDocService + manifest.audit kuaioa_expense
---

# 轻办公费用报销单

## 目标

在轻办公「行政办公」下提供费用报销单：申请人、公司、费用类型、多行明细、总金额、收款人、备注、费用凭证；审核流与用章/请假并列独立配置。

## 何时读 / 禁止另起

- 何时读：加报销字段、改明细结构、改审核节点、对齐钉钉式报销表单
- 禁止：不要在快制造/轻财务另起报销审批；不要把「审批流程」做成表单下拉（真源是 `manifest.audit` + `UniWorkflowActions`）

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/admin/expense` + `ExpenseModalBody` + `auditWorkflow` entityType=`kuaioa_expense` |
| BE | `ExpenseRequestService` → `KuaioaApprovalDocService`；`uni_audit_handlers` `kuaioa_expense` |
| 权限 | `kuaioa:expense:read|create|update|delete|submit|approve|reject|revoke` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 列表页 | `riveredge-frontend/src/apps/kuaioa/pages/admin/expense/index.tsx` |
| 表单明细 | `riveredge-frontend/src/apps/kuaioa/components/ExpenseModalBody.tsx` |
| 模型 | `riveredge-backend/src/apps/kuaioa/models/expense.py` |
| 服务 | `riveredge-backend/src/apps/kuaioa/services/expense_service.py` |
| API | `riveredge-backend/src/apps/kuaioa/api/expense.py` |
| 迁移 | `riveredge-backend/migrations/models/890_20261016093000_kuaioa_expense_requests.py` |
| 审核 | `manifest.json` audit `kuaioa_expense`；`uni_audit_handlers._dispatch_kuaioa_expense` |

## 扩展点

1. 明细存头表 `lines` JSON（`department_name` / `content` / `amount`），总金额服务端按明细重算
2. 凭证走 `attachment_uuids` + 表单 `attachment_file`（`mapOaAttachment*`）
3. 工作台跳转：`kuaioaDocRoutes` `kuaioa_expense` → `/apps/kuaioa/admin/expense`

## 踩坑

- 截图里的「审批流程」下拉不是业务字段；独立审核节点在业务配置里配，表单不选手写审批人
- 有明细行时 Modal 用 `FormModalGridBlock` 包 `Form.List`，勿把裸 List 塞进 ProForm grid 导致出格

## 关联

- `.cursor/skills/kuaioa/SKILL.md`
- `principles/reuse-existing-patterns.md`
