"""
单据关联服务模块

提供单据关联关系查询和展示功能，支持单据上下游关联追溯。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_return import PurchaseReturn
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.settlement import SettlementRecord
from apps.kuaicaiwu.constants import (
    PAYABLE_SOURCE_PURCHASE_INVOICE,
    RECEIVABLE_SOURCE_SALES_INVOICE,
)
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.kuaizhizao.models.packing_binding import PackingBinding
from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_fault import EquipmentFault
from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
from apps.kuaizhizao.models.mold import Mold
from apps.kuaizhizao.models.tool import Tool
from apps.master_data.models.performance import Holiday, Skill
from apps.master_data.models.employee_performance import PerformanceSummary
from apps.kuaizhizao.models.document_relation import DocumentRelation

from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import to_api_isoformat



def _order_display_name(order: Any) -> Optional[str]:
    """销售/采购订单 ORM 无 order_name，展示名唯一真源为 order_code。"""
    return getattr(order, "order_code", None)


def _dedupe_relation_documents(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按 (document_type, document_id) 去重，保持顺序。"""
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        k = (it.get("document_type"), it.get("document_id"))
        if not k[0] or k[1] is None:
            continue
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


class DocumentRelationService:
    """单据关联服务"""

    # 单据类型映射
    DOCUMENT_TYPES = {
        "demand": {"model": Demand, "code_field": "demand_code", "name_field": "demand_name"},
        "sales_forecast": {"model": SalesForecast, "code_field": "forecast_code", "name_field": "forecast_name"},
        "sales_order": {"model": SalesOrder, "code_field": "order_code", "name_field": None},
        "quotation": {"model": Quotation, "code_field": "quotation_code", "name_field": None},
        "sales_contract": {"model": SalesContract, "code_field": "contract_code", "name_field": None},
        "material_borrow": {"model": MaterialBorrow, "code_field": "borrow_code", "name_field": None},
        "material_return": {"model": MaterialReturn, "code_field": "return_code", "name_field": None},
        "demand_computation": {"model": DemandComputation, "code_field": "computation_code", "name_field": None},
        "work_order": {"model": WorkOrder, "code_field": "code", "name_field": "name"},
        "production_picking": {"model": ProductionPicking, "code_field": "picking_code", "name_field": None},
        "production_return": {"model": ProductionReturn, "code_field": "return_code", "name_field": None},
        "reporting_record": {"model": ReportingRecord, "code_field": "work_order_code", "name_field": None},
        "finished_goods_receipt": {"model": FinishedGoodsReceipt, "code_field": "receipt_code", "name_field": None},
        "semi_finished_goods_receipt": {
            "model": SemiFinishedGoodsReceipt,
            "code_field": "receipt_code",
            "name_field": None,
        },
        "sales_delivery": {"model": SalesDelivery, "code_field": "delivery_code", "name_field": None},
        "delivery_notice": {"model": DeliveryNotice, "code_field": "notice_code", "name_field": None},
        "purchase_order": {"model": PurchaseOrder, "code_field": "order_code", "name_field": None},
        "purchase_requisition": {
            "model": PurchaseRequisition,
            "code_field": "requisition_code",
            "name_field": "requisition_name",
        },
        "purchase_receipt": {"model": PurchaseReceipt, "code_field": "receipt_code", "name_field": None},
        "purchase_return": {"model": PurchaseReturn, "code_field": "return_code", "name_field": None},
        "payable": {"model": Payable, "code_field": "payable_code", "name_field": None},
        "receivable": {"model": Receivable, "code_field": "receivable_code", "name_field": None},
        "sales_invoice": {"model": Invoice, "code_field": "invoice_code", "name_field": "invoice_number"},
        "receipt": {"model": Receipt, "code_field": "receipt_code", "name_field": "customer_name"},
        "payment": {"model": Payment, "code_field": "payment_code", "name_field": "supplier_name"},
        "purchase_invoice": {
            "model": PurchaseInvoice,
            "code_field": "invoice_code",
            "name_field": "invoice_number",
        },
        "incoming_inspection": {"model": IncomingInspection, "code_field": "inspection_code", "name_field": None},
        "process_inspection": {"model": ProcessInspection, "code_field": "inspection_code", "name_field": None},
        "finished_goods_inspection": {"model": FinishedGoodsInspection, "code_field": "inspection_code", "name_field": None},
        "outsource_order": {"model": OutsourceOrder, "code_field": "code", "name_field": "operation_name"},
        "outsource_work_order": {"model": OutsourceWorkOrder, "code_field": "code", "name_field": "name"},
        "packing_binding": {"model": PackingBinding, "code_field": "uuid", "name_field": None},
        "receipt_notice": {"model": ReceiptNotice, "code_field": "notice_code", "name_field": None},
        "sales_return": {"model": SalesReturn, "code_field": "return_code", "name_field": None},
        "shipment_notice": {"model": ShipmentNotice, "code_field": "notice_code", "name_field": None},
        "equipment": {"model": Equipment, "code_field": "code", "name_field": "name"},
        "equipment_fault": {"model": EquipmentFault, "code_field": "fault_no", "name_field": None},
        "maintenance_plan": {"model": MaintenancePlan, "code_field": "plan_no", "name_field": "plan_name"},
        "maintenance_reminder": {"model": MaintenanceReminder, "code_field": "uuid", "name_field": None},
        "mold": {"model": Mold, "code_field": "code", "name_field": "name"},
        "tool": {"model": Tool, "code_field": "code", "name_field": "name"},
        "performance_skill": {"model": Skill, "code_field": "code", "name_field": "name"},
        "performance_holiday": {"model": Holiday, "code_field": "name", "name_field": None},
        "performance_summary": {"model": PerformanceSummary, "code_field": "period", "name_field": "employee_name"},
    }

    #: 全链路追溯中，单张工单展开的报工记录条数上限（加工型多工序）
    REPORTING_RECORD_TRACE_LIMIT = 80
    #: 与 DocumentRelationResponse.source_code/target_code 的 max_length 一致；超长会导致推导合并校验失败并丢掉整批下游
    TRACE_RELATION_RESPONSE_CODE_MAX_LEN = 50

    @staticmethod
    def _reporting_record_trace_dict(record: ReportingRecord) -> Dict[str, Any]:
        """追溯树中的报工节点：唯一编码 + 工序名称，避免多条显示同一工单号难以区分。"""
        max_len = DocumentRelationService.TRACE_RELATION_RESPONSE_CODE_MAX_LEN
        rc = getattr(record, "reporting_code", None)
        code = (str(rc).strip() if rc is not None else "") or None
        if not code:
            op = (record.operation_code or "").strip()
            suffix = f"-{record.id}"
            # operation_code 最长 50，拼接 suffix 易超过 API Schema 50 限制，必须在服务端截断或改用短码
            if op:
                if len(op) + len(suffix) <= max_len:
                    code = f"{op}{suffix}"
                else:
                    room = max_len - len(suffix)
                    code = (op[:room] + suffix) if room > 0 else f"BG{record.id}"
            else:
                code = f"BG{record.id}"
        if code and len(code) > max_len:
            code = code[:max_len]
        op_name = (record.operation_name or "").strip() or None
        return {
            "document_type": "reporting_record",
            "document_id": record.id,
            "document_code": code,
            "document_name": op_name,
            "status": record.status if hasattr(record, "status") else None,
            "created_at": to_api_isoformat(record.created_at) if record.created_at else None,
        }

    async def get_document_relations(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> Dict[str, Any]:
        """
        获取单据的关联关系（上游和下游单据）

        Args:
            tenant_id: 租户ID
            document_type: 单据类型（如：work_order, sales_forecast等）
            document_id: 单据ID

        Returns:
            Dict: 包含上游单据和下游单据的字典
        """
        # 全链路合并节点：无物理表、无策略，避免误入 DOCUMENT_TYPES 校验
        if document_type == "reporting_timeline":
            return {
                "document_type": document_type,
                "document_id": document_id,
                "upstream_documents": [],
                "downstream_documents": [],
                "upstream_count": 0,
                "downstream_count": 0,
            }

        if document_type not in self.DOCUMENT_TYPES:
            raise ValidationError(f"不支持的单据类型: {document_type}")

        strategy = DOCUMENT_RELATION_STRATEGIES.get(document_type)
        if strategy is None:
            raise ValidationError(f"未配置关联策略的单据类型: {document_type}")

        upstream_documents, downstream_documents = await strategy(self, tenant_id, document_id)

        return {
            "document_type": document_type,
            "document_id": document_id,
            "upstream_documents": upstream_documents,
            "downstream_documents": downstream_documents,
            "upstream_count": len(upstream_documents),
            "downstream_count": len(downstream_documents)
        }

    async def trace_document_chain(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        direction: str = "both"  # "upstream", "downstream", "both"
    ) -> Dict[str, Any]:
        """
        追溯单据关联链（完整追溯）

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            direction: 追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）

        Returns:
            Dict: 完整的关联链
        """
        chain = {
            "document_type": document_type,
            "document_id": document_id,
            "upstream_chain": [],
            "downstream_chain": []
        }

        if direction in ["upstream", "both"]:
            chain["upstream_chain"] = await self._trace_upstream(tenant_id, document_type, document_id)

        if direction in ["downstream", "both"]:
            chain["downstream_chain"] = await self._trace_downstream(tenant_id, document_type, document_id)

        return chain

    # ============ 上游单据查询方法 ============

    async def _get_sales_forecast_upstream(self, tenant_id: int, forecast_id: int) -> List[Dict[str, Any]]:
        """获取销售预测的上游单据（通常没有）"""
        return []

    async def _is_sales_order_backfill_contract_link(
        self,
        tenant_id: int,
        order_id: int,
        contract_id: int,
    ) -> bool:
        """订单补签销售合同：订单为上游、合同为下游，不应把合同当作订单上游。"""
        return await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            target_type="sales_contract",
            target_id=contract_id,
            relation_mode="pull",
        ).exists()

    async def _sales_order_backfill_contract_order_ids(
        self,
        tenant_id: int,
        contract_id: int,
    ) -> set[int]:
        """补签关联的订单不应通过 contract_id 推导为合同下游。"""
        rows = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            target_type="sales_contract",
            target_id=contract_id,
            relation_mode="pull",
        ).values_list("source_id", flat=True)
        return set(rows)

    async def _get_sales_order_upstream(self, tenant_id: int, order_id: int) -> List[Dict[str, Any]]:
        """获取销售订单的上游单据（关联销售合同）"""
        upstream: List[Dict[str, Any]] = []
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if order and order.contract_id:
            if await self._is_sales_order_backfill_contract_link(
                tenant_id, order_id, order.contract_id
            ):
                return upstream
            contract = await SalesContract.get_or_none(
                tenant_id=tenant_id, id=order.contract_id, deleted_at__isnull=True
            )
            if contract:
                upstream.append({
                    "document_type": "sales_contract",
                    "document_id": contract.id,
                    "document_code": contract.contract_code,
                    "document_name": None,
                    "status": contract.status,
                    "created_at": to_api_isoformat(contract.created_at) if contract.created_at else None,
                })
        return upstream

    async def _get_demand_computation_upstream(self, tenant_id: int, computation_id: int) -> List[Dict[str, Any]]:
        """获取需求计算的上游单据。

        - MTO 销售订单：上游直连销售订单，不插入「需求」节点。
        - MTS 销售预测直推需求计算：上游直连销售预测，不插入「需求」节点（与销售订单一致）。
        - 其它来源：保留「需求」节点并解析其上游。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            return []

        upstream = []

        demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
        if not demand:
            return upstream

        demand_source_type = (getattr(demand, "source_type", None) or "").strip()
        demand_type = (getattr(demand, "demand_type", None) or "").strip()
        demand_source_id = getattr(demand, "source_id", None)

        # 销售订单来源：追溯链不再插入「需求」节点，上游即为销售订单。
        # 兼容历史数据：source_type 缺失但 demand_type=sales_order 时也按直连处理。
        if (
            (demand_source_type == "sales_order" or demand_type == "sales_order")
            and demand_source_id
        ):
            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand_source_id)
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": _order_display_name(order),
                    "status": order.status,
                    "created_at": to_api_isoformat(order.created_at) if order.created_at else None
                })
                return upstream

        # 销售预测直推需求计算：不再插入「需求」节点，上游即为销售预测。
        # 兼容历史数据：source_type 缺失但 demand_type=sales_forecast 时也按直连处理。
        if (
            (demand_source_type == "sales_forecast" or demand_type == "sales_forecast")
            and demand_source_id
        ):
            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand_source_id)
            if forecast:
                upstream.append({
                    "document_type": "sales_forecast",
                    "document_id": forecast.id,
                    "document_code": forecast.forecast_code,
                    "document_name": forecast.forecast_name,
                    "status": forecast.status,
                    "created_at": to_api_isoformat(forecast.created_at) if forecast.created_at else None
                })
            return upstream

        upstream.append({
            "document_type": "demand",
            "document_id": demand.id,
            "document_code": demand.demand_code,
            "document_name": getattr(demand, "demand_name", None) or demand.demand_code,
            "status": getattr(demand, "status", None),
            "created_at": to_api_isoformat(demand.created_at) if demand.created_at else None
        })

        return upstream

    async def _get_work_order_upstream(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        """获取工单的上游单据（销售预测/销售订单、MRP/LRP运算）"""
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            return []

        upstream = []

        # MTO模式：关联销售订单及需求计算
        if work_order.sales_order_id:
            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=work_order.sales_order_id)
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": _order_display_name(order),
                    "status": order.status,
                    "created_at": to_api_isoformat(order.created_at) if order.created_at else None
                })
                # 通过 Demand 查找关联的需求计算
                demand = await Demand.get_or_none(
                    tenant_id=tenant_id,
                    source_type="sales_order",
                    source_id=order.id,
                    deleted_at__isnull=True,
                )
                if demand and demand.computation_id:
                    comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
                    if comp:
                        upstream.append({
                            "document_type": "demand_computation",
                            "document_id": comp.id,
                            "document_code": comp.computation_code,
                            "document_name": f"需求计算-{comp.computation_code}",
                            "status": comp.computation_status,
                            "created_at": to_api_isoformat(comp.computation_start_time) if comp.computation_start_time else None
                        })

        # MTS模式：通过 DocumentRelation 查找需求计算（工单作为 target 时）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        comp_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="work_order",
            target_id=work_order_id,
            source_type="demand_computation",
        ).limit(5)
        for rel in comp_relations:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=rel.source_id)
            if comp and not any(u.get("document_type") == "demand_computation" and u.get("document_id") == comp.id for u in upstream):
                upstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": to_api_isoformat(comp.computation_start_time) if comp.computation_start_time else None
                })
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=comp.demand_id)
                if demand and demand.source_type == "sales_forecast" and demand.source_id:
                    forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                    if forecast and not any(u.get("document_type") == "sales_forecast" and u.get("document_id") == forecast.id for u in upstream):
                        upstream.append({
                            "document_type": "sales_forecast",
                            "document_id": forecast.id,
                            "document_code": forecast.forecast_code,
                            "document_name": forecast.forecast_name,
                            "status": forecast.status,
                            "created_at": to_api_isoformat(forecast.created_at) if forecast.created_at else None
                        })

        return upstream

    async def _get_production_picking_upstream(
        self,
        tenant_id: int,
        picking_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产领料的上游单据（工单）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            return []

        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=picking.work_order_id)
        if not work_order:
            return []

        return [{
            "document_type": "work_order",
            "document_id": work_order.id,
            "document_code": work_order.code,
            "document_name": work_order.name,
            "status": work_order.status,
            "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None
        }]

    async def _get_production_return_upstream(
        self,
        tenant_id: int,
        return_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产退料的上游单据（工单、生产领料）"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            return []

        upstream = []

        # 工单
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=ret.work_order_id)
        if work_order:
            upstream.append({
                "document_type": "work_order",
                "document_id": work_order.id,
                "document_code": work_order.code,
                "document_name": work_order.name,
                "status": work_order.status,
                "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None
            })

        # 领料单
        if ret.picking_id:
            picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=ret.picking_id)
            if picking:
                upstream.append({
                    "document_type": "production_picking",
                    "document_id": picking.id,
                    "document_code": picking.picking_code,
                    "document_name": None,
                    "status": picking.status,
                    "created_at": to_api_isoformat(picking.created_at) if picking.created_at else None
                })

        return upstream

    async def _get_finished_goods_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品入库的上游单据（工单、报工记录）"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        upstream = []

        # 关联工单
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=receipt.work_order_id)
        if work_order:
            upstream.append({
                "document_type": "work_order",
                "document_id": work_order.id,
                "document_code": work_order.code,
                "document_name": work_order.name,
                "status": work_order.status,
                "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None
            })

        # 关联报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=receipt.work_order_id,
            deleted_at__isnull=True,
        ).order_by("operation_id", "id").limit(self.REPORTING_RECORD_TRACE_LIMIT)
        for record in reporting_records:
            upstream.append(self._reporting_record_trace_dict(record))

        return upstream

    async def _get_semi_finished_goods_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int,
    ) -> List[Dict[str, Any]]:
        """获取半成品入库的上游单据（工单、报工记录）"""
        receipt = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []
        upstream = []
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=receipt.work_order_id)
        if work_order:
            upstream.append(
                {
                    "document_type": "work_order",
                    "document_id": work_order.id,
                    "document_code": work_order.code,
                    "document_name": work_order.name,
                    "status": work_order.status,
                    "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None,
                }
            )
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=receipt.work_order_id,
            deleted_at__isnull=True,
        ).order_by("operation_id", "id").limit(self.REPORTING_RECORD_TRACE_LIMIT)
        for record in reporting_records:
            upstream.append(self._reporting_record_trace_dict(record))
        return upstream

    async def _get_purchase_order_upstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购单的上游单据（需求计算，统一替代 MRP/LRP）"""
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order or not order.source_type or not order.source_id:
            return []

        upstream = []

        # source_type 为 MRP/LRP 或 demand_computation 时，source_id 均为 DemandComputation.id
        if order.source_type in ("MRP", "LRP", "demand_computation"):
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=order.source_id)
            if computation:
                upstream.append({
                    "document_type": "demand_computation",
                    "document_id": computation.id,
                    "document_code": computation.computation_code,
                    "document_name": f"需求计算-{computation.computation_code}",
                    "status": computation.computation_status,
                    "created_at": to_api_isoformat(computation.computation_start_time) if computation.computation_start_time else None
                })
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                if demand:
                    if demand.source_type == "sales_forecast" and demand.source_id:
                        forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                        if forecast:
                            upstream.append({
                                "document_type": "sales_forecast",
                                "document_id": forecast.id,
                                "document_code": forecast.forecast_code,
                                "document_name": forecast.forecast_name,
                                "status": forecast.status,
                                "created_at": to_api_isoformat(forecast.created_at) if forecast.created_at else None
                            })
                    elif demand.source_type == "sales_order" and demand.source_id:
                        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                        if sales_order:
                            upstream.append({
                                "document_type": "sales_order",
                                "document_id": sales_order.id,
                                "document_code": sales_order.order_code,
                                "document_name": _order_display_name(sales_order),
                                "status": sales_order.status,
                                "created_at": to_api_isoformat(sales_order.created_at) if sales_order.created_at else None
                            })

        return upstream

    async def _get_purchase_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购入库单的上游单据（采购单）"""
        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        upstream = []

        # 关联采购单
        purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
        if purchase_order:
            upstream.append({
                "document_type": "purchase_order",
                "document_id": purchase_order.id,
                "document_code": purchase_order.order_code,
                "document_name": _order_display_name(purchase_order),
                "status": purchase_order.status,
                "created_at": to_api_isoformat(purchase_order.created_at) if purchase_order.created_at else None
            })

            # 如果采购单有来源，继续向上追溯（需求计算）
            if purchase_order.source_type and purchase_order.source_id and purchase_order.source_type in ("MRP", "LRP", "demand_computation"):
                computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=purchase_order.source_id)
                if computation:
                    upstream.append({
                        "document_type": "demand_computation",
                        "document_id": computation.id,
                        "document_code": computation.computation_code,
                        "document_name": f"需求计算-{computation.computation_code}",
                        "status": computation.computation_status,
                        "created_at": to_api_isoformat(computation.computation_start_time) if computation.computation_start_time else None
                    })
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                    if demand:
                        if demand.source_type == "sales_forecast" and demand.source_id:
                            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if forecast:
                                upstream.append({
                                    "document_type": "sales_forecast",
                                    "document_id": forecast.id,
                                    "document_code": forecast.forecast_code,
                                    "document_name": forecast.forecast_name,
                                    "status": forecast.status,
                                    "created_at": to_api_isoformat(forecast.created_at) if forecast.created_at else None
                                })
                        elif demand.source_type == "sales_order" and demand.source_id:
                            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if sales_order:
                                upstream.append({
                                    "document_type": "sales_order",
                                    "document_id": sales_order.id,
                                    "document_code": sales_order.order_code,
                                    "document_name": _order_display_name(sales_order),
                                    "status": sales_order.status,
                                    "created_at": to_api_isoformat(sales_order.created_at) if sales_order.created_at else None
                                })

        return upstream

    async def _get_purchase_return_upstream(
        self,
        tenant_id: int,
        return_id: int,
    ) -> List[Dict[str, Any]]:
        """获取采购退货单的上游单据（采购入库单、采购订单）"""
        pr = await PurchaseReturn.get_or_none(
            tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
        )
        if not pr:
            return []

        upstream: List[Dict[str, Any]] = []

        if pr.purchase_receipt_id:
            receipt = await PurchaseReceipt.get_or_none(
                tenant_id=tenant_id, id=pr.purchase_receipt_id
            )
            if receipt:
                upstream.append({
                    "document_type": "purchase_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status if hasattr(receipt, "status") else None,
                    "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None,
                })
                if receipt.purchase_order_id:
                    purchase_order = await PurchaseOrder.get_or_none(
                        tenant_id=tenant_id, id=receipt.purchase_order_id
                    )
                    if purchase_order:
                        upstream.append({
                            "document_type": "purchase_order",
                            "document_id": purchase_order.id,
                            "document_code": purchase_order.order_code,
                            "document_name": _order_display_name(purchase_order),
                            "status": purchase_order.status,
                            "created_at": to_api_isoformat(purchase_order.created_at)
                            if purchase_order.created_at
                            else None,
                        })
        elif pr.purchase_order_id:
            purchase_order = await PurchaseOrder.get_or_none(
                tenant_id=tenant_id, id=pr.purchase_order_id
            )
            if purchase_order:
                upstream.append({
                    "document_type": "purchase_order",
                    "document_id": purchase_order.id,
                    "document_code": purchase_order.order_code,
                    "document_name": _order_display_name(purchase_order),
                    "status": purchase_order.status,
                    "created_at": to_api_isoformat(purchase_order.created_at)
                    if purchase_order.created_at
                    else None,
                })

        return upstream

    async def _get_reporting_record_upstream(
        self,
        tenant_id: int,
        record_id: int,
    ) -> List[Dict[str, Any]]:
        """获取报工记录的上游单据（工单）"""
        rec = await ReportingRecord.get_or_none(
            tenant_id=tenant_id, id=record_id, deleted_at__isnull=True
        )
        if not rec:
            return []
        wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=rec.work_order_id)
        if not wo:
            return []
        return [{
            "document_type": "work_order",
            "document_id": wo.id,
            "document_code": wo.code,
            "document_name": getattr(wo, "name", None),
            "status": wo.status if hasattr(wo, "status") else None,
            "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None,
        }]

    async def _get_outsource_order_upstream(
        self,
        tenant_id: int,
        order_id: int,
    ) -> List[Dict[str, Any]]:
        """工序委外单的上游：工单"""
        oo = await OutsourceOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not oo:
            return []
        wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=oo.work_order_id)
        if not wo:
            return []
        return [{
            "document_type": "work_order",
            "document_id": wo.id,
            "document_code": wo.code,
            "document_name": getattr(wo, "name", None),
            "status": wo.status if hasattr(wo, "status") else None,
            "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None,
        }]

    async def _get_outsource_order_downstream(
        self,
        tenant_id: int,
        order_id: int,
    ) -> List[Dict[str, Any]]:
        """工序委外单的下游：关联的采购入库单（委外收货）"""
        oo = await OutsourceOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not oo or not getattr(oo, "purchase_receipt_id", None):
            return []
        pr = await PurchaseReceipt.get_or_none(
            tenant_id=tenant_id, id=oo.purchase_receipt_id
        )
        if not pr:
            return []
        return [{
            "document_type": "purchase_receipt",
            "document_id": pr.id,
            "document_code": pr.receipt_code,
            "document_name": None,
            "status": pr.status if hasattr(pr, "status") else None,
            "created_at": to_api_isoformat(pr.created_at) if pr.created_at else None,
        }]

    async def _get_packing_binding_upstream(
        self,
        tenant_id: int,
        binding_id: int,
    ) -> List[Dict[str, Any]]:
        """装箱绑定上游：成品入库单或销售出库单（二选一）"""
        pb = await PackingBinding.get_or_none(
            tenant_id=tenant_id, id=binding_id, deleted_at__isnull=True
        )
        if not pb:
            return []
        upstream: List[Dict[str, Any]] = []
        if pb.finished_goods_receipt_id:
            fr = await FinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id, id=pb.finished_goods_receipt_id
            )
            if fr:
                upstream.append({
                    "document_type": "finished_goods_receipt",
                    "document_id": fr.id,
                    "document_code": fr.receipt_code,
                    "document_name": None,
                    "status": fr.status if hasattr(fr, "status") else None,
                    "created_at": to_api_isoformat(fr.created_at) if fr.created_at else None,
                })
        if pb.sales_delivery_id:
            sd = await SalesDelivery.get_or_none(
                tenant_id=tenant_id, id=pb.sales_delivery_id
            )
            if sd:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": sd.id,
                    "document_code": sd.delivery_code,
                    "document_name": None,
                    "status": sd.status if hasattr(sd, "status") else None,
                    "created_at": to_api_isoformat(sd.created_at) if sd.created_at else None,
                })
        return upstream

    async def _get_receipt_notice_upstream(
        self,
        tenant_id: int,
        notice_id: int,
    ) -> List[Dict[str, Any]]:
        """收货通知单上游：采购订单"""
        rn = await ReceiptNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not rn or not rn.purchase_order_id:
            return []
        po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=rn.purchase_order_id)
        if not po:
            return []
        return [{
            "document_type": "purchase_order",
            "document_id": po.id,
            "document_code": po.order_code,
            "document_name": _order_display_name(po),
            "status": po.status if hasattr(po, "status") else None,
            "created_at": to_api_isoformat(po.created_at) if po.created_at else None,
        }]

    async def _get_receipt_notice_downstream(
        self,
        tenant_id: int,
        notice_id: int,
    ) -> List[Dict[str, Any]]:
        """收货通知单下游：已生成时关联采购入库单"""
        rn = await ReceiptNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not rn or not rn.purchase_receipt_id:
            return []
        pr = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=rn.purchase_receipt_id)
        if not pr:
            return []
        return [{
            "document_type": "purchase_receipt",
            "document_id": pr.id,
            "document_code": pr.receipt_code,
            "document_name": None,
            "status": pr.status if hasattr(pr, "status") else None,
            "created_at": to_api_isoformat(pr.created_at) if pr.created_at else None,
        }]

    async def _get_sales_return_upstream(
        self,
        tenant_id: int,
        return_id: int,
    ) -> List[Dict[str, Any]]:
        """销售退货单上游：销售出库单、销售订单"""
        sr = await SalesReturn.get_or_none(
            tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
        )
        if not sr:
            return []
        upstream: List[Dict[str, Any]] = []
        if sr.sales_delivery_id:
            sd = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=sr.sales_delivery_id)
            if sd:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": sd.id,
                    "document_code": sd.delivery_code,
                    "document_name": None,
                    "status": sd.status if hasattr(sd, "status") else None,
                    "created_at": to_api_isoformat(sd.created_at) if sd.created_at else None,
                })
        if sr.sales_order_id:
            so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sr.sales_order_id)
            if so:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": so.id,
                    "document_code": so.order_code,
                    "document_name": _order_display_name(so),
                    "status": so.status if hasattr(so, "status") else None,
                    "created_at": to_api_isoformat(so.created_at) if so.created_at else None,
                })
        return upstream

    async def _get_shipment_notice_upstream(
        self,
        tenant_id: int,
        notice_id: int,
    ) -> List[Dict[str, Any]]:
        """发货通知单上游：销售订单"""
        sn = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not sn or not sn.sales_order_id:
            return []
        so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sn.sales_order_id)
        if not so:
            return []
        return [{
            "document_type": "sales_order",
            "document_id": so.id,
            "document_code": so.order_code,
            "document_name": _order_display_name(so),
            "status": so.status if hasattr(so, "status") else None,
            "created_at": to_api_isoformat(so.created_at) if so.created_at else None,
        }]

    async def _get_shipment_notice_downstream(
        self,
        tenant_id: int,
        notice_id: int,
    ) -> List[Dict[str, Any]]:
        """发货通知单下游：已出库时关联销售出库单"""
        sn = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not sn or not sn.sales_delivery_id:
            return []
        sd = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=sn.sales_delivery_id)
        if not sd:
            return []
        return [{
            "document_type": "sales_delivery",
            "document_id": sd.id,
            "document_code": sd.delivery_code,
            "document_name": None,
            "status": sd.status if hasattr(sd, "status") else None,
            "created_at": to_api_isoformat(sd.created_at) if sd.created_at else None,
        }]

    async def _get_payable_upstream(
        self,
        tenant_id: int,
        payable_id: int
    ) -> List[Dict[str, Any]]:
        """获取应付单的上游单据（采购入库单 / 采购发票）"""
        payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
        if not payable:
            return []

        upstream = []

        # 通过source_type和source_id查找来源单据
        if payable.source_type == "采购入库" and payable.source_id:
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=payable.source_id)
            if receipt:
                upstream.append({
                    "document_type": "purchase_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
                })

                # 继续向上追溯采购单
                purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
                if purchase_order:
                    upstream.append({
                        "document_type": "purchase_order",
                        "document_id": purchase_order.id,
                        "document_code": purchase_order.order_code,
                        "document_name": _order_display_name(purchase_order),
                        "status": purchase_order.status,
                        "created_at": to_api_isoformat(purchase_order.created_at) if purchase_order.created_at else None
                    })

        elif payable.source_type == PAYABLE_SOURCE_PURCHASE_INVOICE and payable.source_id:
            pinv = await PurchaseInvoice.get_or_none(tenant_id=tenant_id, id=payable.source_id)
            if pinv:
                upstream.append({
                    "document_type": "purchase_invoice",
                    "document_id": pinv.id,
                    "document_code": pinv.invoice_code,
                    "document_name": pinv.invoice_number,
                    "status": pinv.status,
                    "created_at": to_api_isoformat(pinv.created_at) if pinv.created_at else None,
                })
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=pinv.purchase_order_id)
                if po:
                    upstream.append({
                        "document_type": "purchase_order",
                        "document_id": po.id,
                        "document_code": po.order_code,
                        "document_name": _order_display_name(po),
                        "status": po.status,
                        "created_at": to_api_isoformat(po.created_at) if po.created_at else None,
                    })
                receipts = await PurchaseReceipt.filter(
                    tenant_id=tenant_id,
                    purchase_order_id=pinv.purchase_order_id,
                    deleted_at__isnull=True,
                ).order_by("-id").limit(5)
                for pr in receipts:
                    upstream.append({
                        "document_type": "purchase_receipt",
                        "document_id": pr.id,
                        "document_code": pr.receipt_code,
                        "document_name": None,
                        "status": pr.status if hasattr(pr, "status") else None,
                        "created_at": to_api_isoformat(pr.created_at) if pr.created_at else None,
                    })

        return upstream

    async def _get_payable_downstream(
        self,
        tenant_id: int,
        payable_id: int,
    ) -> List[Dict[str, Any]]:
        """应付单下游：核销记录中的付款单"""
        payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
        if not payable:
            return []

        downstream: List[Dict[str, Any]] = []

        pinvs = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            payable_id=payable_id,
            deleted_at__isnull=True,
        ).limit(20)
        for inv in pinvs:
            downstream.append({
                "document_type": "purchase_invoice",
                "document_id": inv.id,
                "document_code": inv.invoice_code,
                "document_name": inv.invoice_number,
                "status": inv.status,
                "created_at": to_api_isoformat(inv.created_at) if inv.created_at else None,
            })

        settlements = await SettlementRecord.filter(
            tenant_id=tenant_id,
            debit_doc_type="Payable",
            debit_doc_id=payable_id,
            credit_doc_type="Payment",
            deleted_at__isnull=True,
            is_active=True,
        ).limit(100)
        seen_pid: set = set()
        for st in settlements:
            pid = st.credit_doc_id
            if not pid or pid in seen_pid:
                continue
            seen_pid.add(pid)
            pv = await Payment.get_or_none(
                tenant_id=tenant_id, id=pid, deleted_at__isnull=True
            )
            if not pv:
                continue
            downstream.append({
                "document_type": "payment",
                "document_id": pv.id,
                "document_code": pv.payment_code,
                "document_name": pv.supplier_name,
                "status": pv.status,
                "created_at": to_api_isoformat(pv.created_at) if pv.created_at else None,
            })
        return _dedupe_relation_documents(downstream)

    async def _get_incoming_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取来料检验单的上游单据（采购入库单）"""
        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联采购入库单
        if inspection.purchase_receipt_id:
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=inspection.purchase_receipt_id)
            if receipt:
                upstream.append({
                    "document_type": "purchase_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
                })

                # 继续向上追溯采购单
                purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
                if purchase_order:
                    upstream.append({
                        "document_type": "purchase_order",
                        "document_id": purchase_order.id,
                        "document_code": purchase_order.order_code,
                        "document_name": _order_display_name(purchase_order),
                        "status": purchase_order.status,
                        "created_at": to_api_isoformat(purchase_order.created_at) if purchase_order.created_at else None
                    })

        return upstream

    async def _get_process_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取过程检验单的上游单据（工单、报工记录）"""
        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联工单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.work_order import WorkOrder
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=inspection.work_order_id)
            if work_order:
                upstream.append({
                    "document_type": "work_order",
                    "document_id": work_order.id,
                    "document_code": work_order.code,
                    "document_name": work_order.name,
                    "status": work_order.status,
                    "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None
                })

        # 关联报工记录
        if inspection.work_order_id and inspection.operation_id:
            from apps.kuaizhizao.models.reporting_record import ReportingRecord
            reporting = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=inspection.work_order_id,
                operation_id=inspection.operation_id
            ).order_by('-created_at').first()
            
            if reporting:
                upstream.append(self._reporting_record_trace_dict(reporting))

        return upstream

    async def _get_finished_goods_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品检验单的上游单据（工单、成品入库单）"""
        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联工单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.work_order import WorkOrder
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=inspection.work_order_id)
            if work_order:
                upstream.append({
                    "document_type": "work_order",
                    "document_id": work_order.id,
                    "document_code": work_order.code,
                    "document_name": work_order.name,
                    "status": work_order.status,
                    "created_at": to_api_isoformat(work_order.created_at) if work_order.created_at else None
                })

        # 关联成品入库单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
            receipt = await FinishedGoodsReceipt.filter(
                tenant_id=tenant_id,
                work_order_id=inspection.work_order_id
            ).order_by('-created_at').first()
            
            if receipt:
                upstream.append({
                    "document_type": "finished_goods_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
                })

        return upstream

    async def _get_sales_delivery_upstream(
        self,
        tenant_id: int,
        delivery_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售出库单的上游单据（销售订单、工单、成品入库单）"""
        delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=delivery_id)
        if not delivery:
            return []

        upstream = []

        # 关联销售订单
        if delivery.sales_order_id:
            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=delivery.sales_order_id)
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": _order_display_name(order),
                    "status": order.status,
                    "created_at": to_api_isoformat(order.created_at) if order.created_at else None
                })

        # 关联工单（通过销售订单查找）
        if delivery.sales_order_id:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=delivery.sales_order_id
            ).limit(10)
            for wo in work_orders:
                upstream.append({
                    "document_type": "work_order",
                    "document_id": wo.id,
                    "document_code": wo.code,
                    "document_name": wo.name,
                    "status": wo.status,
                    "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
                })

        # 关联成品入库单（通过工单查找）
        if delivery.sales_order_id:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=delivery.sales_order_id
            ).limit(10)
            for wo in work_orders:
                receipts = await FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=wo.id
                ).limit(10)
                for receipt in receipts:
                    upstream.append({
                        "document_type": "finished_goods_receipt",
                        "document_id": receipt.id,
                        "document_code": receipt.receipt_code if hasattr(receipt, 'receipt_code') else None,
                        "document_name": None,
                        "status": receipt.status if hasattr(receipt, 'status') else None,
                        "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
                    })

        return upstream

    async def _get_sales_delivery_downstream(
        self,
        tenant_id: int,
        delivery_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售出库单的下游单据（应收单、送货单）"""
        downstream = []

        # 查找关联的送货单
        notices = await DeliveryNotice.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True
        ).limit(10)
        for notice in notices:
            downstream.append({
                "document_type": "delivery_notice",
                "document_id": notice.id,
                "document_code": notice.notice_code,
                "document_name": None,
                "status": notice.status,
                "created_at": to_api_isoformat(notice.created_at) if notice.created_at else None,
            })

        # 通过source_type和source_id查找应收单
        receivables = await Receivable.filter(
            tenant_id=tenant_id,
            source_type="销售出库",
            source_id=delivery_id
        ).limit(10)
        for receivable in receivables:
            downstream.append({
                "document_type": "receivable",
                "document_id": receivable.id,
                "document_code": receivable.receivable_code if hasattr(receivable, 'receivable_code') else None,
                "document_name": None,
                "status": receivable.status if hasattr(receivable, 'status') else None,
                "created_at": to_api_isoformat(receivable.created_at) if receivable.created_at else None
            })

        # 销售退货单
        sales_returns = await SalesReturn.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True
        ).limit(10)
        for sr in sales_returns:
            downstream.append({
                "document_type": "sales_return",
                "document_id": sr.id,
                "document_code": sr.return_code,
                "document_name": None,
                "status": sr.status if hasattr(sr, 'status') else None,
                "created_at": to_api_isoformat(sr.created_at) if sr.created_at else None
            })

        return downstream

    async def _get_receivable_upstream(
        self,
        tenant_id: int,
        receivable_id: int
    ) -> List[Dict[str, Any]]:
        """获取应收单的上游单据（销售出库单 / 销项发票→销售订单等）"""
        receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
        if not receivable:
            return []

        upstream = []

        # 通过source_type和source_id查找来源单据
        if receivable.source_type == "销售出库" and receivable.source_id:
            delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=receivable.source_id)
            if delivery:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                    "document_name": None,
                    "status": delivery.status if hasattr(delivery, 'status') else None,
                    "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
                })

                # 继续向上追溯销售订单
                if delivery.sales_order_id:
                    sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=delivery.sales_order_id)
                    if sales_order:
                        upstream.append({
                            "document_type": "sales_order",
                            "document_id": sales_order.id,
                            "document_code": sales_order.order_code,
                            "document_name": _order_display_name(sales_order),
                            "status": sales_order.status,
                            "created_at": to_api_isoformat(sales_order.created_at) if sales_order.created_at else None
                        })

        elif receivable.source_type == RECEIVABLE_SOURCE_SALES_INVOICE and receivable.source_id:
            inv = await Invoice.get_or_none(
                tenant_id=tenant_id, id=receivable.source_id, category="OUT"
            )
            if inv:
                upstream.append({
                    "document_type": "sales_invoice",
                    "document_id": inv.id,
                    "document_code": inv.invoice_code,
                    "document_name": inv.invoice_number,
                    "status": inv.status,
                    "created_at": to_api_isoformat(inv.created_at) if inv.created_at else None,
                })
                so_code = (inv.source_document_code or "").strip()
                if so_code:
                    sales_order = await SalesOrder.get_or_none(
                        tenant_id=tenant_id, order_code=so_code
                    )
                    if sales_order:
                        upstream.append({
                            "document_type": "sales_order",
                            "document_id": sales_order.id,
                            "document_code": sales_order.order_code,
                            "document_name": _order_display_name(sales_order),
                            "status": sales_order.status,
                            "created_at": to_api_isoformat(sales_order.created_at) if sales_order.created_at else None,
                        })

        return upstream

    async def _get_receivable_downstream(
        self,
        tenant_id: int,
        receivable_id: int,
    ) -> List[Dict[str, Any]]:
        """应收单下游：关联销项发票、核销产生的收款单"""
        receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
        if not receivable:
            return []

        downstream: List[Dict[str, Any]] = []

        invoices = await Invoice.filter(
            tenant_id=tenant_id,
            receivable_id=receivable_id,
            category="OUT",
        ).limit(20)
        for inv in invoices:
            downstream.append({
                "document_type": "sales_invoice",
                "document_id": inv.id,
                "document_code": inv.invoice_code,
                "document_name": inv.invoice_number,
                "status": inv.status,
                "created_at": to_api_isoformat(inv.created_at) if inv.created_at else None,
            })

        settlements = await SettlementRecord.filter(
            tenant_id=tenant_id,
            debit_doc_type="Receivable",
            debit_doc_id=receivable_id,
            credit_doc_type="Receipt",
            deleted_at__isnull=True,
            is_active=True,
        ).limit(100)
        seen_rid: set = set()
        for st in settlements:
            rid = st.credit_doc_id
            if not rid or rid in seen_rid:
                continue
            seen_rid.add(rid)
            rc = await Receipt.get_or_none(
                tenant_id=tenant_id, id=rid, deleted_at__isnull=True
            )
            if not rc:
                continue
            downstream.append({
                "document_type": "receipt",
                "document_id": rc.id,
                "document_code": rc.receipt_code,
                "document_name": rc.customer_name,
                "status": rc.status,
                "created_at": to_api_isoformat(rc.created_at) if rc.created_at else None,
            })

        return _dedupe_relation_documents(downstream)

    async def _get_sales_invoice_upstream(
        self,
        tenant_id: int,
        invoice_id: int,
    ) -> List[Dict[str, Any]]:
        """销项发票上游：蓝字原票、关联表、来源销售订单号"""
        inv = await Invoice.get_or_none(
            tenant_id=tenant_id, id=invoice_id, category="OUT"
        )
        if not inv:
            return []

        upstream: List[Dict[str, Any]] = []

        if inv.original_invoice_id:
            parent = await Invoice.get_or_none(
                tenant_id=tenant_id, id=inv.original_invoice_id, category="OUT"
            )
            if parent:
                upstream.append({
                    "document_type": "sales_invoice",
                    "document_id": parent.id,
                    "document_code": parent.invoice_code,
                    "document_name": parent.invoice_number,
                    "status": parent.status,
                    "created_at": to_api_isoformat(parent.created_at) if parent.created_at else None,
                })

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="sales_invoice",
            target_id=invoice_id,
        ).limit(30)
        for rel in rels:
            upstream.append({
                "document_type": rel.source_type,
                "document_id": rel.source_id,
                "document_code": rel.source_code,
                "document_name": rel.source_name,
                "status": None,
                "created_at": to_api_isoformat(rel.created_at) if rel.created_at else None,
            })

        so_code = (inv.source_document_code or "").strip()
        if so_code:
            sales_order = await SalesOrder.get_or_none(
                tenant_id=tenant_id, order_code=so_code, deleted_at__isnull=True
            )
            if sales_order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": sales_order.id,
                    "document_code": sales_order.order_code,
                    "document_name": _order_display_name(sales_order),
                    "status": sales_order.status,
                    "created_at": to_api_isoformat(sales_order.created_at) if sales_order.created_at else None,
                })

        return _dedupe_relation_documents(upstream)

    async def _get_sales_invoice_downstream(
        self,
        tenant_id: int,
        invoice_id: int,
    ) -> List[Dict[str, Any]]:
        """销项发票下游：应收单、红字发票、关联表下推目标"""
        inv = await Invoice.get_or_none(
            tenant_id=tenant_id, id=invoice_id, category="OUT"
        )
        if not inv:
            return []

        downstream: List[Dict[str, Any]] = []

        if inv.receivable_id:
            ar = await Receivable.get_or_none(tenant_id=tenant_id, id=inv.receivable_id)
            if ar:
                downstream.append({
                    "document_type": "receivable",
                    "document_id": ar.id,
                    "document_code": ar.receivable_code,
                    "document_name": ar.customer_name,
                    "status": ar.status if hasattr(ar, "status") else None,
                    "created_at": to_api_isoformat(ar.created_at) if ar.created_at else None,
                })

        red_children = await Invoice.filter(
            tenant_id=tenant_id,
            category="OUT",
            original_invoice_id=invoice_id,
        ).limit(15)
        for child in red_children:
            downstream.append({
                "document_type": "sales_invoice",
                "document_id": child.id,
                "document_code": child.invoice_code,
                "document_name": child.invoice_number,
                "status": child.status,
                "created_at": to_api_isoformat(child.created_at) if child.created_at else None,
            })

        if inv.red_flush_invoice_id:
            red = await Invoice.get_or_none(
                tenant_id=tenant_id, id=inv.red_flush_invoice_id, category="OUT"
            )
            if red:
                downstream.append({
                    "document_type": "sales_invoice",
                    "document_id": red.id,
                    "document_code": red.invoice_code,
                    "document_name": red.invoice_number,
                    "status": red.status,
                    "created_at": to_api_isoformat(red.created_at) if red.created_at else None,
                })

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_invoice",
            source_id=invoice_id,
        ).limit(30)
        for rel in rels:
            downstream.append({
                "document_type": rel.target_type,
                "document_id": rel.target_id,
                "document_code": rel.target_code,
                "document_name": rel.target_name,
                "status": None,
                "created_at": to_api_isoformat(rel.created_at) if rel.created_at else None,
            })

        return _dedupe_relation_documents(downstream)

    async def _get_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int,
    ) -> List[Dict[str, Any]]:
        """收款单上游：核销记录中的应收单等借方单据"""
        rc = await Receipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not rc:
            return []

        upstream: List[Dict[str, Any]] = []
        settlements = await SettlementRecord.filter(
            tenant_id=tenant_id,
            credit_doc_type="Receipt",
            credit_doc_id=receipt_id,
            deleted_at__isnull=True,
            is_active=True,
        ).limit(100)
        seen: set = set()
        for st in settlements:
            key = (st.debit_doc_type, st.debit_doc_id)
            if key in seen:
                continue
            seen.add(key)
            if st.debit_doc_type == "Receivable" and st.debit_doc_id:
                ar = await Receivable.get_or_none(tenant_id=tenant_id, id=st.debit_doc_id)
                if ar:
                    upstream.append({
                        "document_type": "receivable",
                        "document_id": ar.id,
                        "document_code": ar.receivable_code,
                        "document_name": ar.customer_name,
                        "status": ar.status if hasattr(ar, "status") else None,
                        "created_at": to_api_isoformat(ar.created_at) if ar.created_at else None,
                    })
        return _dedupe_relation_documents(upstream)

    async def _get_payment_upstream(
        self,
        tenant_id: int,
        payment_id: int,
    ) -> List[Dict[str, Any]]:
        """付款单上游：核销记录中的应付单"""
        pv = await Payment.get_or_none(
            tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
        )
        if not pv:
            return []

        upstream: List[Dict[str, Any]] = []
        settlements = await SettlementRecord.filter(
            tenant_id=tenant_id,
            credit_doc_type="Payment",
            credit_doc_id=payment_id,
            deleted_at__isnull=True,
            is_active=True,
        ).limit(100)
        seen: set = set()
        for st in settlements:
            key = (st.debit_doc_type, st.debit_doc_id)
            if key in seen:
                continue
            seen.add(key)
            if st.debit_doc_type == "Payable" and st.debit_doc_id:
                py = await Payable.get_or_none(tenant_id=tenant_id, id=st.debit_doc_id)
                if py:
                    upstream.append({
                        "document_type": "payable",
                        "document_id": py.id,
                        "document_code": py.payable_code,
                        "document_name": py.supplier_name if hasattr(py, "supplier_name") else None,
                        "status": py.status if hasattr(py, "status") else None,
                        "created_at": to_api_isoformat(py.created_at) if py.created_at else None,
                    })
        return _dedupe_relation_documents(upstream)

    async def _get_purchase_invoice_upstream(
        self,
        tenant_id: int,
        invoice_id: int,
    ) -> List[Dict[str, Any]]:
        """采购发票上游：采购订单、关联表来源单据"""
        pinv = await PurchaseInvoice.get_or_none(
            tenant_id=tenant_id, id=invoice_id, deleted_at__isnull=True
        )
        if not pinv:
            return []

        upstream: List[Dict[str, Any]] = []

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="purchase_invoice",
            target_id=invoice_id,
        ).limit(30)
        for rel in rels:
            upstream.append({
                "document_type": rel.source_type,
                "document_id": rel.source_id,
                "document_code": rel.source_code,
                "document_name": rel.source_name,
                "status": None,
                "created_at": to_api_isoformat(rel.created_at) if rel.created_at else None,
            })

        if pinv.purchase_order_id:
            po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=pinv.purchase_order_id)
            if po:
                upstream.append({
                    "document_type": "purchase_order",
                    "document_id": po.id,
                    "document_code": po.order_code,
                    "document_name": _order_display_name(po),
                    "status": po.status if hasattr(po, "status") else None,
                    "created_at": to_api_isoformat(po.created_at) if po.created_at else None,
                })

        return _dedupe_relation_documents(upstream)

    async def _get_purchase_invoice_downstream(
        self,
        tenant_id: int,
        invoice_id: int,
    ) -> List[Dict[str, Any]]:
        """采购发票下游：应付单、关联表目标单据"""
        pinv = await PurchaseInvoice.get_or_none(
            tenant_id=tenant_id, id=invoice_id, deleted_at__isnull=True
        )
        if not pinv:
            return []

        downstream: List[Dict[str, Any]] = []

        if pinv.payable_id:
            py = await Payable.get_or_none(tenant_id=tenant_id, id=pinv.payable_id)
            if py:
                downstream.append({
                    "document_type": "payable",
                    "document_id": py.id,
                    "document_code": py.payable_code,
                    "document_name": py.supplier_name if hasattr(py, "supplier_name") else None,
                    "status": py.status if hasattr(py, "status") else None,
                    "created_at": to_api_isoformat(py.created_at) if py.created_at else None,
                })

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="purchase_invoice",
            source_id=invoice_id,
        ).limit(30)
        for rel in rels:
            downstream.append({
                "document_type": rel.target_type,
                "document_id": rel.target_id,
                "document_code": rel.target_code,
                "document_name": rel.target_name,
                "status": None,
                "created_at": to_api_isoformat(rel.created_at) if rel.created_at else None,
            })

        return _dedupe_relation_documents(downstream)

    # ============ 下游单据查询方法 ============

    async def _get_sales_forecast_downstream(
        self,
        tenant_id: int,
        forecast_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售预测的下游单据（需求计算、工单、采购单、销售出库单）"""
        downstream = []

        # 通过 Demand 查找需求计算
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id=forecast_id,
            deleted_at__isnull=True,
        )
        if demand and demand.computation_id:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
            if comp:
                downstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": to_api_isoformat(comp.computation_start_time) if comp.computation_start_time else None
                })
                # 通过需求计算查找采购单（source_type 为 MRP 或 demand_computation，source_id 为 computation_id）
                purchase_orders = await PurchaseOrder.filter(
                    tenant_id=tenant_id,
                    source_id=comp.id,
                ).limit(10)
                for po in purchase_orders:
                    downstream.append({
                        "document_type": "purchase_order",
                        "document_id": po.id,
                        "document_code": po.order_code,
                        "document_name": _order_display_name(po),
                        "status": po.status,
                        "created_at": to_api_isoformat(po.created_at) if po.created_at else None
                    })

        # 通过 DemandItem 查找工单（MTS 模式）
        from apps.kuaizhizao.models.demand_item import DemandItem
        if demand:
            demand_items = await DemandItem.filter(tenant_id=tenant_id, demand_id=demand.id).limit(20)
            work_order_ids = [di.work_order_id for di in demand_items if di.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(tenant_id=tenant_id, id__in=work_order_ids).limit(10)
                for wo in work_orders:
                    downstream.append({
                        "document_type": "work_order",
                        "document_id": wo.id,
                        "document_code": wo.code,
                        "document_name": wo.name,
                        "status": wo.status,
                        "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
                    })

        return downstream

    async def _get_demand_downstream(
        self,
        tenant_id: int,
        demand_id: int
    ) -> List[Dict[str, Any]]:
        """获取统一需求的下游单据（需求计算、工单、销售出库单）"""
        downstream = []
        
        # 获取需求
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
        if not demand:
            return []
        
        # 如果已下推到需求计算，显示计算编码
        if demand.pushed_to_computation and demand.computation_code:
            downstream.append({
                "document_type": "demand_computation",
                "document_id": demand.computation_id or 0,
                "document_code": demand.computation_code,
                "document_name": f"需求计算-{demand.computation_code}",
                "status": "已下推",
                "created_at": to_api_isoformat(demand.updated_at) if demand.updated_at else None
            })
        
        # 根据需求类型查询下游单据
        if demand.demand_type == "sales_forecast":
            # 销售预测的下游：MRP运算结果、工单、销售出库单
            # TODO: 步骤1.2实现统一需求计算后，这里应该查询需求计算结果
            # 目前先查询通过需求明细关联的工单
            from apps.kuaizhizao.models.demand_item import DemandItem
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).limit(10)
            
            # 通过需求明细的work_order_id查找工单
            work_order_ids = [item.work_order_id for item in demand_items if item.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    id__in=work_order_ids
                ).limit(10)
                for wo in work_orders:
                    downstream.append({
                        "document_type": "work_order",
                        "document_id": wo.id,
                        "document_code": wo.code,
                        "document_name": wo.name,
                        "status": wo.status,
                        "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
                    })
        
        elif demand.demand_type == "sales_order":
            # 销售订单的下游：LRP运算结果、工单、销售出库单
            # TODO: 步骤1.2实现统一需求计算后，这里应该查询需求计算结果
            # 目前先查询通过需求明细关联的工单
            from apps.kuaizhizao.models.demand_item import DemandItem
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).limit(10)
            
            # 通过需求明细的work_order_id查找工单
            work_order_ids = [item.work_order_id for item in demand_items if item.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    id__in=work_order_ids
                ).limit(10)
                for wo in work_orders:
                    downstream.append({
                        "document_type": "work_order",
                        "document_id": wo.id,
                        "document_code": wo.code,
                        "document_name": wo.name,
                        "status": wo.status,
                        "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
                    })
            
            # 销售出库单（通过销售订单ID关联）
            sales_deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_order_id=demand_id  # TODO: 需要确认SalesDelivery是否有sales_order_id字段
            ).limit(10)
            for delivery in sales_deliveries:
                downstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code,
                    "document_name": None,
                    "status": delivery.status,
                    "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
                })
        
        return downstream

    async def _get_sales_order_downstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售订单的下游单据（需求计算、工单、销售出库单）"""
        downstream = []

        # 通过 Demand 查找需求计算
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            deleted_at__isnull=True,
        )
        if demand and demand.computation_id:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
            if comp:
                downstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": to_api_isoformat(comp.computation_start_time) if comp.computation_start_time else None
                })

        # 工单（MTO模式）
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).limit(10)
        for wo in work_orders:
            downstream.append({
                "document_type": "work_order",
                "document_id": wo.id,
                "document_code": wo.code,
                "document_name": wo.name,
                "status": wo.status,
                "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
            })

        # 销售出库单
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).limit(10)
        for delivery in deliveries:
            downstream.append({
                "document_type": "sales_delivery",
                "document_id": delivery.id,
                "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                "document_name": None,
                "status": delivery.status if hasattr(delivery, 'status') else None,
                "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
            })

        so = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if so and (so.order_code or "").strip():
            oc = so.order_code.strip()
            invs = await Invoice.filter(
                tenant_id=tenant_id,
                category="OUT",
                source_document_code=oc,
            ).limit(20)
            for inv in invs:
                downstream.append({
                    "document_type": "sales_invoice",
                    "document_id": inv.id,
                    "document_code": inv.invoice_code,
                    "document_name": inv.invoice_number,
                    "status": inv.status,
                    "created_at": to_api_isoformat(inv.created_at) if inv.created_at else None,
                })

        return _dedupe_relation_documents(downstream)

    async def get_change_impact_sales_order(
        self,
        tenant_id: int,
        order_id: int
    ) -> Dict[str, Any]:
        """
        获取销售订单变更对下游的影响范围（排程管理增强）
        用于上游单据变更时，展示受影响的需求、需求计算、生产计划、工单及建议操作。

        .. deprecated:: 请使用 DocumentRelationNewService.get_change_impact_sales_order，
           与 trace 使用相同数据源（get_relations），保证变更影响与追溯链一致。
        """
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")

        upstream_change = {
            "type": "sales_order",
            "id": order.id,
            "code": getattr(order, "order_code", None),
            "name": _order_display_name(order),
            "changed_at": to_api_isoformat(order.updated_at) if order.updated_at else None,
        }

        affected_demands = []
        affected_computations = []
        affected_plans = []
        affected_work_orders = []
        computation_ids = set()

        # 需求（source_type=sales_order, source_id=order_id）
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            deleted_at__isnull=True,
        ).all()
        for d in demands:
            affected_demands.append({
                "id": d.id,
                "code": getattr(d, "demand_code", None),
                "name": getattr(d, "demand_name", None),
                "status": getattr(d, "status", None),
            })
            if getattr(d, "computation_id", None):
                computation_ids.add(d.computation_id)

        # 需求计算
        for cid in computation_ids:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=cid)
            if comp:
                affected_computations.append({
                    "id": comp.id,
                    "code": getattr(comp, "computation_code", None),
                    "name": None,
                    "status": getattr(comp, "computation_status", None),
                })

        # 工单（sales_order_id 或 source_id 为 computation_id）
        wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id,
            deleted_at__isnull=True,
        ).all()
        for wo in wos:
            affected_work_orders.append({
                "id": wo.id,
                "code": getattr(wo, "code", None),
                "name": getattr(wo, "name", None),
                "status": getattr(wo, "status", None),
            })
        wo_ids = {wo.id for wo in wos}
        for cid in computation_ids:
            more_wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for wo in more_wos:
                if wo.id not in wo_ids:
                    wo_ids.add(wo.id)
                    affected_work_orders.append({
                        "id": wo.id,
                        "code": getattr(wo, "code", None),
                        "name": getattr(wo, "name", None),
                        "status": getattr(wo, "status", None),
                    })

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def get_change_impact_demand(
        self,
        tenant_id: int,
        demand_id: int
    ) -> Dict[str, Any]:
        """
        获取需求变更对下游的影响范围（排程管理增强）

        .. deprecated:: 请使用 DocumentRelationNewService.get_change_impact_demand，
           与 trace 使用相同数据源（get_relations），保证变更影响与追溯链一致。
        """
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
        if not demand:
            raise NotFoundError(f"需求不存在: {demand_id}")

        upstream_change = {
            "type": "demand",
            "id": demand.id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "changed_at": to_api_isoformat(demand.updated_at) if demand.updated_at else None,
        }

        affected_demands = [{
            "id": demand.id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "status": getattr(demand, "status", None),
        }]
        affected_computations = []
        affected_plans = []
        affected_work_orders = []
        computation_ids = set()

        if getattr(demand, "computation_id", None):
            computation_ids.add(demand.computation_id)

        for cid in computation_ids:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=cid)
            if comp:
                affected_computations.append({
                    "id": comp.id,
                    "code": getattr(comp, "computation_code", None),
                    "name": None,
                    "status": getattr(comp, "computation_status", None),
                })

        for cid in computation_ids:
            wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for wo in wos:
                affected_work_orders.append({
                    "id": wo.id,
                    "code": getattr(wo, "code", None),
                    "name": getattr(wo, "name", None),
                    "status": getattr(wo, "status", None),
                })
        if getattr(demand, "source_type", None) == "sales_order" and getattr(demand, "source_id", None):
            so_wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=demand.source_id,
                deleted_at__isnull=True,
            ).all()
            wo_ids = {w["id"] for w in affected_work_orders}
            for wo in so_wos:
                if wo.id not in wo_ids:
                    affected_work_orders.append({
                        "id": wo.id,
                        "code": getattr(wo, "code", None),
                        "name": getattr(wo, "name", None),
                        "status": getattr(wo, "status", None),
                    })

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def apply_upstream_change_impact(
        self,
        tenant_id: int,
        upstream_type: str,
        upstream_id: int,
        auto_mark_pending_recompute: bool = True,
    ) -> int:
        """
        上游变更后应用计划锁定策略（排程管理增强）
        - 计划 locked/executing：不自动标记，仅通过 change-impact API 提示
        - 计划 draft/submitted：可配置为自动标记 needs_recompute
        返回被标记为待重算的计划数量。
        """
        if upstream_type == "sales_order":
            impact = await self.get_change_impact_sales_order(tenant_id, upstream_id)
        elif upstream_type == "demand":
            impact = await self.get_change_impact_demand(tenant_id, upstream_id)
        else:
            return 0

        marked = 0
        if not auto_mark_pending_recompute:
            return 0

        return marked

    async def _get_quotation_downstream(
        self,
        tenant_id: int,
        quotation_id: int
    ) -> List[Dict[str, Any]]:
        """获取报价单的下游单据（转订单后的销售订单）"""
        downstream = []
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if quotation and quotation.contract_id:
            downstream.append({
                "document_type": "sales_contract",
                "document_id": quotation.contract_id,
                "document_code": quotation.contract_code,
                "document_name": None,
                "status": None,
                "created_at": None,
            })
        if quotation and quotation.sales_order_id:
            downstream.append({
                "document_type": "sales_order",
                "document_id": quotation.sales_order_id,
                "document_code": quotation.sales_order_code,
                "document_name": None,
                "status": None,
                "created_at": None,
            })
        return downstream

    async def _get_sales_contract_upstream(
        self,
        tenant_id: int,
        contract_id: int,
    ) -> List[Dict[str, Any]]:
        """获取销售合同的上游单据（来源报价单）"""
        upstream: List[Dict[str, Any]] = []
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if contract and contract.quotation_id:
            quotation = await Quotation.get_or_none(
                tenant_id=tenant_id, id=contract.quotation_id, deleted_at__isnull=True
            )
            if quotation:
                upstream.append({
                    "document_type": "quotation",
                    "document_id": quotation.id,
                    "document_code": quotation.quotation_code,
                    "document_name": None,
                    "status": quotation.status,
                    "created_at": to_api_isoformat(quotation.created_at) if quotation.created_at else None,
                })
        return upstream

    async def _get_sales_contract_downstream(
        self,
        tenant_id: int,
        contract_id: int,
    ) -> List[Dict[str, Any]]:
        """获取销售合同的下游单据（释放的销售订单）"""
        downstream: List[Dict[str, Any]] = []
        orders = await SalesOrder.filter(
            tenant_id=tenant_id,
            contract_id=contract_id,
            deleted_at__isnull=True,
        ).order_by("-created_at").limit(20)
        backfill_order_ids = await self._sales_order_backfill_contract_order_ids(
            tenant_id, contract_id
        )
        for order in orders:
            if order.id in backfill_order_ids:
                continue
            downstream.append({
                "document_type": "sales_order",
                "document_id": order.id,
                "document_code": order.order_code,
                "document_name": _order_display_name(order),
                "status": order.status,
                "created_at": to_api_isoformat(order.created_at) if order.created_at else None,
            })
        return downstream

    async def _get_material_borrow_downstream(
        self,
        tenant_id: int,
        borrow_id: int
    ) -> List[Dict[str, Any]]:
        """获取借料单的下游单据（还料单）"""
        downstream = []
        returns = await MaterialReturn.filter(
            tenant_id=tenant_id, borrow_id=borrow_id, deleted_at__isnull=True
        ).limit(10)
        for r in returns:
            downstream.append({
                "document_type": "material_return",
                "document_id": r.id,
                "document_code": r.return_code,
                "document_name": None,
                "status": r.status,
                "created_at": to_api_isoformat(r.created_at) if r.created_at else None,
            })
        return downstream

    async def _get_delivery_notice_upstream(
        self,
        tenant_id: int,
        notice_id: int
    ) -> List[Dict[str, Any]]:
        """获取送货单的上游单据（销售出库单、销售订单）"""
        upstream = []
        notice = await DeliveryNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            return upstream
        if notice.sales_delivery_id:
            delivery = await SalesDelivery.get_or_none(
                tenant_id=tenant_id, id=notice.sales_delivery_id
            )
            if delivery:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code,
                    "document_name": None,
                    "status": delivery.status,
                    "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None,
                })
        if notice.sales_order_id:
            order = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=notice.sales_order_id
            )
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": _order_display_name(order),
                    "status": order.status,
                    "created_at": to_api_isoformat(order.created_at) if order.created_at else None,
                })
        return upstream

    async def _get_material_return_upstream(
        self,
        tenant_id: int,
        return_id: int
    ) -> List[Dict[str, Any]]:
        """获取还料单的上游单据（借料单）"""
        upstream = []
        return_obj = await MaterialReturn.get_or_none(
            tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
        )
        if return_obj and return_obj.borrow_id:
            borrow = await MaterialBorrow.get_or_none(
                tenant_id=tenant_id, id=return_obj.borrow_id, deleted_at__isnull=True
            )
            if borrow:
                upstream.append({
                    "document_type": "material_borrow",
                    "document_id": borrow.id,
                    "document_code": borrow.borrow_code,
                    "document_name": None,
                    "status": borrow.status,
                    "created_at": to_api_isoformat(borrow.created_at) if borrow.created_at else None,
                })
        return upstream

    async def _get_demand_computation_downstream(
        self,
        tenant_id: int,
        computation_id: int
    ) -> List[Dict[str, Any]]:
        """获取需求计算的下游单据（工单、采购单）"""
        downstream = []

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            return downstream

        # 通过 DocumentRelation 查找工单（demand_computation 下推时创建）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        wo_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            target_type="work_order",
        ).limit(10)
        for rel in wo_relations:
            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=rel.target_id, deleted_at__isnull=True)
            if wo:
                downstream.append({
                    "document_type": "work_order",
                    "document_id": wo.id,
                    "document_code": wo.code,
                    "document_name": wo.name,
                    "status": wo.status,
                    "created_at": to_api_isoformat(wo.created_at) if wo.created_at else None
                })

        # 通过 source_id 查找采购单（PurchaseOrder.source_id 为 DemandComputation.id）
        purchase_orders = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            source_id=computation_id,
        ).limit(10)
        for po in purchase_orders:
            downstream.append({
                "document_type": "purchase_order",
                "document_id": po.id,
                "document_code": po.order_code,
                "document_name": _order_display_name(po),
                "status": po.status,
                "created_at": to_api_isoformat(po.created_at) if po.created_at else None
            })

        return downstream

    async def _get_work_order_downstream(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        """获取工单的下游单据（生产领料、报工记录、成品入库、销售出库）"""
        downstream = []

        # 生产领料单
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for picking in pickings:
            downstream.append({
                "document_type": "production_picking",
                "document_id": picking.id,
                "document_code": picking.picking_code,
                "document_name": None,
                "status": picking.status,
                "created_at": to_api_isoformat(picking.created_at) if picking.created_at else None
            })

        # 生产退料单
        production_returns = await ProductionReturn.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for ret in production_returns:
            downstream.append({
                "document_type": "production_return",
                "document_id": ret.id,
                "document_code": ret.return_code,
                "document_name": None,
                "status": ret.status,
                "created_at": to_api_isoformat(ret.created_at) if ret.created_at else None
            })

        # 报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("operation_id", "id").limit(self.REPORTING_RECORD_TRACE_LIMIT)
        for record in reporting_records:
            downstream.append(self._reporting_record_trace_dict(record))

        # 成品入库单
        receipts = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for receipt in receipts:
            downstream.append({
                "document_type": "finished_goods_receipt",
                "document_id": receipt.id,
                "document_code": receipt.receipt_code,
                "document_name": None,
                "status": receipt.status,
                "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
            })

        semi_receipts = await SemiFinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).limit(10)
        for receipt in semi_receipts:
            downstream.append({
                "document_type": "semi_finished_goods_receipt",
                "document_id": receipt.id,
                "document_code": receipt.receipt_code,
                "document_name": None,
                "status": receipt.status,
                "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
            })

        # 销售出库单（通过成品入库单关联）
        for receipt in receipts:
            if receipt.sales_order_id:
                deliveries = await SalesDelivery.filter(
                    tenant_id=tenant_id,
                    sales_order_id=receipt.sales_order_id
                ).limit(5)
                for delivery in deliveries:
                    downstream.append({
                        "document_type": "sales_delivery",
                        "document_id": delivery.id,
                        "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                        "document_name": None,
                        "status": delivery.status if hasattr(delivery, 'status') else None,
                        "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
                    })

        # 返工单（工单作为原工单）
        rework_orders = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True
        ).limit(10)
        for ro in rework_orders:
            downstream.append({
                "document_type": "rework_order",
                "document_id": ro.id,
                "document_code": ro.code,
                "document_name": ro.product_name,
                "status": ro.status,
                "created_at": to_api_isoformat(ro.created_at) if ro.created_at else None
            })

        # 工序委外单
        outsource_orders = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True
        ).limit(10)
        for os_order in outsource_orders:
            downstream.append({
                "document_type": "outsource_order",
                "document_id": os_order.id,
                "document_code": os_order.code,
                "document_name": os_order.operation_name,
                "status": os_order.status,
                "created_at": to_api_isoformat(os_order.created_at) if os_order.created_at else None
            })

        # 线边备料单
        from apps.kuaizhizao.models.batching_order import BatchingOrder

        batching_orders = await BatchingOrder.filter(
            tenant_id=tenant_id, work_order_id=work_order_id
        ).limit(10)
        for bo in batching_orders:
            downstream.append({
                "document_type": "batching_order",
                "document_id": bo.id,
                "document_code": bo.code,
                "document_name": None,
                "status": bo.status,
                "created_at": to_api_isoformat(bo.created_at) if bo.created_at else None,
            })

        # 补料申请
        from apps.kuaizhizao.models.material_call_request import MaterialCallRequest

        material_calls = await MaterialCallRequest.filter(
            tenant_id=tenant_id, work_order_id=work_order_id
        ).limit(10)
        for mc in material_calls:
            downstream.append({
                "document_type": "material_call_request",
                "document_id": mc.id,
                "document_code": mc.code,
                "document_name": None,
                "status": mc.status,
                "created_at": to_api_isoformat(mc.created_at) if mc.created_at else None,
            })

        # 倒冲记录
        from apps.kuaizhizao.models.backflush_record import BackflushRecord

        backflushes = await BackflushRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).limit(10)
        for bf in backflushes:
            downstream.append({
                "document_type": "backflush_record",
                "document_id": bf.id,
                "document_code": bf.material_code or str(bf.id),
                "document_name": bf.material_name,
                "status": bf.status,
                "created_at": to_api_isoformat(bf.created_at) if bf.created_at else None,
            })

        # 报废记录
        from apps.kuaizhizao.models.scrap_record import ScrapRecord

        scraps = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).limit(10)
        for scrap in scraps:
            downstream.append({
                "document_type": "scrap_record",
                "document_id": scrap.id,
                "document_code": scrap.code,
                "document_name": scrap.product_name,
                "status": scrap.status,
                "created_at": to_api_isoformat(scrap.created_at) if scrap.created_at else None,
            })

        # 过程检验单
        process_inspections = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for pi in process_inspections:
            downstream.append({
                "document_type": "process_inspection",
                "document_id": pi.id,
                "document_code": pi.inspection_code,
                "document_name": None,
                "status": pi.status,
                "created_at": to_api_isoformat(pi.created_at) if pi.created_at else None
            })

        # 成品检验单
        finished_inspections = await FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for fi in finished_inspections:
            downstream.append({
                "document_type": "finished_goods_inspection",
                "document_id": fi.id,
                "document_code": fi.inspection_code,
                "document_name": None,
                "status": fi.status,
                "created_at": to_api_isoformat(fi.created_at) if fi.created_at else None
            })

        # 拆分工单（通过 DocumentRelation 追溯）
        split_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="work_order",
            source_id=work_order_id,
            target_type="work_order",
        ).limit(10)
        for rel in split_relations:
            split_wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=rel.target_id,
                deleted_at__isnull=True
            )
            if split_wo:
                downstream.append({
                    "document_type": "work_order",
                    "document_id": split_wo.id,
                    "document_code": split_wo.code,
                    "document_name": split_wo.name,
                    "status": split_wo.status,
                    "created_at": to_api_isoformat(split_wo.created_at) if split_wo.created_at else None
                })

        return downstream

    async def _get_production_picking_downstream(
        self,
        tenant_id: int,
        picking_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产领料的下游单据（报工记录、生产退料）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            return []

        downstream = []

        # 生产退料单
        production_returns = await ProductionReturn.filter(
            tenant_id=tenant_id,
            picking_id=picking_id
        ).limit(10)
        for ret in production_returns:
            downstream.append({
                "document_type": "production_return",
                "document_id": ret.id,
                "document_code": ret.return_code,
                "document_name": None,
                "status": ret.status,
                "created_at": to_api_isoformat(ret.created_at) if ret.created_at else None
            })

        # 报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=picking.work_order_id,
            deleted_at__isnull=True,
        ).order_by("operation_id", "id").limit(self.REPORTING_RECORD_TRACE_LIMIT)
        for record in reporting_records:
            downstream.append(self._reporting_record_trace_dict(record))

        return downstream

    async def _get_finished_goods_receipt_downstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品入库的下游单据（销售出库单）"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        downstream = []

        # 销售出库单
        if receipt.sales_order_id:
            deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_order_id=receipt.sales_order_id
            ).limit(10)
            for delivery in deliveries:
                downstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                    "document_name": None,
                    "status": delivery.status if hasattr(delivery, 'status') else None,
                    "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
                })

        return downstream

    async def _get_semi_finished_goods_receipt_downstream(
        self,
        tenant_id: int,
        receipt_id: int,
    ) -> List[Dict[str, Any]]:
        """获取半成品入库的下游单据（销售出库单，与成品入库一致按销售订单关联）"""
        receipt = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []
        downstream = []
        if receipt.sales_order_id:
            deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_order_id=receipt.sales_order_id
            ).limit(10)
            for delivery in deliveries:
                downstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                    "document_name": None,
                    "status": delivery.status if hasattr(delivery, 'status') else None,
                    "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None
                })
        return downstream

    async def _get_purchase_order_downstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购单的下游单据（采购入库单）"""
        downstream = []

        # 采购入库单
        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id
        ).limit(10)
        for receipt in receipts:
            downstream.append({
                "document_type": "purchase_receipt",
                "document_id": receipt.id,
                "document_code": receipt.receipt_code if hasattr(receipt, 'receipt_code') else None,
                "document_name": None,
                "status": receipt.status if hasattr(receipt, 'status') else None,
                "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None
            })

        pinvs = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id,
            deleted_at__isnull=True,
        ).limit(20)
        for inv in pinvs:
            downstream.append({
                "document_type": "purchase_invoice",
                "document_id": inv.id,
                "document_code": inv.invoice_code,
                "document_name": inv.invoice_number,
                "status": inv.status,
                "created_at": to_api_isoformat(inv.created_at) if inv.created_at else None,
            })

        return _dedupe_relation_documents(downstream)

    async def _get_purchase_receipt_downstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购入库单的下游单据（应付单）"""
        downstream = []

        # 通过source_type和source_id查找应付单
        payables = await Payable.filter(
            tenant_id=tenant_id,
            source_type="采购入库",
            source_id=receipt_id
        ).limit(10)
        for payable in payables:
            downstream.append({
                "document_type": "payable",
                "document_id": payable.id,
                "document_code": payable.payable_code,
                "document_name": None,
                "status": payable.status,
                "created_at": to_api_isoformat(payable.created_at) if payable.created_at else None
            })

        # 采购退货单
        purchase_returns = await PurchaseReturn.filter(
            tenant_id=tenant_id,
            purchase_receipt_id=receipt_id,
            deleted_at__isnull=True
        ).limit(10)
        for pr in purchase_returns:
            downstream.append({
                "document_type": "purchase_return",
                "document_id": pr.id,
                "document_code": pr.return_code,
                "document_name": None,
                "status": pr.status if hasattr(pr, 'status') else None,
                "created_at": to_api_isoformat(pr.created_at) if pr.created_at else None
            })

        return downstream

    async def _get_equipment_downstream(
        self,
        tenant_id: int,
        equipment_id: int,
    ) -> List[Dict[str, Any]]:
        """设备台账下游：故障记录、保养计划"""
        from apps.kuaizhizao.models.equipment_fault import EquipmentFault
        from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan

        downstream: List[Dict[str, Any]] = []
        faults = await EquipmentFault.filter(
            tenant_id=tenant_id, equipment_id=equipment_id, deleted_at__isnull=True
        ).all()
        for f in faults:
            downstream.append({
                "document_type": "equipment_fault",
                "document_id": f.id,
                "document_code": f.fault_no,
                "document_name": None,
                "status": f.status,
                "created_at": to_api_isoformat(f.created_at) if f.created_at else None,
            })
        plans = await MaintenancePlan.filter(
            tenant_id=tenant_id, equipment_id=equipment_id, deleted_at__isnull=True
        ).all()
        for p in plans:
            downstream.append({
                "document_type": "maintenance_plan",
                "document_id": p.id,
                "document_code": p.plan_no,
                "document_name": p.plan_name,
                "status": p.status,
                "created_at": to_api_isoformat(p.created_at) if p.created_at else None,
            })
        return downstream

    async def _get_equipment_fault_upstream(
        self,
        tenant_id: int,
        fault_id: int,
    ) -> List[Dict[str, Any]]:
        from apps.kuaizhizao.models.equipment_fault import EquipmentFault
        from apps.kuaizhizao.models.equipment import Equipment

        fault = await EquipmentFault.get_or_none(tenant_id=tenant_id, id=fault_id)
        if not fault:
            return []
        eq = await Equipment.get_or_none(tenant_id=tenant_id, id=fault.equipment_id)
        if not eq:
            return []
        return [{
            "document_type": "equipment",
            "document_id": eq.id,
            "document_code": eq.code,
            "document_name": eq.name,
            "status": eq.status,
            "created_at": to_api_isoformat(eq.created_at) if eq.created_at else None,
        }]

    async def _get_maintenance_plan_upstream(
        self,
        tenant_id: int,
        plan_id: int,
    ) -> List[Dict[str, Any]]:
        from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
        from apps.kuaizhizao.models.equipment import Equipment

        plan = await MaintenancePlan.get_or_none(tenant_id=tenant_id, id=plan_id)
        if not plan:
            return []
        eq = await Equipment.get_or_none(tenant_id=tenant_id, id=plan.equipment_id)
        if not eq:
            return []
        return [{
            "document_type": "equipment",
            "document_id": eq.id,
            "document_code": eq.code,
            "document_name": eq.name,
            "status": eq.status,
            "created_at": to_api_isoformat(eq.created_at) if eq.created_at else None,
        }]

    async def _get_maintenance_reminder_upstream(
        self,
        tenant_id: int,
        reminder_id: int,
    ) -> List[Dict[str, Any]]:
        """维护提醒的上游：关联设备、保养计划（若有）。"""
        reminder = await MaintenanceReminder.get_or_none(tenant_id=tenant_id, id=reminder_id)
        if not reminder:
            return []
        upstream: List[Dict[str, Any]] = []
        eq = await Equipment.get_or_none(tenant_id=tenant_id, id=reminder.equipment_id)
        if eq:
            upstream.append({
                "document_type": "equipment",
                "document_id": eq.id,
                "document_code": eq.code,
                "document_name": eq.name,
                "status": eq.status,
                "created_at": to_api_isoformat(eq.created_at) if eq.created_at else None,
            })
        if reminder.maintenance_plan_id:
            plan = await MaintenancePlan.get_or_none(tenant_id=tenant_id, id=reminder.maintenance_plan_id)
            if plan:
                upstream.append({
                    "document_type": "maintenance_plan",
                    "document_id": plan.id,
                    "document_code": plan.plan_no,
                    "document_name": plan.plan_name,
                    "status": plan.status,
                    "created_at": to_api_isoformat(plan.created_at) if plan.created_at else None,
                })
        return upstream

    # ============ 追溯方法 ============

    async def _trace_upstream(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        visited: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """向上追溯关联链"""
        if visited is None:
            visited = set()

        key = f"{document_type}:{document_id}"
        if key in visited:
            return []  # 避免循环引用

        visited.add(key)

        relations = await self.get_document_relations(tenant_id, document_type, document_id)
        chain = []

        for upstream in relations["upstream_documents"]:
            upstream_chain = await self._trace_upstream(
                tenant_id,
                upstream["document_type"],
                upstream["document_id"],
                visited
            )
            chain.append({
                "document": upstream,
                "upstream_chain": upstream_chain
            })

        return chain

    async def _trace_downstream(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        visited: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """向下追溯关联链"""
        if visited is None:
            visited = set()

        key = f"{document_type}:{document_id}"
        if key in visited:
            return []  # 避免循环引用

        visited.add(key)

        relations = await self.get_document_relations(tenant_id, document_type, document_id)
        chain = []

        for downstream in relations["downstream_documents"]:
            downstream_chain = await self._trace_downstream(
                tenant_id,
                downstream["document_type"],
                downstream["document_id"],
                visited
            )
            chain.append({
                "document": downstream,
                "downstream_chain": downstream_chain
            })

        return chain


def _build_document_relation_strategies() -> Dict[str, Any]:
    """
    document_type -> 异步解析器，返回 (upstream_documents, downstream_documents)。
    新增单据类型时在 DOCUMENT_TYPES 与本 registry 同步登记。
    """

    async def strat_demand(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], await svc._get_demand_downstream(tenant_id, document_id)

    async def strat_sales_forecast(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], await svc._get_sales_forecast_downstream(tenant_id, document_id)

    async def strat_sales_order(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream = await svc._get_sales_order_upstream(tenant_id, document_id)
        downstream = await svc._get_sales_order_downstream(tenant_id, document_id)
        return upstream, downstream

    async def strat_quotation(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], await svc._get_quotation_downstream(tenant_id, document_id)

    async def strat_sales_contract(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream = await svc._get_sales_contract_upstream(tenant_id, document_id)
        downstream = await svc._get_sales_contract_downstream(tenant_id, document_id)
        return upstream, downstream

    async def strat_material_borrow(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], await svc._get_material_borrow_downstream(tenant_id, document_id)

    async def strat_material_return(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_material_return_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_demand_computation(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_demand_computation_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_demand_computation_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_work_order(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_work_order_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_work_order_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_production_picking(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_production_picking_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_production_picking_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_production_return(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_production_return_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_finished_goods_receipt(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_finished_goods_receipt_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_finished_goods_receipt_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_semi_finished_goods_receipt(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_semi_finished_goods_receipt_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_semi_finished_goods_receipt_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_purchase_order(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_purchase_order_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_purchase_order_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_purchase_receipt(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_purchase_receipt_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_purchase_receipt_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_purchase_return(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_purchase_return_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_reporting_record(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_reporting_record_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_outsource_order(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_outsource_order_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_outsource_order_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_outsource_work_order(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    async def strat_packing_binding(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_packing_binding_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_receipt_notice(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_receipt_notice_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_receipt_notice_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_sales_return(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_sales_return_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_payable(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_payable_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_payable_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_receivable(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_receivable_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_receivable_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_sales_invoice(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_sales_invoice_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_sales_invoice_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_receipt(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_receipt_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_payment(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_payment_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_purchase_invoice(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_purchase_invoice_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_purchase_invoice_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_incoming_inspection(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_incoming_inspection_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_process_inspection(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_process_inspection_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_finished_goods_inspection(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_finished_goods_inspection_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_sales_delivery(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_sales_delivery_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_sales_delivery_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_delivery_notice(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_delivery_notice_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_shipment_notice(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_shipment_notice_upstream(tenant_id, document_id)
        downstream_documents = await svc._get_shipment_notice_downstream(tenant_id, document_id)
        return upstream_documents, downstream_documents

    async def strat_equipment(svc: DocumentRelationService, tenant_id: int, document_id: int):
        downstream_documents = await svc._get_equipment_downstream(tenant_id, document_id)
        return [], downstream_documents

    async def strat_equipment_fault(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_equipment_fault_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_maintenance_plan(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_maintenance_plan_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_maintenance_reminder(svc: DocumentRelationService, tenant_id: int, document_id: int):
        upstream_documents = await svc._get_maintenance_reminder_upstream(tenant_id, document_id)
        return upstream_documents, []

    async def strat_mold(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    async def strat_tool(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    async def strat_performance_skill(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    async def strat_performance_holiday(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    async def strat_performance_summary(svc: DocumentRelationService, tenant_id: int, document_id: int):
        return [], []

    return {
        "demand": strat_demand,
        "sales_forecast": strat_sales_forecast,
        "sales_order": strat_sales_order,
        "quotation": strat_quotation,
        "sales_contract": strat_sales_contract,
        "material_borrow": strat_material_borrow,
        "material_return": strat_material_return,
        "demand_computation": strat_demand_computation,
        "work_order": strat_work_order,
        "production_picking": strat_production_picking,
        "production_return": strat_production_return,
        "finished_goods_receipt": strat_finished_goods_receipt,
        "semi_finished_goods_receipt": strat_semi_finished_goods_receipt,
        "purchase_order": strat_purchase_order,
        "purchase_receipt": strat_purchase_receipt,
        "purchase_return": strat_purchase_return,
        "reporting_record": strat_reporting_record,
        "outsource_order": strat_outsource_order,
        "outsource_work_order": strat_outsource_work_order,
        "packing_binding": strat_packing_binding,
        "receipt_notice": strat_receipt_notice,
        "sales_return": strat_sales_return,
        "payable": strat_payable,
        "receivable": strat_receivable,
        "sales_invoice": strat_sales_invoice,
        "receipt": strat_receipt,
        "payment": strat_payment,
        "purchase_invoice": strat_purchase_invoice,
        "incoming_inspection": strat_incoming_inspection,
        "process_inspection": strat_process_inspection,
        "finished_goods_inspection": strat_finished_goods_inspection,
        "sales_delivery": strat_sales_delivery,
        "delivery_notice": strat_delivery_notice,
        "shipment_notice": strat_shipment_notice,
        "equipment": strat_equipment,
        "equipment_fault": strat_equipment_fault,
        "maintenance_plan": strat_maintenance_plan,
        "maintenance_reminder": strat_maintenance_reminder,
        "mold": strat_mold,
        "tool": strat_tool,
        "performance_skill": strat_performance_skill,
        "performance_holiday": strat_performance_holiday,
        "performance_summary": strat_performance_summary,
    }


DOCUMENT_RELATION_STRATEGIES: Dict[str, Any] = _build_document_relation_strategies()
