"""
单据跟踪中心服务模块

聚合 OperationLog、StateTransitionLog、ApprovalRecord、DocumentRelation，
提供按单据维度的操作记录时间线及关联关系查询。

Author: Luigi Lu
Date: 2026-02-20
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from core.utils.timezone_utils import to_api_isoformat

# document_type -> (model, code_field) 用于解析 document_code，延迟导入避免循环依赖
def _get_model_registry() -> Dict[str, tuple]:
    from apps.kuaizhizao.models.demand import Demand
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.demand_computation import DemandComputation
    from apps.kuaizhizao.models.sales_forecast import SalesForecast
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
    from apps.kuaizhizao.models.quotation import Quotation
    from apps.kuaizhizao.models.sales_contract import SalesContract
    from apps.kuaizhizao.models.rework_order import ReworkOrder
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.purchase_return import PurchaseReturn
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.production_return import ProductionReturn
    from apps.kuaizhizao.models.production_picking import ProductionPicking
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    from apps.kuaizhizao.models.material_return import MaterialReturn
    from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
    from apps.kuaizhizao.models.reporting_record import ReportingRecord
    from apps.kuaizhizao.models.outsource_order import OutsourceOrder
    from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
    from apps.kuaizhizao.models.packing_binding import PackingBinding
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
    from apps.kuaizhizao.models.sales_return import SalesReturn
    from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.invoice import Invoice
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.payment import Payment
    from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
    from apps.kuaizhizao.models.equipment import Equipment
    from apps.kuaizhizao.models.equipment_fault import EquipmentFault
    from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
    from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
    from apps.kuaizhizao.models.mold import Mold
    from apps.kuaizhizao.models.tool import Tool
    from apps.master_data.models.performance import Holiday, Skill
    from apps.master_data.models.employee_performance import PerformanceSummary
    return {
        "demand": (Demand, "demand_code"),
        "sales_order": (SalesOrder, "order_code"),
        "work_order": (WorkOrder, "code"),
        "purchase_order": (PurchaseOrder, "order_code"),
        "demand_computation": (DemandComputation, "computation_code"),
        "sales_forecast": (SalesForecast, "forecast_code"),
        "purchase_requisition": (PurchaseRequisition, "requisition_code"),
        "quotation": (Quotation, "quotation_code"),
        "sales_contract": (SalesContract, "contract_code"),
        "rework_order": (ReworkOrder, "code"),
        "purchase_receipt": (PurchaseReceipt, "receipt_code"),
        "purchase_return": (PurchaseReturn, "return_code"),
        "sales_delivery": (SalesDelivery, "delivery_code"),
        "incoming_inspection": (IncomingInspection, "inspection_code"),
        "process_inspection": (ProcessInspection, "inspection_code"),
        "finished_goods_inspection": (FinishedGoodsInspection, "inspection_code"),
        "production_return": (ProductionReturn, "return_code"),
        "production_picking": (ProductionPicking, "picking_code"),
        "finished_goods_receipt": (FinishedGoodsReceipt, "receipt_code"),
        "semi_finished_goods_receipt": (SemiFinishedGoodsReceipt, "receipt_code"),
        "other_outbound": (OtherOutbound, "outbound_code"),
        "material_return": (MaterialReturn, "return_code"),
        "shipment_notice": (ShipmentNotice, "notice_code"),
        "delivery_notice": (DeliveryNotice, "notice_code"),
        "reporting_record": (ReportingRecord, "work_order_code"),
        "outsource_order": (OutsourceOrder, "code"),
        "outsource_work_order": (OutsourceWorkOrder, "code"),
        "packing_binding": (PackingBinding, "uuid"),
        "receipt_notice": (ReceiptNotice, "notice_code"),
        "sales_return": (SalesReturn, "return_code"),
        "receivable": (Receivable, "receivable_code"),
        "payable": (Payable, "payable_code"),
        "sales_invoice": (Invoice, "invoice_code"),
        "receipt": (Receipt, "receipt_code"),
        "payment": (Payment, "payment_code"),
        "purchase_invoice": (PurchaseInvoice, "invoice_code"),
        "equipment": (Equipment, "code"),
        "equipment_fault": (EquipmentFault, "fault_no"),
        "maintenance_plan": (MaintenancePlan, "plan_no"),
        "maintenance_reminder": (MaintenanceReminder, "uuid"),
        "mold": (Mold, "code"),
        "tool": (Tool, "code"),
        "performance_skill": (Skill, "code"),
        "performance_holiday": (Holiday, "name"),
        "performance_summary": (PerformanceSummary, "period"),
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
    "purchase_requisition": "采购申请",
    "quotation": "报价单",
    "sales_contract": "销售合同",
    "rework_order": "返工单",
    "purchase_receipt": "采购收货单",
    "purchase_return": "采购退货单",
    "sales_delivery": "销售出库单",
    "incoming_inspection": "来料检验单",
    "process_inspection": "过程检验单",
    "finished_goods_inspection": "成品检验单",
    "production_return": "生产退料单",
    "production_picking": "生产领料单",
    "finished_goods_receipt": "成品入库单",
    "semi_finished_goods_receipt": "半成品入库单",
    "other_outbound": "其他出库单",
    "material_return": "还料单",
    "shipment_notice": "发货通知单",
    "delivery_notice": "送货单",
    "reporting_record": "报工记录",
    "outsource_order": "工序委外单",
    "outsource_work_order": "工单委外",
    "packing_binding": "装箱绑定",
    "receipt_notice": "收货通知单",
    "sales_return": "销售退货单",
    "receivable": "应收单",
    "payable": "应付单",
    "sales_invoice": "销项发票",
    "receipt": "收款单",
    "payment": "付款单",
    "purchase_invoice": "采购发票",
    "equipment": "设备",
    "equipment_fault": "设备故障",
    "maintenance_plan": "保养计划",
    "maintenance_reminder": "维护提醒",
    "mold": "模具",
    "tool": "工装",
    "performance_skill": "技能",
    "performance_holiday": "假期",
    "performance_summary": "绩效汇总",
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
            # 不加 deleted_at 过滤，便于识别软删除状态（收款/付款/销项发票除外）
            if relation_type == "sales_invoice":
                obj = await model.get_or_none(
                    tenant_id=tenant_id, id=relation_id, category="OUT"
                )
            elif relation_type in ("receipt", "payment", "purchase_invoice"):
                obj = await model.get_or_none(
                    tenant_id=tenant_id, id=relation_id, deleted_at__isnull=True
                )
            else:
                obj = await model.get_or_none(tenant_id=tenant_id, id=relation_id)
            if not obj:
                flags["is_deleted"] = True
                return flags

            if relation_type == "sales_invoice" and getattr(obj, "category", None) != "OUT":
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

    async def _append_relations_from_rel_data(
        self,
        tenant_id: int,
        relations: Dict[str, List[Dict]],
        rel_data: Dict[str, Any],
        *,
        include_upstream: bool = True,
        include_downstream: bool = True,
    ) -> None:
        """
        将 DocumentRelationService.get_document_relations 返回的上/下游列表合并进 relations，
        按 (type, id) 去重并补齐 flags。
        """
        if include_upstream:
            existing_u = {(r["type"], r["id"]) for r in relations["upstream"]}
            for u in rel_data.get("upstream_documents") or []:
                dt = u.get("document_type")
                did = u.get("document_id")
                if not dt or did is None:
                    continue
                key = (dt, did)
                if key in existing_u:
                    continue
                rel_flags = await self._resolve_relation_flags(
                    tenant_id=tenant_id,
                    relation_type=dt,
                    relation_id=did,
                    relation_created_at=None,
                    relation_code=u.get("document_code"),
                )
                relations["upstream"].append({
                    "type": dt,
                    "id": did,
                    "code": u.get("document_code"),
                    "name": u.get("document_name"),
                    "mode": None,
                    "is_auto_created": False,
                    "is_deleted": rel_flags["is_deleted"],
                    "is_changed_after_link": rel_flags["is_changed_after_link"],
                })
                existing_u.add(key)
        if include_downstream:
            existing_d = {(r["type"], r["id"]) for r in relations["downstream"]}
            for d in rel_data.get("downstream_documents") or []:
                dt = d.get("document_type")
                did = d.get("document_id")
                if not dt or did is None:
                    continue
                key = (dt, did)
                if key in existing_d:
                    continue
                rel_flags = await self._resolve_relation_flags(
                    tenant_id=tenant_id,
                    relation_type=dt,
                    relation_id=did,
                    relation_created_at=None,
                    relation_code=d.get("document_code"),
                )
                relations["downstream"].append({
                    "type": dt,
                    "id": did,
                    "code": d.get("document_code"),
                    "name": d.get("document_name"),
                    "mode": None,
                    "is_auto_created": False,
                    "is_deleted": rel_flags["is_deleted"],
                    "is_changed_after_link": rel_flags["is_changed_after_link"],
                })
                existing_d.add(key)

    @staticmethod
    def _build_relations_graph(
        document_type: str,
        document_id: int,
        document_code: Optional[str],
        relations: Dict[str, List[Dict]],
    ) -> Dict[str, Any]:
        """
        由扁平 upstream/downstream 生成 nodes/edges，便于前端桑基或 DAG 可视化；
        边语义：upstream 为「来源单据 → 当前单」，downstream 为「当前单 → 下游单据」。
        """
        cur_key = f"{document_type}-{document_id}"
        nodes: Dict[str, Dict[str, Any]] = {}

        def upsert_node(key: str, dt: str, did: int, code: Optional[str], name: Optional[str], role: str) -> None:
            if key not in nodes:
                nodes[key] = {
                    "id": key,
                    "document_type": dt,
                    "document_id": did,
                    "code": code,
                    "name": name,
                    "role": role,
                }
                return
            prev_role = nodes[key]["role"]
            if prev_role != role:
                nodes[key]["role"] = "related"
            if code and not nodes[key].get("code"):
                nodes[key]["code"] = code
            if name and not nodes[key].get("name"):
                nodes[key]["name"] = name

        upsert_node(cur_key, document_type, document_id, document_code, None, "current")
        for r in relations["upstream"]:
            k = f"{r['type']}-{r['id']}"
            upsert_node(k, r["type"], r["id"], r.get("code"), r.get("name"), "upstream")
        for r in relations["downstream"]:
            k = f"{r['type']}-{r['id']}"
            upsert_node(k, r["type"], r["id"], r.get("code"), r.get("name"), "downstream")

        edges: List[Dict[str, str]] = []
        for r in relations["upstream"]:
            k = f"{r['type']}-{r['id']}"
            edges.append({"from": k, "to": cur_key, "direction": "upstream"})
        for r in relations["downstream"]:
            k = f"{r['type']}-{r['id']}"
            edges.append({"from": cur_key, "to": k, "direction": "downstream"})
        return {"nodes": list(nodes.values()), "edges": edges}

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
            Dict: { document_type, document_id, document_code, timeline, relations, relations_graph }
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
                    "at": to_api_isoformat(log.transition_time) if log.transition_time else None,
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
                        "at": to_api_isoformat(r.action_at) if r.action_at else None,
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
                    at_val = to_api_isoformat(r.reported_at) if r.reported_at else (to_api_isoformat(r.created_at) if r.created_at else None)
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
                        "detail": " - ".join(detail_parts),
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
                    "at": to_api_isoformat(rel.created_at) if rel.created_at else None,
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
                    "at": to_api_isoformat(rel.created_at) if rel.created_at else None,
                    "detail": f"来自{src_label}（{src_code}）",
                    "source_type": rel.source_type,
                    "source_id": rel.source_id,
                    "source_code": rel.source_code,
                })
        except Exception:
            pass

        # 3.5 采购退货单：从领域模型补充上游（入库单、采购订单），避免仅依赖 DocumentRelation 表
        if document_type == "purchase_return":
            try:
                from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

                rel_svc = DocumentRelationService()
                rel_data = await rel_svc.get_document_relations(
                    tenant_id, document_type, document_id
                )
                await self._append_relations_from_rel_data(
                    tenant_id, relations, rel_data,
                    include_upstream=True,
                    include_downstream=False,
                )
            except Exception:
                pass

        # 3.5b 收货通知 / 销售退货 / 应收 / 应付：从领域模型补充上下游（含 source_type 链）
        if document_type in (
            "receipt_notice",
            "sales_return",
            "receivable",
            "payable",
            "sales_invoice",
            "receipt",
            "payment",
            "purchase_invoice",
            "delivery_notice",
            "shipment_notice",
            "material_return",
        ):
            try:
                from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

                rel_svc = DocumentRelationService()
                rel_data = await rel_svc.get_document_relations(
                    tenant_id, document_type, document_id
                )
                await self._append_relations_from_rel_data(
                    tenant_id, relations, rel_data,
                    include_upstream=True,
                    include_downstream=True,
                )
            except Exception:
                pass

        # 3.6 报工记录：从领域模型补充上游（工单）
        if document_type == "reporting_record":
            try:
                from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

                rel_svc = DocumentRelationService()
                rel_data = await rel_svc.get_document_relations(
                    tenant_id, document_type, document_id
                )
                await self._append_relations_from_rel_data(
                    tenant_id, relations, rel_data,
                    include_upstream=True,
                    include_downstream=False,
                )
            except Exception:
                pass

        # 3.7 工序委外 / 工单委外：从领域模型补充上下游
        if document_type in ("outsource_order", "outsource_work_order"):
            try:
                from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

                rel_svc = DocumentRelationService()
                rel_data = await rel_svc.get_document_relations(
                    tenant_id, document_type, document_id
                )
                await self._append_relations_from_rel_data(
                    tenant_id, relations, rel_data,
                    include_upstream=True,
                    include_downstream=True,
                )
            except Exception:
                pass

        # 3.8 装箱绑定：从领域模型补充上游（成品入库单 / 销售出库单）
        if document_type == "packing_binding":
            try:
                from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

                rel_svc = DocumentRelationService()
                rel_data = await rel_svc.get_document_relations(
                    tenant_id, document_type, document_id
                )
                await self._append_relations_from_rel_data(
                    tenant_id, relations, rel_data,
                    include_upstream=True,
                    include_downstream=False,
                )
            except Exception:
                pass

        # 按时间排序 timeline
        def sort_key(t):
            s = t.get("at") or ""
            return s

        timeline.sort(key=sort_key)

        relations_graph = self._build_relations_graph(
            document_type, document_id, document_code, relations
        )

        return {
            "document_type": document_type,
            "document_id": document_id,
            "document_code": document_code,
            "timeline": timeline,
            "relations": relations,
            "relations_graph": relations_graph,
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
            if document_type == "sales_invoice":
                obj = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, category="OUT"
                )
            elif document_type in ("receipt", "payment", "purchase_invoice"):
                obj = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
                )
            else:
                obj = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not obj:
                return None, None
            code = getattr(obj, code_field, None)
            created_at = getattr(obj, "created_at", None)
            created_by = getattr(obj, "created_by", None)
            meta = None
            if created_at is not None:
                meta = {
                    "created_at": to_api_isoformat(created_at) if hasattr(created_at, "isoformat") else str(created_at),
                    "created_by": created_by,
                }
                if created_by:
                    try:
                        from apps.common.base_service import AppBaseService
                        meta["creator_name"] = await AppBaseService().get_user_name(created_by)
                    except Exception:
                        meta["creator_name"] = str(created_by)
            return code, meta
        except Exception:
            return None, None
