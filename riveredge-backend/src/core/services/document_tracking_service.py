"""
单据跟踪中心服务模块

聚合 OperationLog、StateTransitionLog、ApprovalRecord、DocumentRelation，
提供按单据维度的操作记录时间线及关联关系查询。

Author: Luigi Lu
Date: 2026-02-20
"""

from datetime import datetime
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
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.production_return import ProductionReturn
    from apps.kuaizhizao.models.production_picking import ProductionPicking
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.sample_trial import SampleTrial
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
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
        "purchase_receipt": (PurchaseReceipt, "receipt_code"),
        "sales_delivery": (SalesDelivery, "delivery_code"),
        "incoming_inspection": (IncomingInspection, "inspection_code"),
        "process_inspection": (ProcessInspection, "inspection_code"),
        "finished_goods_inspection": (FinishedGoodsInspection, "inspection_code"),
        "production_return": (ProductionReturn, "return_code"),
        "production_picking": (ProductionPicking, "picking_code"),
        "finished_goods_receipt": (FinishedGoodsReceipt, "receipt_code"),
        "sample_trial": (SampleTrial, "trial_code"),
        "other_outbound": (OtherOutbound, "outbound_code"),
        "shipment_notice": (ShipmentNotice, "notice_code"),
    }

DOCUMENT_MODEL_REGISTRY = _get_model_registry

# 单据类型（API/库表 entity_type）→ 中文展示名，用于操作记录、上下游说明
DOCUMENT_TYPE_LABEL_ZH: Dict[str, str] = {
    "demand": "需求",
    "sales_order": "销售订单",
    "work_order": "工单",
    "purchase_order": "采购订单",
    "demand_computation": "需求计算",
    "sales_forecast": "销售预测",
    "production_plan": "生产计划",
    "purchase_requisition": "采购申请",
    "quotation": "报价单",
    "rework_order": "返工单",
    "purchase_receipt": "采购收货单",
    "sales_delivery": "销售出库单",
    "incoming_inspection": "来料检验单",
    "process_inspection": "过程检验单",
    "finished_goods_inspection": "成品检验单",
    "production_return": "生产退料单",
    "production_picking": "生产领料单",
    "finished_goods_receipt": "成品入库单",
    "sample_trial": "样品试用单",
    "other_outbound": "其他出库单",
    "shipment_notice": "发货通知单",
}


def _doc_type_label_zh(document_type: str) -> str:
    if not document_type:
        return "单据"
    return DOCUMENT_TYPE_LABEL_ZH.get(document_type.strip(), document_type.strip())


class DocumentTrackingService:
    """单据跟踪中心服务"""

    @staticmethod
    def _is_auto_relation(relation_mode: Optional[str], relation_desc: Optional[str]) -> bool:
        """判断关联是否由系统自动生成。"""
        mode = (relation_mode or "").strip().lower()
        desc = (relation_desc or "").strip()
        return mode in ("auto", "system") or ("自动" in desc)

    async def _resolve_relation_flags(
        self,
        tenant_id: int,
        relation_type: str,
        relation_id: int,
        relation_created_at: Optional[datetime],
        relation_code: Optional[str] = None,
    ) -> Dict[str, bool]:
        """解析关联单据状态：是否删除、是否在关联后发生变更。"""
        flags = {
            "is_deleted": False,
            "is_changed_after_link": False,
        }
        reg = DOCUMENT_MODEL_REGISTRY().get(relation_type)
        if not reg:
            return flags

        model, code_field = reg
        try:
            # 不加 deleted_at 过滤，便于识别软删除状态
            obj = await model.get_or_none(tenant_id=tenant_id, id=relation_id)
            if not obj:
                flags["is_deleted"] = True
                return flags

            deleted_at = getattr(obj, "deleted_at", None)
            if deleted_at:
                flags["is_deleted"] = True
                return flags

            if relation_created_at and getattr(obj, "updated_at", None):
                flags["is_changed_after_link"] = obj.updated_at > relation_created_at

            # 若编码发生变化，也视为下推后发生变更
            current_code = getattr(obj, code_field, None)
            if relation_code and current_code and str(relation_code).strip() != str(current_code).strip():
                flags["is_changed_after_link"] = True
        except Exception:
            # 保底不阻断主流程
            return flags
        return flags

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
                "detail": f"创建了{_doc_type_label_zh(document_type)}",
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
                elif log.from_state == log.to_state and log.transition_reason:
                    detail = log.transition_reason
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

        # 2.5 报工记录（仅工单）
        if document_type == "work_order":
            try:
                from apps.kuaizhizao.models.reporting_record import ReportingRecord

                records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=document_id,
                ).order_by("reported_at").all()

                for r in records:
                    at_val = r.reported_at.isoformat() if r.reported_at else (r.created_at.isoformat() if r.created_at else None)
                    detail_parts = [f"{r.operation_name or r.operation_code or '工序'}"]
                    if r.reported_quantity is not None:
                        detail_parts.append(f"报工 {r.reported_quantity}")
                    if r.qualified_quantity is not None:
                        detail_parts.append(f"合格 {r.qualified_quantity}")
                    if r.unqualified_quantity is not None and float(r.unqualified_quantity) > 0:
                        detail_parts.append(f"不合格 {r.unqualified_quantity}")
                    if r.work_hours is not None and float(r.work_hours) > 0:
                        detail_parts.append(f"工时 {r.work_hours}h")
                    timeline.append({
                        "type": "report",
                        "at": at_val,
                        "by": r.worker_name or str(r.worker_id or ""),
                        "by_id": r.worker_id,
                        "detail": " · ".join(detail_parts),
                        "operation_name": r.operation_name,
                        "operation_code": r.operation_code,
                        "reported_quantity": str(r.reported_quantity) if r.reported_quantity is not None else None,
                        "qualified_quantity": str(r.qualified_quantity) if r.qualified_quantity is not None else None,
                        "unqualified_quantity": str(r.unqualified_quantity) if r.unqualified_quantity is not None else None,
                        "work_hours": str(r.work_hours) if r.work_hours is not None else None,
                        "status": r.status,
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
                rel_flags = await self._resolve_relation_flags(
                    tenant_id=tenant_id,
                    relation_type=rel.target_type,
                    relation_id=rel.target_id,
                    relation_created_at=rel.created_at,
                    relation_code=rel.target_code,
                )
                relations["downstream"].append({
                    "type": rel.target_type,
                    "id": rel.target_id,
                    "code": rel.target_code,
                    "name": rel.target_name,
                    "mode": rel.relation_mode,
                    "is_auto_created": self._is_auto_relation(rel.relation_mode, rel.relation_desc),
                    "is_deleted": rel_flags["is_deleted"],
                    "is_changed_after_link": rel_flags["is_changed_after_link"],
                })
                tgt_code = (rel.target_code or "").strip() or str(rel.target_id)
                tgt_label = _doc_type_label_zh(rel.target_type or "")
                timeline.append({
                    "type": "push",
                    "at": rel.created_at.isoformat() if rel.created_at else None,
                    "detail": f"下推了{tgt_label}（{tgt_code}）",
                    "is_auto_created": self._is_auto_relation(rel.relation_mode, rel.relation_desc),
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
                rel_flags = await self._resolve_relation_flags(
                    tenant_id=tenant_id,
                    relation_type=rel.source_type,
                    relation_id=rel.source_id,
                    relation_created_at=rel.created_at,
                    relation_code=rel.source_code,
                )
                relations["upstream"].append({
                    "type": rel.source_type,
                    "id": rel.source_id,
                    "code": rel.source_code,
                    "name": rel.source_name,
                    "mode": rel.relation_mode,
                    "is_auto_created": self._is_auto_relation(rel.relation_mode, rel.relation_desc),
                    "is_deleted": rel_flags["is_deleted"],
                    "is_changed_after_link": rel_flags["is_changed_after_link"],
                })
                src_code = (rel.source_code or "").strip() or str(rel.source_id)
                src_label = _doc_type_label_zh(rel.source_type or "")
                timeline.append({
                    "type": "pull" if rel.relation_mode == "pull" else "from",
                    "at": rel.created_at.isoformat() if rel.created_at else None,
                    "detail": f"来自{src_label}（{src_code}）",
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
