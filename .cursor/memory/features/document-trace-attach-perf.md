---
title: 全链路追踪与附件中心取数加速
slug: document-trace-attach-perf
status: delivered
domain: kuaizhizao-trace
when: 全链路很慢、附件中心很慢、trace_document_chain、attachment-center
keywords:
  - 全链路追踪
  - 附件中心
  - trace_document_chain
  - attachment-center
  - DocumentRelationNewService
standard: 同趟 relations 缓存 + 兄弟并行展开；is_deleted 按类型批量；策略下游/附件按类型 gather
---

# 全链路追踪与附件中心取数加速

## 目标

详情抽屉「全链路」「附件中心」Tab 切过去后尽快出图/出列表。

## 何时读 / 禁止另起

- 何时读：trace / attachment-center 慢、怀疑 N+1 get_relations
- 禁止：再串行逐节点 `_resolve_relation_flags`；禁止无策略类型靠抛异常回落表驱动

## 标准入口

| 层 | 标准 |
|----|------|
| Trace API | `DocumentRelationNewService.trace_document_chain` |
| 附件中心 | `DocumentAttachmentCenterService.get_attachment_center`（内部一次 both 向 trace） |
| FE | `DetailDrawerTemplate` 懒挂载 Tab → `DetailDrawerInlineFullChain` / `DocumentAttachmentCenterPane` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 追溯 | `riveredge-backend/src/apps/kuaizhizao/services/document_relation_new_service.py` |
| 业务推导 | `riveredge-backend/src/apps/kuaizhizao/services/document_relation_service.py` |
| 附件聚合 | `riveredge-backend/src/apps/kuaizhizao/services/document_attachment_center_service.py` |

## 踩坑

- 旧路径对每层 `get_relations` 串行，且每条关联再查一次删除标记；富销售订单可到十余秒
- `purchase_requisition` 等在 `DOCUMENT_TYPES` 但无 `DOCUMENT_RELATION_STRATEGIES` 时勿调 legacy（会 ValidationError）

## 关联

- `features/sales-order-detail-api-perf.md`
- 更新日志 `document-trace-attach-perf-r01`
