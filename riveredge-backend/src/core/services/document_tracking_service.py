"""
单据跟踪中心服务模块

聚合 OperationLog、StateTransitionLog、ApprovalRecord、DocumentRelation，
提供按单据维度的操作记录时间线及关联关系查询。

Author: Luigi Lu
Date: 2026-02-20
"""

from typing import Dict, Any, List, Optional

# document_type -> (model, code_field) 用于解析 document_code，延迟导入避免循环依赖
def _get_model_registry() -> Dict[str, tuple]:
    from apps.kuaizhizao.models.demand import Demand
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.demand_computation import DemandComputation
    from apps.kuaizhizao.models.sales_forecast import SalesForecast
    from apps.kuaizhizao.models.production_plan import ProductionPlan
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
    from apps.kuaizhizao.models.quotation import Quotation
    from apps.kuaizhizao.models.rework_order import ReworkOrder
    return {
        "demand": (Demand, "demand_code"),
        "sales_order": (SalesOrder, "order_code"),
        "work_order": (WorkOrder, "code"),
        "purchase_order": (PurchaseOrder, "order_code"),
        "demand_computation": (DemandComputation, "computation_code"),
        "sales_forecast": (SalesForecast, "forecast_code"),
        "production_plan": (ProductionPlan, "plan_code"),
        "purchase_requisition": (PurchaseRequisition, "requisition_code"),
        "quotation": (Quotation, "quotation_code"),
        "rework_order": (ReworkOrder, "code"),
    }

DOCUMENT_MODEL_REGISTRY = _get_model_registry


class DocumentTrackingService:
    """单据跟踪中心服务"""

    async def get_document_tracking(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
    ) -> Dict[str, Any]:
        """
        获取单据的操作记录时间线及关联关系

        Args:
            tenant_id: 租户ID
            document_type: 单据类型（demand、sales_order、work_order 等）
            document_id: 单据ID

        Returns:
            Dict: { document_type, document_id, document_code, timeline, relations }
        """
        document_code, doc_meta = await self._resolve_document_meta(tenant_id, document_type, document_id)

        timeline: List[Dict[str, Any]] = []
        relations: Dict[str, List[Dict]] = {"upstream": [], "downstream": []}

        # 0. 创建记录（从单据 created_at 生成）
        if doc_meta and doc_meta.get("created_at"):
            creator_name = doc_meta.get("creator_name") or str(doc_meta.get("created_by", ""))
            timeline.append({
                "type": "create",
                "at": doc_meta["created_at"],
                "by": creator_name,
                "by_id": doc_meta.get("created_by"),
                "detail": "创建单据",
            })

        # 1. StateTransitionLog
        try:
            from apps.kuaizhizao.models.state_transition import StateTransitionLog

            logs = await StateTransitionLog.filter(
                tenant_id=tenant_id,
                entity_type=document_type,
                entity_id=document_id,
            ).order_by("transition_time").all()

            for log in logs:
                is_edit = (
                    log.from_state == log.to_state
                    and log.transition_reason == "编辑"
                )
                changed_fields = []
                field_changes = []
                if is_edit and log.transition_comment:
                    try:
                        import json
                        parsed = json.loads(log.transition_comment)
                        changed_fields = parsed.get("changed_fields", [])
                        field_changes = parsed.get("field_changes", [])
                    except Exception:
                        pass
                if is_edit:
                    detail = f"编辑：修改了 {', '.join(changed_fields)}" if changed_fields else "编辑订单"
                else:
                    detail = f"{log.from_state} → {log.to_state}"
                is_auto_approve = log.transition_reason == "自动审核"
                timeline.append({
                    "type": "edit" if is_edit else "state_transition",
                    "at": log.transition_time.isoformat() if log.transition_time else None,
                    "by": log.operator_name or str(log.operator_id),
                    "by_id": log.operator_id,
                    "detail": detail,
                    "from_state": log.from_state,
                    "to_state": log.to_state,
                    "reason": log.transition_reason,
                    "is_auto_approve": is_auto_approve,
                    "changed_fields": changed_fields if is_edit else None,
                    "field_changes": field_changes if is_edit else None,
                })
        except Exception:
            pass

        # 2. ApprovalHistory（统一审批系统）
        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService
            from core.models.approval_history import ApprovalHistory

            instance = await ApprovalInstanceService.get_instance_by_entity(
                tenant_id=tenant_id,
                entity_type=document_type,
                entity_id=document_id,
            )
            if instance:
                records = await ApprovalHistory.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=instance.id,
                ).order_by("action_at").all()
                for r in records:
                    timeline.append({
                        "type": "approve",
                        "at": r.action_at.isoformat() if r.action_at else None,
                        "by_id": r.action_by,
                        "detail": f"审核{r.action}",
                        "result": r.action,
                        "comment": r.comment,
                    })
        except Exception:
            pass

        # 3. DocumentRelation (上下游)
        try:
            from apps.kuaizhizao.models.document_relation import DocumentRelation

            # 作为 source（本单是上游，target 是下游）
            as_source = await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type=document_type,
                source_id=document_id,
            ).all()

            for rel in as_source:
                relations["downstream"].append({
                    "type": rel.target_type,
                    "id": rel.target_id,
                    "code": rel.target_code,
                    "name": rel.target_name,
                    "mode": rel.relation_mode,
                })
                timeline.append({
                    "type": "push",
                    "at": rel.created_at.isoformat() if rel.created_at else None,
                    "detail": f"下推 → {rel.target_type} {rel.target_code or rel.target_id}",
                    "target_type": rel.target_type,
                    "target_id": rel.target_id,
                    "target_code": rel.target_code,
                })

            # 作为 target（本单是下游，source 是上游）
            as_target = await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type=document_type,
                target_id=document_id,
            ).all()

            for rel in as_target:
                relations["upstream"].append({
                    "type": rel.source_type,
                    "id": rel.source_id,
                    "code": rel.source_code,
                    "name": rel.source_name,
                    "mode": rel.relation_mode,
                })
                timeline.append({
                    "type": "pull" if rel.relation_mode == "pull" else "from",
                    "at": rel.created_at.isoformat() if rel.created_at else None,
                    "detail": f"来自 {rel.source_type} {rel.source_code or rel.source_id}",
                    "source_type": rel.source_type,
                    "source_id": rel.source_id,
                    "source_code": rel.source_code,
                })
        except Exception:
            pass

        # 按时间排序 timeline
        def sort_key(t):
            s = t.get("at") or ""
            return s

        timeline.sort(key=sort_key)

        return {
            "document_type": document_type,
            "document_id": document_id,
            "document_code": document_code,
            "timeline": timeline,
            "relations": relations,
        }

    async def _resolve_document_meta(
        self, tenant_id: int, document_type: str, document_id: int
    ) -> tuple:
        """解析单据编码及元数据（created_at, created_by, creator_name）"""
        reg_dict = DOCUMENT_MODEL_REGISTRY()
        reg = reg_dict.get(document_type)
        if not reg:
            return None, None
        try:
            model, code_field = reg
            obj = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not obj:
                return None, None
            code = getattr(obj, code_field, None)
            created_at = getattr(obj, "created_at", None)
            created_by = getattr(obj, "created_by", None)
            meta = None
            if created_at is not None:
                meta = {
                    "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
                    "created_by": created_by,
                }
                if created_by:
                    try:
                        from apps.base_service import AppBaseService
                        meta["creator_name"] = await AppBaseService().get_user_name(created_by)
                    except Exception:
                        meta["creator_name"] = str(created_by)
            return code, meta
        except Exception:
            return None, None
