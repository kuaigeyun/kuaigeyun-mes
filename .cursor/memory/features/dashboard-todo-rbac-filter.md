---
title: 工作台待办按单据 :read 权限过滤
slug: dashboard-todo-rbac-filter
status: delivered
domain: rbac
when: 改工作台待办事项、dashboard/todos、模块中心待办、待办显示无权限单据
keywords:
  - dashboard todos
  - 待办事项
  - get_todos
  - dashboard_todo_permission
  - 工作台待办
standard: 后端 get_todos 按 TODO_SOURCE_READ_PERMISSION 门控各来源 fetcher；审批指派待办除外
---

# 工作台待办按单据 :read 权限过滤

## 目标

系统工作台「待办事项」只聚合登录用户有 `:read` 权限的单据来源，避免无模块权限仍看到质检/仓储/销售等待办。

## 何时读 / 禁止另起

- 何时读：新增待办来源、改待办 Tab、报「没权限菜单却有待办」
- 禁止：前端再写一套按 type 藏 Tab 冒充鉴权；禁止不按 manifest 码另起 alias

## 标准入口

| 层 | 标准 |
|----|------|
| BE | `GET /apps/kuaizhizao/dashboard/todos` → `resolve_allowed_todo_prefixes` + `_gated` |
| 映射 | `dashboard_todo_permission.TODO_SOURCE_READ_PERMISSION`（前缀 → `:read`） |
| 审批 | `approval_task_*` 按指派人可见，不按单据 :read 过滤 |
| FE | 仍消费同一 API；零数量 Tab 已由 `filterDashboardTodoTabItems` 隐藏 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 权限映射 | `riveredge-backend/src/apps/kuaizhizao/services/dashboard_todo_permission.py` |
| API | `riveredge-backend/src/apps/kuaizhizao/api/dashboards/dashboards.py` |
| 深链 | `riveredge-backend/src/apps/kuaizhizao/services/dashboard_todo_link.py` |
| 工作台 UI | `riveredge-frontend/src/pages/system/dashboard/index.tsx` |

## 扩展点

1. 新待办来源：在 `TODO_SOURCE_READ_PERMISSION` 登记前缀与列表同码的 `:read`，并在 `get_todos` 的 `_gated(...)` 挂 fetcher
2. `handle_todo` 同步校验 `is_todo_id_allowed`，无权限 403

## 过程

1. 根因：`get_todos` 并发拉全租户各单据队列，未按 RBAC 跳过无权限来源
2. 抽映射服务，admin bypass 全开；普通用户按 EffectiveAccess 权限集过滤
3. gather 前 `_gated` 跳过查询；结果再 `is_todo_id_allowed` 收口

## 踩坑

- 权限码须与列表 API / manifest 一致（如缺料用 `production-execution-material-shortage-exceptions`，不是短名）
- 入库 Hub 多单据共用 `kuaizhizao:inbound:read`；出库 Hub 用 `outbound:read`
- 缓存 key 已含 `approver_user_id`，按用户隔离；权限变更最多 30s TTL 延迟
- **采购申请待审**：禁止再用 `purchase_requisition_` 拉全租户 `PENDING_REVIEW`；凡有 `:read` 会看到别人的单。待审只认 `approval_task_*`（`approver_id=本人` 且 `status=pending`）；已审完任务不会再进待办

## 关联

- `principles/reuse-existing-patterns.md`
- `permission-contract.mdc`
- `features/platform-update-log.md`
