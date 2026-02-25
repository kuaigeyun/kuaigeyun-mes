"""
销售订单管理服务模块

提供销售订单相关的业务逻辑处理。
销售订单数据存储于 SalesOrder/SalesOrderItem 表，下推需求计算时生成 Demand（source_type=sales_order）。

Author: Luigi Lu
Date: 2026-01-19
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.receivable import Receivable
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.invoice import Invoice, InvoiceItem
from apps.kuaizhizao.models.state_transition import StateTransitionLog
from apps.kuaizhizao.schemas.sales_order import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemResponse,
)
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_AUDITED_VALUES
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class SalesOrderService:
    """
    销售订单管理服务

    销售订单数据存储于 SalesOrder 表，支持与其他系统对接。
    下推需求计算时由 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID）。
    """

    def __init__(self):
        self.business_config_service = BusinessConfigService()

    async def _log_state_transition(
        self,
        tenant_id: int,
        sales_order_id: int,
        from_state: str,
        to_state: str,
        operator_id: int,
        operator_name: str,
        reason: Optional[str] = None,
        reason_extra: Optional[str] = None,
    ) -> None:
        """写入状态流转日志，供单据操作记录展示。表不存在时静默跳过，避免阻塞主流程。"""
        try:
            await StateTransitionLog.create(
                tenant_id=tenant_id,
                entity_type="sales_order",
                entity_id=sales_order_id,
                from_state=from_state,
                to_state=to_state,
                transition_reason=reason,
                transition_comment=reason_extra,
                operator_id=operator_id,
                operator_name=operator_name,
                transition_time=datetime.now(),
            )
        except Exception as e:
            logger.warning("写入状态流转日志失败（表可能未创建），跳过: %s", e)

    def _order_to_response(
        self,
        order: SalesOrder,
        items: Optional[List[SalesOrderItem]] = None,
        demand: Optional[Demand] = None,
        duration_info: Optional[dict] = None,
        delivery_progress: Optional[float] = None,
        invoice_progress: Optional[float] = None,
        material_code_fallback: Optional[Dict[int, str]] = None,
        material_fallback: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> SalesOrderResponse:
        """将 SalesOrder 转为 SalesOrderResponse"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_order_lifecycle
        lifecycle = get_sales_order_lifecycle(
            order,
            items=items,
            delivery_progress=delivery_progress,
            invoice_progress=invoice_progress,
            pushed_to_computation=bool(demand and getattr(demand, "pushed_to_computation", False)),
        )
        base = {
            "id": order.id,
            "uuid": str(order.uuid),
            "tenant_id": order.tenant_id,
            "order_code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "order_date": order.order_date,
            "delivery_date": order.delivery_date,
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "customer_contact": order.customer_contact,
            "customer_phone": order.customer_phone,
            "total_quantity": order.total_quantity,
            "total_amount": order.total_amount,
            "price_type": getattr(order, "price_type", None) or "tax_exclusive",
            "discount_amount": getattr(order, "discount_amount", None) or Decimal("0"),
            "status": order.status,
            "submit_time": getattr(order, "submit_time", None),
            "reviewer_id": order.reviewer_id,
            "reviewer_name": order.reviewer_name,
            "review_time": order.review_time,
            "review_status": order.review_status,
            "review_remarks": order.review_remarks,
            "salesman_id": order.salesman_id,
            "salesman_name": order.salesman_name,
            "shipping_address": order.shipping_address,
            "shipping_method": order.shipping_method,
            "payment_terms": order.payment_terms,
            "notes": order.notes,
            "is_active": order.is_active,
            "created_by": order.created_by,
            "updated_by": order.updated_by,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }
        if demand:
            base["pushed_to_computation"] = demand.pushed_to_computation
            base["computation_id"] = demand.computation_id
            base["computation_code"] = demand.computation_code
        else:
            base["pushed_to_computation"] = False
            base["computation_id"] = None
            base["computation_code"] = None
        if duration_info is not None:
            base["duration_info"] = duration_info
        if delivery_progress is not None:
            base["delivery_progress"] = round(delivery_progress, 1)
        if invoice_progress is not None:
            base["invoice_progress"] = round(invoice_progress, 1)
        base["lifecycle"] = lifecycle
        fallback = material_code_fallback or {}
        mat_fallback = material_fallback or {}

        def _material_val(it: SalesOrderItem, attr: str, mat_key: str, max_len: int = 50) -> str:
            """明细有值则用明细，否则从物料表补全"""
            val = getattr(it, attr, None)
            if val is not None and str(val).strip():
                return str(val)[:max_len]
            mf = mat_fallback.get(it.material_id) if it.material_id else None
            if mf and mat_key in mf and mf[mat_key]:
                return str(mf[mat_key])[:max_len]
            if attr == "material_code" and it.material_id and it.material_id in fallback:
                return str(fallback[it.material_id])[:max_len]
            return ""

        if items is not None:
            base["items"] = [
                SalesOrderItemResponse(
                    id=it.id,
                    uuid=str(it.uuid),
                    tenant_id=it.tenant_id,
                    sales_order_id=it.sales_order_id,
                    material_id=it.material_id,
                    material_code=_material_val(it, "material_code", "code"),
                    material_name=_material_val(it, "material_name", "name", 200),
                    material_spec=_material_val(it, "material_spec", "spec", 200),
                    material_unit=_material_val(it, "material_unit", "unit"),
                    required_quantity=it.order_quantity,
                    delivery_date=it.delivery_date,
                    unit_price=it.unit_price,
                    tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                    item_amount=it.total_amount,
                    notes=it.notes,
                    delivered_quantity=it.delivered_quantity,
                    remaining_quantity=it.remaining_quantity,
                    delivery_status=it.delivery_status,
                    work_order_id=it.work_order_id,
                    work_order_code=it.work_order_code,
                    created_at=it.created_at,
                    updated_at=it.updated_at,
                )
                for it in items
            ]
        return SalesOrderResponse(**base)

    async def _get_linked_demand(
        self, tenant_id: int, sales_order_id: int
    ) -> Optional[Demand]:
        """获取与销售订单关联的 Demand（下推时生成）"""
        return await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=sales_order_id,
            deleted_at__isnull=True,
        )

    async def _sync_demand_if_exists(self, tenant_id: int, order_id: int, operator_id: int) -> bool:
        """如果存在关联需求，则同步并重算快照，返回是否同步成功"""
        demand = await self._get_linked_demand(tenant_id, order_id)
        if demand:
            from apps.kuaizhizao.services.demand_service import DemandService
            try:
                sync_result = await DemandService().sync_from_upstream(
                    tenant_id=tenant_id,
                    source_type="sales_order",
                    source_id=order_id,
                    operator_id=operator_id,
                )
                if sync_result.get("synced"):
                    logger.info("销售订单 %s 已同步关联需求并更新快照", order_id)
                    return True
            except Exception as e:
                logger.warning("销售订单更新后同步需求失败: %s", e)
        return False

    def _is_audited(self, status: str) -> bool:
        """判断是否已审核（兼容中英文状态）"""
        return status in LEGACY_AUDITED_VALUES or status == DemandStatus.AUDITED

    def _is_review_approved(self, review_status: Optional[str]) -> bool:
        """判断 review_status 是否已审核通过（与 document_lifecycle _is_approved 一致）"""
        r = (review_status or "").strip()
        return r in ("APPROVED", "审核通过", "通过", "已通过", "已审核")

    def _is_draft(self, status: str) -> bool:
        """判断是否草稿（兼容中英文状态）"""
        return status in (DemandStatus.DRAFT, "DRAFT", "草稿")

    async def _generate_order_code(self, tenant_id: int, order_date: Optional[date]) -> str:
        """生成销售订单编码"""
        from core.config.code_rule_pages import CODE_RULE_PAGES
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = next(
            (p.get("rule_code") for p in CODE_RULE_PAGES if p.get("page_code") == "kuaizhizao-sales-order"),
            None,
        )
        context = {}
        if order_date:
            context["order_date"] = (
                order_date.isoformat()
                if hasattr(order_date, "isoformat")
                else str(order_date)
            )
        if rule_code:
            try:
                return await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code=rule_code,
                    context=context or None,
                )
            except Exception as e:
                logger.warning("编码规则生成失败，使用备用格式: %s", e)
        today = datetime.now().strftime("%Y%m%d")
        import uuid
        return f"SO-{today}-{uuid.uuid4().hex[:6].upper()}"

    async def create_sales_order(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
        created_by: int,
    ) -> SalesOrderResponse:
        """创建销售订单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_order")
        if not is_enabled:
            raise BusinessLogicError("销售管理模块未启用，无法创建销售订单")

        if not sales_order_data.order_code:
            sales_order_data.order_code = await self._generate_order_code(
                tenant_id, sales_order_data.order_date
            )

        async with in_transaction():
            order_dict = sales_order_data.model_dump(exclude={"items", "order_name"})
            order_dict["status"] = sales_order_data.status
            order_dict["review_status"] = sales_order_data.review_status
            order_dict["created_by"] = created_by
            order_dict["updated_by"] = created_by

            order = await SalesOrder.create(tenant_id=tenant_id, **order_dict)

            total_qty = Decimal("0")
            subtotal = Decimal("0")
            for item_data in sales_order_data.items:
                req_qty = item_data.required_quantity
                unit_pr = item_data.unit_price or Decimal("0")
                tax_r = item_data.tax_rate or Decimal("0")
                # 未税金额 = 数量×单价，价税合计 = 未税金额×(1+税率/100)
                excl_amt = req_qty * unit_pr
                item_amt = item_data.item_amount if item_data.item_amount is not None else (excl_amt * (Decimal("1") + tax_r / Decimal("100")))
                total_qty += req_qty
                subtotal += item_amt
                await SalesOrderItem.create(
                    tenant_id=tenant_id,
                    sales_order_id=order.id,
                    material_id=item_data.material_id or 0,
                    material_code=(item_data.material_code or "")[:50],
                    material_name=(item_data.material_name or "")[:200],
                    material_spec=(item_data.material_spec or "")[:200] or None,
                    material_unit=(item_data.material_unit or "")[:20],
                    order_quantity=req_qty,
                    delivered_quantity=Decimal("0"),
                    remaining_quantity=req_qty,
                    unit_price=unit_pr,
                    tax_rate=tax_r,
                    total_amount=item_amt,
                    delivery_date=item_data.delivery_date,
                    delivery_status="待交货",
                    notes=item_data.notes,
                )
            discount = getattr(sales_order_data, "discount_amount", None) or Decimal("0")
            total_amt = max(Decimal("0"), subtotal - discount)
            await SalesOrder.filter(id=order.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
            order = await SalesOrder.get(id=order.id)
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order.id
            ).order_by("id")
            demand = await self._get_linked_demand(tenant_id, order.id)
            return self._order_to_response(order, items=items, demand=demand)

    async def get_sales_order_by_id(
        self,
        tenant_id: int,
        sales_order_id: int,
        include_items: bool = False,
        include_duration: bool = False,
    ) -> SalesOrderResponse:
        """获取销售订单详情"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 不同步时自动修复
        if self._is_review_approved(order.review_status) and not self._is_audited(order.status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(status=DemandStatus.AUDITED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)
        elif self._is_audited(order.status) and not self._is_review_approved(order.review_status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(review_status=ReviewStatus.APPROVED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)

        items = None
        material_code_fallback: Dict[int, str] = {}
        material_fallback: Dict[int, Dict[str, Any]] = {}
        if include_items:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).order_by("id").all()
            # 当明细中物料信息为空时，从物料表补全（兼容历史数据）
            need_fallback = [
                it for it in items
                if it.material_id
                and (
                    not (it.material_code and str(it.material_code).strip())
                    or not (it.material_name and str(it.material_name).strip())
                    or not (it.material_unit and str(it.material_unit).strip())
                )
            ]
            if need_fallback:
                from apps.master_data.models.material import Material
                material_ids = list({it.material_id for it in need_fallback})
                materials = await Material.filter(id__in=material_ids, deleted_at__isnull=True).all()
                for m in materials:
                    material_code_fallback[m.id] = (m.main_code or getattr(m, "code", None) or "")[:50]
                    material_fallback[m.id] = {
                        "code": (m.main_code or getattr(m, "code", None) or "")[:50],
                        "name": (m.name or "")[:200],
                        "spec": (getattr(m, "specification", None) or "")[:200],
                        "unit": (m.base_unit or "")[:20],
                    }

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        duration_info = None
        if include_duration and demand:
            duration_info = getattr(demand, "duration_info", None)
        return self._order_to_response(
            order,
            items=items,
            demand=demand,
            duration_info=duration_info,
            material_code_fallback=material_code_fallback,
            material_fallback=material_fallback,
        )

    async def list_sales_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        review_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        customer_name: Optional[str] = None,
        order_by: Optional[str] = None,
        include_items: bool = False,
    ) -> SalesOrderListResponse:
        """获取销售订单列表。order_by 如 order_code、-created_at（前缀-表示降序）"""
        query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if review_status:
            query = query.filter(review_status=review_status)
        if start_date:
            query = query.filter(order_date__gte=start_date)
        if end_date:
            query = query.filter(order_date__lte=end_date)
        if customer_name and str(customer_name).strip():
            query = query.filter(customer_name__icontains=customer_name.strip())
        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        orders = await query.offset(skip).limit(limit).order_by(order_clause)

        if not orders:
            return SalesOrderListResponse(data=[], total=total, success=True)

        order_ids = [o.id for o in orders]

        # 1. 批量状态同步（不同步时自动修复）
        need_audit_sync = []
        need_review_sync = []
        for order in orders:
            if self._is_review_approved(order.review_status) and not self._is_audited(order.status):
                need_audit_sync.append(order.id)
            elif self._is_audited(order.status) and not self._is_review_approved(order.review_status):
                need_review_sync.append(order.id)
        if need_audit_sync:
            await SalesOrder.filter(tenant_id=tenant_id, id__in=need_audit_sync).update(status=DemandStatus.AUDITED)
        if need_review_sync:
            await SalesOrder.filter(tenant_id=tenant_id, id__in=need_review_sync).update(review_status=ReviewStatus.APPROVED)
        if need_audit_sync or need_review_sync:
            refetched = await SalesOrder.filter(tenant_id=tenant_id, id__in=order_ids).order_by(order_clause)
            refetched_by_id = {o.id: o for o in refetched}
            orders = [refetched_by_id[oid] for oid in order_ids]

        # 2. 批量查询 Demand
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id__in=order_ids,
            deleted_at__isnull=True,
        ).all()
        demand_by_order: Dict[int, Demand] = {d.source_id: d for d in demands}

        # 3. 批量查询 SalesOrderItem
        items_by_order: Dict[int, List[SalesOrderItem]] = {}
        if include_items:
            all_items = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
            ).order_by("sales_order_id", "id").all()
            for it in all_items:
                items_by_order.setdefault(it.sales_order_id, []).append(it)
        else:
            # 仅需 delivery_progress：批量查询 order_quantity, delivered_quantity
            items_agg_rows = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
            ).values_list("sales_order_id", "order_quantity", "delivered_quantity")
            for oid, qty, delivered in items_agg_rows:
                items_by_order.setdefault(oid, []).append(
                    type("_AggItem", (), {"order_quantity": qty, "delivered_quantity": delivered})()
                )

        # 4. 批量 Material 补全（仅 include_items 时）
        material_code_fallback_all: Dict[int, Dict[int, str]] = {}
        material_fallback_all: Dict[int, Dict[int, Dict[str, Any]]] = {}
        if include_items:
            need_fallback_ids: set = set()
            for oid, items in items_by_order.items():
                for it in items:
                    if it.material_id and (
                        not (getattr(it, "material_code", None) and str(it.material_code).strip())
                        or not (getattr(it, "material_name", None) and str(it.material_name).strip())
                        or not (getattr(it, "material_spec", None) and str(it.material_spec).strip())
                        or not (getattr(it, "material_unit", None) and str(it.material_unit).strip())
                    ):
                        need_fallback_ids.add(it.material_id)
            if need_fallback_ids:
                from apps.master_data.models.material import Material
                materials = await Material.filter(
                    id__in=list(need_fallback_ids), deleted_at__isnull=True
                ).all()
                material_by_id: Dict[int, Any] = {m.id: m for m in materials}
                for oid, items in items_by_order.items():
                    fallback: Dict[int, str] = {}
                    mat_fallback: Dict[int, Dict[str, Any]] = {}
                    for it in items:
                        if not it.material_id or it.material_id not in material_by_id:
                            continue
                        if (
                            not (getattr(it, "material_code", None) and str(it.material_code).strip())
                            or not (getattr(it, "material_name", None) and str(it.material_name).strip())
                            or not (getattr(it, "material_spec", None) and str(it.material_spec).strip())
                            or not (getattr(it, "material_unit", None) and str(it.material_unit).strip())
                        ):
                            m = material_by_id[it.material_id]
                            fallback[m.id] = (m.main_code or getattr(m, "code", None) or "")[:50]
                            mat_fallback[m.id] = {
                                "code": (m.main_code or getattr(m, "code", None) or "")[:50],
                                "name": (m.name or "")[:200],
                                "spec": (getattr(m, "specification", None) or "")[:200],
                                "unit": (m.base_unit or "")[:20],
                            }
                    if fallback:
                        material_code_fallback_all[oid] = fallback
                        material_fallback_all[oid] = mat_fallback

        # 5. 批量计算开票进度
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).values_list("id", "sales_order_id")
        delivery_ids = [d[0] for d in deliveries]
        order_to_deliveries: Dict[int, List[int]] = {}
        for did, oid in deliveries:
            order_to_deliveries.setdefault(oid, []).append(did)

        invoiced_by_order: Dict[int, Decimal] = {}
        if delivery_ids:
            receivables = await Receivable.filter(
                tenant_id=tenant_id,
                source_type="销售出库",
                source_id__in=delivery_ids,
                invoice_issued=True,
                deleted_at__isnull=True,
            ).values_list("source_id", "total_amount")
            delivery_to_invoiced: Dict[int, Decimal] = {}
            for did, amt in receivables:
                delivery_to_invoiced[did] = delivery_to_invoiced.get(did, Decimal("0")) + Decimal(str(amt or 0))
            for oid, dids in order_to_deliveries.items():
                invoiced_by_order[oid] = sum(delivery_to_invoiced.get(did, Decimal("0")) for did in dids)

        # 6. 组装响应
        sales_orders = []
        for order in orders:
            items = items_by_order.get(order.id) or []
            items_for_response = items if include_items else None

            delivery_progress: Optional[float] = None
            if items:
                total_qty = sum(Decimal(str(getattr(it, "order_quantity", 0) or 0)) for it in items)
                total_delivered = sum(Decimal(str(getattr(it, "delivered_quantity", 0) or 0)) for it in items)
                if total_qty and total_qty > 0:
                    delivery_progress = float(min(100, (total_delivered / total_qty) * 100))

            invoice_progress_val: Optional[float] = None
            order_amount = Decimal(str(order.total_amount or 0))
            if order_amount and order_amount > 0:
                invoiced = invoiced_by_order.get(order.id, Decimal("0"))
                try:
                    invoice_progress_val = float(min(100, (invoiced / order_amount) * 100))
                except Exception:
                    invoice_progress_val = 0.0
            else:
                invoice_progress_val = 0.0

            sales_orders.append(
                self._order_to_response(
                    order,
                    items=items_for_response,
                    demand=demand_by_order.get(order.id),
                    delivery_progress=delivery_progress,
                    invoice_progress=invoice_progress_val,
                    material_code_fallback=material_code_fallback_all.get(order.id) if include_items else None,
                    material_fallback=material_fallback_all.get(order.id) if include_items else None,
                )
            )
        return SalesOrderListResponse(data=sales_orders, total=total, success=True)

    async def update_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        sales_order_data: SalesOrderUpdate,
        updated_by: int,
    ) -> SalesOrderResponse:
        """更新销售订单。支持草稿与已审核订单（含反审核后编辑）；已审核订单保存后同步关联需求。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 允许草稿或已审核状态更新（已审核时可能为反审核后再编辑，或直接编辑已审核订单）
        if order.status not in (DemandStatus.DRAFT, DemandStatus.AUDITED, DemandStatus.PENDING_REVIEW):
            raise BusinessLogicError(f"只能更新草稿、待审核或已审核的销售订单，当前状态: {order.status}")

        old_values = {
            "order_date": str(order.order_date) if order.order_date else None,
            "delivery_date": str(order.delivery_date) if order.delivery_date else None,
            "customer_name": order.customer_name,
            "customer_contact": order.customer_contact,
            "customer_phone": order.customer_phone,
            "total_quantity": str(order.total_quantity) if order.total_quantity is not None else None,
            "total_amount": str(order.total_amount) if order.total_amount is not None else None,
            "price_type": order.price_type,
            "discount_amount": str(getattr(order, "discount_amount", 0) or 0),
            "salesman_name": order.salesman_name,
            "shipping_address": order.shipping_address,
            "shipping_method": order.shipping_method,
            "payment_terms": order.payment_terms,
            "notes": order.notes,
        }
        items_changed = sales_order_data.items is not None

        async with in_transaction():
            upd = sales_order_data.model_dump(exclude_unset=True, exclude={"items"})
            upd["updated_by"] = updated_by
            # status/review_status 由工作流控制，禁止通过 update 修改，确保二者始终同步
            upd.pop("status", None)
            upd.pop("review_status", None)
            if upd:
                await SalesOrder.filter(id=sales_order_id).update(**upd)

            if sales_order_data.items is not None:
                await SalesOrderItem.filter(
                    tenant_id=tenant_id, sales_order_id=sales_order_id
                ).delete()
                total_qty = Decimal("0")
                subtotal = Decimal("0")
                for item_data in sales_order_data.items:
                    req_qty = item_data.required_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    tax_r = item_data.tax_rate or Decimal("0")
                    excl_amt = req_qty * unit_pr
                    item_amt = item_data.item_amount if item_data.item_amount is not None else (excl_amt * (Decimal("1") + tax_r / Decimal("100")))
                    total_qty += req_qty
                    subtotal += item_amt
                    await SalesOrderItem.create(
                        tenant_id=tenant_id,
                        sales_order_id=sales_order_id,
                        material_id=item_data.material_id or 0,
                        material_code=(item_data.material_code or "")[:50],
                        material_name=(item_data.material_name or "")[:200],
                        material_spec=(item_data.material_spec or "")[:200] or None,
                        material_unit=(item_data.material_unit or "")[:20],
                        order_quantity=req_qty,
                        delivered_quantity=Decimal("0"),
                        remaining_quantity=req_qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        total_amount=item_amt,
                        delivery_date=item_data.delivery_date,
                        delivery_status="待交货",
                        notes=item_data.notes,
                    )
                discount = getattr(sales_order_data, "discount_amount", None) or Decimal("0")
                total_amt = max(Decimal("0"), subtotal - discount)
                await SalesOrder.filter(id=sales_order_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                )

        result = await self.get_sales_order_by_id(tenant_id, sales_order_id, include_items=True)
        # 记录编辑操作及变更字段（含修改前后值，供操作记录展示）
        changed_fields = []
        field_changes = []
        field_labels = {
            "order_date": "订单日期", "delivery_date": "交货日期", "customer_name": "客户名称",
            "customer_contact": "客户联系人", "customer_phone": "客户电话",
            "total_quantity": "总数量", "total_amount": "总金额", "price_type": "价格类型",
            "discount_amount": "优惠金额", "salesman_name": "销售员", "shipping_address": "收货地址",
            "shipping_method": "发货方式", "payment_terms": "付款条件", "notes": "备注",
        }
        if upd:
            for k in upd:
                if k in ("updated_by",) or k not in old_values:
                    continue
                old_val = old_values.get(k)
                new_val = upd[k]
                old_str = str(old_val) if old_val is not None else ""
                new_str = str(new_val) if new_val is not None else ""
                if old_str != new_str:
                    label = field_labels.get(k, k)
                    changed_fields.append(label)
                    field_changes.append({
                        "field": k,
                        "label": label,
                        "from": old_str,
                        "to": new_str,
                    })
        if items_changed:
            changed_fields.append("订单明细")
            field_changes.append({"field": "items", "label": "订单明细", "from": "", "to": "已修改"})
        if changed_fields:
            import json as _json
            from apps.base_service import AppBaseService
            operator_name = await AppBaseService().get_user_name(updated_by)
            reason_extra = _json.dumps(
                {"changed_fields": changed_fields, "field_changes": field_changes},
                ensure_ascii=False,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                order.status or "DRAFT", order.status or "DRAFT",
                updated_by, operator_name,
                reason="编辑",
                reason_extra=reason_extra,
            )
        # 若是自动审核配置，撤回审核后的订单（当前待审核）编辑保存后自动再次审核
        pending_values = (DemandStatus.PENDING_REVIEW, "PENDING_REVIEW", "PENDING", "待审核")
        if order.status in pending_values:
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "sales_order"
            )
            if not audit_required:
                logger.info("销售订单 %s 为待审核且无需审核，保存后自动通过", sales_order_id)
                return await self.approve_sales_order(tenant_id, sales_order_id, updated_by, is_auto_approve=True)

        # 只要有关联需求，订单任意保存都同步需求内容，使需求管理动态随上游变化（策略 A）
        demand_synced = await self._sync_demand_if_exists(tenant_id, sales_order_id, updated_by)
        out = result.model_dump()
        out["demand_synced"] = demand_synced
        return SalesOrderResponse(**out)

    async def submit_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        submitted_by: int,
    ) -> SalesOrderResponse:
        """提交销售订单"""
        order = await self.get_sales_order_by_id(tenant_id, sales_order_id)

        # 已审核订单无需重复提交，直接返回（避免编辑流程中 update 已自动审核后，前端再调 submit 产生重复日志）
        audited_values = (DemandStatus.AUDITED, "AUDITED", "已审核")
        if order.status in audited_values:
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        # 蓝图设置 auditRequired=False 时表示自动审核，优先于审批流程
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_order"
        )
        if not audit_required:
            logger.info("销售订单 %s 蓝图配置为自动审核，提交后直接通过", sales_order_id)
            from apps.base_service import AppBaseService
            submitter_name = await AppBaseService().get_user_name(submitted_by)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=DemandStatus.PENDING_REVIEW,
                    review_status=ReviewStatus.PENDING,
                    updated_by=submitted_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.DRAFT, DemandStatus.PENDING_REVIEW,
                    submitted_by, submitter_name, "提交",
                )
            return await self.approve_sales_order(tenant_id, sales_order_id, submitted_by, is_auto_approve=True)

        from core.services.approval.approval_instance_service import ApprovalInstanceService
        instance = await ApprovalInstanceService.start_approval(
            tenant_id=tenant_id,
            user_id=submitted_by,
            process_code="sales_order_approval",
            entity_type="sales_order",
            entity_id=order.id,
            entity_uuid=str(order.uuid),
            title=f"销售订单审批: {order.order_code}",
            content=f"客户: {order.customer_name}, 金额: {order.total_amount}",
        )
        if instance:
            from apps.base_service import AppBaseService
            submitter_name = await AppBaseService().get_user_name(submitted_by)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=DemandStatus.PENDING_REVIEW,
                    review_status=ReviewStatus.PENDING,
                    updated_by=submitted_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.DRAFT, DemandStatus.PENDING_REVIEW,
                    submitted_by, submitter_name, "提交",
                )
            await self._sync_demand_if_exists(tenant_id, sales_order_id, submitted_by)
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        # 审批流程不存在，设为待审核，需手动调用审核接口
        from apps.base_service import AppBaseService
        submitter_name = await AppBaseService().get_user_name(submitted_by)
        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                updated_by=submitted_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.DRAFT, DemandStatus.PENDING_REVIEW,
                submitted_by, submitter_name, "提交",
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, submitted_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def approve_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
        is_auto_approve: bool = False,
    ) -> SalesOrderResponse:
        """审核通过销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        pending_review = (ReviewStatus.PENDING, "PENDING", "待审核")
        if order.review_status not in pending_review:
            raise BusinessLogicError(f"只能审核待审核状态的订单，当前: {order.review_status}")

        from apps.base_service import AppBaseService
        approver_name = await AppBaseService().get_user_name(approved_by)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=ReviewStatus.APPROVED,
                status=DemandStatus.AUDITED,
                updated_by=approved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.PENDING_REVIEW, DemandStatus.AUDITED,
                approved_by, approver_name, "自动审核" if is_auto_approve else "审核通过",
            )
            # 审核通过后自动产生 Demand，进入需求池；若已有需求（如反审核再编辑后重新审核）则同步需求
            demand_synced = False
            demand = await self._get_linked_demand(tenant_id, sales_order_id)
            if not demand:
                await self._create_demand_from_sales_order(
                    tenant_id, sales_order_id, approved_by
                )
            else:
                demand_synced = await self._sync_demand_if_exists(tenant_id, sales_order_id, approved_by)
        result = await self.get_sales_order_by_id(tenant_id, sales_order_id)
        out = result.model_dump()
        out["demand_synced"] = demand_synced
        return SalesOrderResponse(**out)

    async def reject_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
        rejection_reason: str,
    ) -> SalesOrderResponse:
        """驳回销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        pending_review = (ReviewStatus.PENDING, "PENDING", "待审核")
        if order.review_status not in pending_review:
            raise BusinessLogicError(f"只能审核待审核状态的订单，当前: {order.review_status}")

        from apps.base_service import AppBaseService
        approver_name = await AppBaseService().get_user_name(approved_by)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=ReviewStatus.REJECTED,
                review_remarks=rejection_reason,
                status=DemandStatus.REJECTED,
                updated_by=approved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.PENDING_REVIEW, DemandStatus.REJECTED,
                approved_by, approver_name, f"驳回: {rejection_reason}",
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, approved_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def unapprove_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        unapproved_by: int,
    ) -> SalesOrderResponse:
        """反审核销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 已审核、已驳回 均可反审核。若检测到 status 与 review_status 不同步，先修复再继续
        rejected_ok = (DemandStatus.REJECTED, "REJECTED", "已驳回", "驳回")
        can_unapprove = (
            self._is_audited(order.status)
            or self._is_review_approved(order.review_status)
            or order.status in rejected_ok
        )
        if not can_unapprove:
            raise BusinessLogicError(f"只能反审核已审核或已驳回的订单，当前: status={order.status}, review_status={order.review_status}")

        # 不同步时自动修复
        if self._is_review_approved(order.review_status) and not self._is_audited(order.status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(status=DemandStatus.AUDITED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)
        elif self._is_audited(order.status) and not self._is_review_approved(order.review_status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(review_status=ReviewStatus.APPROVED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)

        # 需求已下推需求计算：无下游时撤回/作废计算后允许反审核；有下游则阻止
        # 需求未下推：直接允许反审核，需求状态由 _sync_demand_if_exists 与订单同步
        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if demand and demand.pushed_to_computation:
            await self.withdraw_sales_order_from_computation(tenant_id, sales_order_id)

        from apps.base_service import AppBaseService
        unapprover_name = await AppBaseService().get_user_name(unapproved_by)
        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=unapproved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                order.status, DemandStatus.PENDING_REVIEW,
                unapproved_by, unapprover_name, "反审核",
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, unapproved_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def push_sales_order_to_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        下推销售订单到需求计算。

        由 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID），
        然后下推该 Demand 到需求计算。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if not demand:
            demand = await self._create_demand_from_sales_order(
                tenant_id, sales_order_id, created_by
            )
        from apps.kuaizhizao.services.demand_service import DemandService
        return await DemandService().push_to_computation(
            tenant_id=tenant_id,
            demand_id=demand.id,
            created_by=created_by,
        )

    async def preview_push_sales_order_to_computation(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推需求计算预览：返回将参与计算的订单明细，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        demand_exists = demand is not None

        preview_items = []
        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            preview_items.append({
                "material_code": it.material_code,
                "material_name": it.material_name,
                "quantity": float(qty),
                "delivery_date": str(it.delivery_date) if it.delivery_date else None,
            })

        return {
            "target_type": "demand_computation",
            "summary": "将创建需求计算任务（LRP），基于BOM展开进行物料需求运算",
            "demand_exists": demand_exists,
            "items": preview_items,
            "tip": "计算完成后可下推生产计划或工单",
        }

    async def _create_demand_from_sales_order(
        self, tenant_id: int, sales_order_id: int, created_by: int
    ) -> Demand:
        """从 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID）"""
        order = await SalesOrder.get(id=sales_order_id)
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        total_qty = Decimal("0")
        total_amt = Decimal("0")
        demand_items = []
        for it in items:
            total_qty += it.order_quantity
            total_amt += it.total_amount
            demand_items.append({
                "material_id": it.material_id,
                "material_code": it.material_code,
                "material_name": it.material_name,
                "material_spec": it.material_spec,
                "material_unit": it.material_unit,
                "required_quantity": it.order_quantity,
                "delivery_date": it.delivery_date,
                "unit_price": it.unit_price,
                "item_amount": it.total_amount,
                "remaining_quantity": it.order_quantity,
                "delivery_status": it.delivery_status or "待交货",
            })

        demand = await Demand.create(
            tenant_id=tenant_id,
            demand_code=order.order_code,
            demand_type="sales_order",
            business_mode="MTO",
            priority=5,
            demand_name=order.order_code,
            start_date=order.order_date,
            end_date=order.delivery_date,
            order_date=order.order_date,
            delivery_date=order.delivery_date,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            customer_contact=order.customer_contact,
            customer_phone=order.customer_phone,
            total_quantity=total_qty,
            total_amount=total_amt,
            status=DemandStatus.AUDITED,
            review_status=ReviewStatus.APPROVED,
            reviewer_id=order.reviewer_id,
            reviewer_name=order.reviewer_name,
            review_time=order.review_time,
            salesman_id=order.salesman_id,
            salesman_name=order.salesman_name,
            shipping_address=order.shipping_address,
            shipping_method=order.shipping_method,
            payment_terms=order.payment_terms,
            notes=order.notes,
            source_type="sales_order",
            source_id=sales_order_id,
            source_code=order.order_code,
            created_by=created_by,
            updated_by=created_by,
        )
        for d in demand_items:
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand.id,
                **d,
            )
        logger.info("从销售订单 %s 生成需求 %s", order.order_code, demand.demand_code)
        return demand

    async def push_sales_order_to_production_plan(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        直推销售订单到生产计划（跳过需求计算）。
        订单明细直接转为生产计划明细，不要求BOM，原材料由用户自行计算采购。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推生产计划")

        from datetime import date, datetime
        from apps.kuaizhizao.models.production_plan import ProductionPlan
        from apps.kuaizhizao.models.production_plan_item import ProductionPlanItem
        from core.services.business.code_generation_service import CodeGenerationService
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        dates = [it.delivery_date for it in items if it.delivery_date]
        plan_start = min(dates) if dates else date.today()
        plan_end = max(dates) if dates else date.today()

        try:
            plan_code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="PRODUCTION_PLAN_CODE",
                context={"prefix": "LRP-"},
            )
        except Exception:
            plan_code = f"LRP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        plan = await ProductionPlan.create(
            tenant_id=tenant_id,
            plan_code=plan_code,
            plan_name=f"生产计划-{order.order_code}（直推）",
            plan_type="LRP",
            source_type="SalesOrder",
            source_id=sales_order_id,
            source_code=order.order_code,
            plan_start_date=plan_start,
            plan_end_date=plan_end,
            status="草稿",
            execution_status="未执行",
            created_by=created_by,
            updated_by=created_by,
        )

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            await ProductionPlanItem.create(
                tenant_id=tenant_id,
                plan_id=plan.id,
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_type="成品",
                planned_quantity=Decimal(str(qty)),
                planned_date=it.delivery_date or plan_start,
                available_inventory=Decimal(0),
                safety_stock=Decimal(0),
                gross_requirement=Decimal(str(qty)),
                net_requirement=Decimal(str(qty)),
                suggested_action="生产",
                work_order_quantity=Decimal(str(qty)),
                purchase_order_quantity=Decimal(0),
                lead_time=0,
            )

        relation_service = DocumentRelationNewService()
        relation_data = DocumentRelationCreate(
            source_type="sales_order",
            source_id=sales_order_id,
            source_code=order.order_code,
            source_name=order.order_code,
            target_type="production_plan",
            target_id=plan.id,
            target_code=plan.plan_code,
            target_name=plan.plan_name,
            relation_type="source",
            relation_mode="push",
            relation_desc="销售订单直推生产计划（跳过需求计算，原材料自行采购）",
            business_mode="MTO",
            demand_id=None,
        )
        await relation_service.create_relation(
            tenant_id=tenant_id,
            relation_data=relation_data,
            created_by=created_by,
        )

        return {
            "success": True,
            "message": "直推成功，已生成生产计划（原材料由用户自行计算采购）",
            "target_document": {"type": "production_plan", "id": plan.id, "code": plan.plan_code},
        }

    async def preview_push_sales_order_to_production_plan(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推生产计划预览：返回将生成的生产计划明细，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推生产计划")

        plan_items = []
        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            plan_items.append({
                "material_code": it.material_code,
                "material_name": it.material_name,
                "quantity": float(qty),
                "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                "suggested_action": "生产",
            })

        return {
            "target_type": "production_plan",
            "summary": f"将生成 1 个生产计划，包含 {len(plan_items)} 条明细",
            "plan_name_preview": f"生产计划-{order.order_code}（直推）",
            "items": plan_items,
            "tip": "原材料由您自行计算采购",
        }

    async def push_sales_order_to_work_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        直推销售订单到工单（跳过需求计算）。
        - 若产品无BOM：订单明细直接转为工单，原材料由用户自行计算采购。
        - 若产品有BOM：展开BOM，成品+半成品（Make/Outsource/Configure）一键生成工单，采购件由用户自行采购。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推工单")

        from datetime import datetime
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id
        from apps.kuaizhizao.utils.material_source_helper import (
            expand_bom_with_source_control,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
            SOURCE_TYPE_CONFIGURE,
        )

        # 汇总待生成工单的物料：material_id -> {qty, material_code, material_name, delivery_date}
        wo_pool: Dict[int, Dict[str, Any]] = {}

        def _add_to_pool(material_id: int, material_code: str, material_name: str, qty: float, delivery_date):
            if qty <= 0:
                return
            if material_id not in wo_pool:
                wo_pool[material_id] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                }
            wo_pool[material_id]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[material_id]["earliest_delivery"] is None
                or delivery_date < wo_pool[material_id]["earliest_delivery"]
            ):
                wo_pool[material_id]["earliest_delivery"] = delivery_date

        work_order_service = WorkOrderService()
        relation_service = DocumentRelationNewService()

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            delivery_date = it.delivery_date

            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            if bom and bom.bom_code:
                # 有BOM：展开，成品+半成品（Make/Outsource/Configure）生成工单
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)
                requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=it.material_id,
                    required_quantity=qty,
                    only_approved=True,
                    use_default_bom=True,
                )
                for req in requirements:
                    st = req.get("source_type")
                    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                        _add_to_pool(
                            req["material_id"],
                            req["material_code"],
                            req["material_name"],
                            float(req["required_quantity"]),
                            delivery_date,
                        )
            else:
                # 无BOM：仅成品工单
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)

        work_orders = []
        for info in wo_pool.values():
            qty = float(info["quantity"])
            if qty <= 0:
                continue
            wo_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=info["material_id"],
                product_code=info["material_code"],
                product_name=info["material_name"],
                quantity=Decimal(str(qty)),
                production_mode="MTO",
                planned_start_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery") else None
                ),
                planned_end_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery") else None
                ),
                remarks=f"由销售订单 {order.order_code} 直推（含半成品）",
            )
            wo = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=wo_data,
                created_by=created_by,
            )
            wo_id = wo.id if hasattr(wo, "id") else wo.get("id")
            wo_code = wo.code if hasattr(wo, "code") else wo.get("code")
            wo_name = wo.name if hasattr(wo, "name") else wo.get("name")

            relation_data = DocumentRelationCreate(
                source_type="sales_order",
                source_id=sales_order_id,
                source_code=order.order_code,
                source_name=order.order_code,
                target_type="work_order",
                target_id=wo_id,
                target_code=wo_code,
                target_name=wo_name,
                relation_type="source",
                relation_mode="push",
                relation_desc="销售订单直推工单（含半成品，采购件自行采购）",
                business_mode="MTO",
                demand_id=None,
            )
            await relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by,
            )
            work_orders.append(wo)

        if not work_orders:
            raise BusinessLogicError("销售订单无有效明细数量，无法生成工单")

        return {
            "success": True,
            "message": f"直推成功，共生成 {len(work_orders)} 个工单（含半成品，采购件自行采购）",
            "target_documents": [
                {"type": "work_order", "id": w.id if hasattr(w, "id") else w.get("id"), "code": w.code if hasattr(w, "code") else w.get("code")}
                for w in work_orders
            ],
        }

    async def preview_push_sales_order_to_work_order(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推工单预览：返回将生成的工单列表，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推工单")

        from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id
        from apps.kuaizhizao.utils.material_source_helper import (
            expand_bom_with_source_control,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
            SOURCE_TYPE_CONFIGURE,
        )

        wo_pool: Dict[int, Dict[str, Any]] = {}

        def _add_to_pool(material_id: int, material_code: str, material_name: str, qty: float, delivery_date):
            if qty <= 0:
                return
            if material_id not in wo_pool:
                wo_pool[material_id] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                }
            wo_pool[material_id]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[material_id]["earliest_delivery"] is None
                or delivery_date < wo_pool[material_id]["earliest_delivery"]
            ):
                wo_pool[material_id]["earliest_delivery"] = delivery_date

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            delivery_date = it.delivery_date

            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            if bom and bom.bom_code:
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)
                requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=it.material_id,
                    required_quantity=qty,
                    only_approved=True,
                    use_default_bom=True,
                )
                for req in requirements:
                    st = req.get("source_type")
                    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                        _add_to_pool(
                            req["material_id"],
                            req["material_code"],
                            req["material_name"],
                            float(req["required_quantity"]),
                            delivery_date,
                        )
            else:
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)

        wo_items = []
        for info in wo_pool.values():
            qty = float(info["quantity"])
            if qty <= 0:
                continue
            wo_items.append({
                "material_code": info["material_code"],
                "material_name": info["material_name"],
                "quantity": float(qty),
                "delivery_date": str(info["earliest_delivery"]) if info.get("earliest_delivery") else None,
            })

        return {
            "target_type": "work_order",
            "summary": f"将生成 {len(wo_items)} 个工单",
            "items": wo_items,
            "tip": "含半成品，采购件由您自行采购",
        }

    async def create_sales_order_reminder(
        self,
        tenant_id: int,
        sales_order_id: int,
        recipient_user_uuid: str,
        action_type: str,
        remarks: Optional[str],
        created_by: int,
    ) -> Dict[str, Any]:
        """
        创建销售订单提醒，发送站内信给指定用户。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")

        from infra.models.user import User
        from core.services.messaging.message_service import MessageService
        from core.schemas.message_template import SendMessageRequest

        user = await User.get_or_none(tenant_id=tenant_id, uuid=recipient_user_uuid)
        if not user:
            raise NotFoundError(f"提醒对象不存在: {recipient_user_uuid}")

        action_labels = {
            "review": "审核",
            "delivery": "安排发货",
            "invoice": "开票",
            "follow_up": "跟进",
            "other": "其他",
        }
        action_label = action_labels.get(action_type, action_type)

        subject = f"销售订单提醒：{order.order_code}"
        content_parts = [
            f"您有一条销售订单提醒：{order.order_code}",
            f"提醒操作：{action_label}",
        ]
        if remarks:
            content_parts.append(f"备注：{remarks}")
        content = "\n".join(content_parts)

        await MessageService.send_message(
            tenant_id=tenant_id,
            request=SendMessageRequest(
                type="internal",
                recipient=str(user.id),
                subject=subject,
                content=content,
            ),
        )

        return {
            "success": True,
            "message": "提醒已发送",
        }

    async def withdraw_sales_order_from_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> SalesOrderResponse:
        """撤回销售订单的需求计算"""
        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if not demand:
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)
        from apps.kuaizhizao.services.demand_service import DemandService
        await DemandService().withdraw_from_computation(
            tenant_id=tenant_id,
            demand_id=demand.id,
        )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def withdraw_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        withdrawn_by: int,
    ) -> SalesOrderResponse:
        """撤回已提交的销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        pending_ok = (DemandStatus.PENDING_REVIEW, "PENDING_REVIEW", "PENDING", "待审核")
        if order.status not in pending_ok:
            raise BusinessLogicError(f"只能撤回待审核的订单，当前: {order.status}")

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.DRAFT,
                review_status=ReviewStatus.PENDING,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=withdrawn_by,
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, withdrawn_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def delete_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> None:
        """删除销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        deletable = (
            self._is_draft(order.status)
            or order.status in (DemandStatus.PENDING_REVIEW, "PENDING_REVIEW", "PENDING", "待审核", "已提交")
        )
        if not deletable:
            raise BusinessLogicError(f"只能删除草稿或待审核状态的订单，当前: {order.status}")

        async with in_transaction():
            demand = await self._get_linked_demand(tenant_id, sales_order_id)
            if demand:
                from apps.kuaizhizao.services.demand_service import DemandService
                await DemandService().delete_demand(tenant_id, demand.id)
            await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).delete()
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                deleted_at=datetime.now()
            )

    async def bulk_delete_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
    ) -> Dict[str, Any]:
        """批量删除销售订单"""
        deleted = 0
        for oid in sales_order_ids:
            try:
                await self.delete_sales_order(tenant_id, oid)
                deleted += 1
            except (NotFoundError, BusinessLogicError):
                pass
        return {"deleted_count": deleted, "total": len(sales_order_ids), "success": True}

    async def confirm_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        confirmed_by: int,
    ) -> SalesOrderResponse:
        """确认销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise BusinessLogicError("只有已审核状态的销售订单才能确认")

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.CONFIRMED,
                updated_by=confirmed_by,
            )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def push_sales_order_to_delivery(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到销售出库"""
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.master_data.models.warehouse import Warehouse

        if not warehouse_id:
            default_wh = await Warehouse.filter(
                tenant_id=tenant_id, is_active=True
            ).first()
            if not default_wh:
                raise ValidationError("未配置仓库，无法生成销售出库单，请先维护仓库主数据")
            warehouse_id = default_wh.id
            warehouse_name = warehouse_name or default_wh.name

        delivery = await SalesDeliveryService().pull_from_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=created_by,
            delivery_quantities=delivery_quantities,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
        )
        return {
            "success": True,
            "message": "已生成销售出库单",
            "delivery_id": delivery.id,
            "delivery_code": delivery.delivery_code,
        }

    async def push_sales_order_to_shipment_notice(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """下推销售订单到发货通知单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推发货通知单")

        from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService
        today = datetime.now().strftime("%Y%m%d")
        code = await ShipmentNoticeService().generate_code(
            tenant_id, "SHIPMENT_NOTICE_CODE", prefix=f"SN{today}"
        )

        async with in_transaction():
            notice = await ShipmentNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                sales_order_id=order.id,
                sales_order_code=order.order_code or "",
                customer_id=order.customer_id,
                customer_name=order.customer_name or "",
                customer_contact=order.customer_contact,
                customer_phone=order.customer_phone,
                shipping_address=order.shipping_address,
                planned_ship_date=order.delivery_date,
                status="待发货",
                notes=order.notes,
                created_by=created_by,
                updated_by=created_by,
            )
            total_qty = Decimal("0")
            total_amt = Decimal("0")
            for it in items:
                qty = it.order_quantity or Decimal("0")
                amt = it.total_amount or (qty * (it.unit_price or Decimal("0")))
                await ShipmentNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    material_id=it.material_id,
                    material_code=it.material_code or "",
                    material_name=it.material_name or "",
                    material_spec=it.material_spec,
                    material_unit=it.material_unit or "",
                    notice_quantity=qty,
                    unit_price=it.unit_price or Decimal("0"),
                    total_amount=amt,
                    sales_order_item_id=it.id,
                )
                total_qty += qty
                total_amt += amt
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
        logger.info("从销售订单 %s 生成发货通知单 %s", order.order_code, code)
        return {
            "success": True,
            "message": "已生成发货通知单",
            "notice_id": notice.id,
            "notice_code": code,
        }

    async def push_sales_order_to_invoice(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """下推销售订单到销售发票（销项发票）"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推销售发票")

        from apps.kuaizhizao.services.invoice_service import InvoiceService
        from apps.kuaizhizao.schemas.invoice import InvoiceCreate, InvoiceItemCreate

        total_excl = Decimal("0")
        total_tax = Decimal("0")
        total_incl = Decimal("0")
        invoice_items = []
        for it in items:
            qty = it.order_quantity or Decimal("0")
            price = it.unit_price or Decimal("0")
            rate = (it.tax_rate or Decimal("0")) / Decimal("100")
            excl = qty * price
            tax = excl * rate
            incl = excl + tax
            total_excl += excl
            total_tax += tax
            total_incl += incl
            invoice_items.append(
                InvoiceItemCreate(
                    item_name=it.material_name or f"物料{it.material_id}",
                    spec_model=it.material_spec,
                    unit=it.material_unit,
                    quantity=qty,
                    unit_price=price,
                    amount=excl,
                    tax_rate=rate,
                    tax_amount=tax,
                )
            )

        tax_rate_avg = total_tax / total_excl if total_excl else Decimal("0.13")
        invoice_data = InvoiceCreate(
            category="OUT",
            invoice_type="VAT_SPECIAL",
            partner_id=order.customer_id,
            partner_name=order.customer_name or "",
            partner_tax_no=None,
            partner_bank_info=None,
            partner_address_phone=None,
            amount_excluding_tax=total_excl,
            tax_amount=total_tax,
            total_amount=total_incl,
            tax_rate=tax_rate_avg,
            invoice_date=date.today(),
            invoice_number=f"待开票-{order.order_code}",
            status="DRAFT",
            source_document_code=order.order_code,
            description=f"由销售订单 {order.order_code} 下推",
            items=invoice_items,
        )
        invoice = await InvoiceService().create_invoice(tenant_id, invoice_data, created_by)
        logger.info("从销售订单 %s 生成销售发票 %s", order.order_code, invoice.invoice_code)
        return {
            "success": True,
            "message": "已生成销售发票",
            "invoice_id": invoice.id,
            "invoice_code": invoice.invoice_code,
        }
