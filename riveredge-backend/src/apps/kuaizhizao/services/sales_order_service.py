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

    def _order_to_response(
        self,
        order: SalesOrder,
        items: Optional[List[SalesOrderItem]] = None,
        demand: Optional[Demand] = None,
        duration_info: Optional[dict] = None,
        delivery_progress: Optional[float] = None,
        invoice_progress: Optional[float] = None,
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
        if items is not None:
            base["items"] = [
                SalesOrderItemResponse(
                    id=it.id,
                    uuid=str(it.uuid),
                    tenant_id=it.tenant_id,
                    sales_order_id=it.sales_order_id,
                    material_id=it.material_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    material_spec=it.material_spec,
                    material_unit=it.material_unit,
                    required_quantity=it.order_quantity,
                    delivery_date=it.delivery_date,
                    unit_price=it.unit_price,
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
            total_amt = Decimal("0")
            for item_data in sales_order_data.items:
                req_qty = item_data.required_quantity
                unit_pr = item_data.unit_price or Decimal("0")
                item_amt = item_data.item_amount or (req_qty * unit_pr)
                total_qty += req_qty
                total_amt += item_amt
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
                    total_amount=item_amt,
                    delivery_date=item_data.delivery_date,
                    delivery_status="待交货",
                    notes=item_data.notes,
                )

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

        items = None
        if include_items:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).order_by("id")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        duration_info = None
        if include_duration and demand:
            duration_info = getattr(demand, "duration_info", None)
        return self._order_to_response(order, items=items, demand=demand, duration_info=duration_info)

    async def list_sales_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        review_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> SalesOrderListResponse:
        """获取销售订单列表"""
        query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if review_status:
            query = query.filter(review_status=review_status)
        if start_date:
            query = query.filter(order_date__gte=start_date)
        if end_date:
            query = query.filter(order_date__lte=end_date)
        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by("-created_at")

        sales_orders = []
        for order in orders:
            demand = await self._get_linked_demand(tenant_id, order.id)

            # 交货进度：订单明细已交货数量 / 订单总数量
            delivery_progress: Optional[float] = None
            items_agg = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order.id
            ).values_list("order_quantity", "delivered_quantity")
            if items_agg:
                total_qty = sum(Decimal(str(r[0] or 0)) for r in items_agg)
                total_delivered = sum(Decimal(str(r[1] or 0)) for r in items_agg)
                if total_qty and total_qty > 0:
                    delivery_progress = float(min(100, (total_delivered / total_qty) * 100))

            # 开票进度：该订单关联出库单产生的已开票应收金额 / 订单总金额
            invoice_progress_val: Optional[float] = None
            order_amount = Decimal(str(order.total_amount or 0))
            if order_amount and order_amount > 0:
                delivery_ids = await SalesDelivery.filter(
                    tenant_id=tenant_id, sales_order_id=order.id, deleted_at__isnull=True
                ).values_list("id", flat=True)
                if delivery_ids:
                    receivables = await Receivable.filter(
                        tenant_id=tenant_id,
                        source_type="销售出库",
                        source_id__in=list(delivery_ids),
                        invoice_issued=True,
                        deleted_at__isnull=True,
                    ).all()
                    invoiced_sum = sum(Decimal(str(r.total_amount or 0)) for r in receivables)
                    try:
                        invoice_progress_val = float(min(100, (invoiced_sum / order_amount) * 100))
                    except Exception:
                        invoice_progress_val = 0.0
                else:
                    invoice_progress_val = 0.0
            else:
                invoice_progress_val = 0.0

            sales_orders.append(
                self._order_to_response(
                    order,
                    demand=demand,
                    delivery_progress=delivery_progress,
                    invoice_progress=invoice_progress_val,
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

        async with in_transaction():
            upd = sales_order_data.model_dump(exclude_unset=True, exclude={"items"})
            upd["updated_by"] = updated_by
            if upd:
                await SalesOrder.filter(id=sales_order_id).update(**upd)

            if sales_order_data.items is not None:
                await SalesOrderItem.filter(
                    tenant_id=tenant_id, sales_order_id=sales_order_id
                ).delete()
                total_qty = Decimal("0")
                total_amt = Decimal("0")
                for item_data in sales_order_data.items:
                    req_qty = item_data.required_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    item_amt = item_data.item_amount or (req_qty * unit_pr)
                    total_qty += req_qty
                    total_amt += item_amt
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
                        total_amount=item_amt,
                        delivery_date=item_data.delivery_date,
                        delivery_status="待交货",
                        notes=item_data.notes,
                    )
                await SalesOrder.filter(id=sales_order_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                )

        result = await self.get_sales_order_by_id(tenant_id, sales_order_id, include_items=True)
        # 若是自动审核配置，撤回审核后的订单（当前待审核）编辑保存后自动再次审核
        pending_values = (DemandStatus.PENDING_REVIEW, "PENDING_REVIEW", "PENDING", "待审核")
        if order.status in pending_values:
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "sales_order"
            )
            if not audit_required:
                logger.info("销售订单 %s 为待审核且无需审核，保存后自动通过", sales_order_id)
                return await self.approve_sales_order(tenant_id, sales_order_id, updated_by)

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
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                updated_by=submitted_by,
            )
            await self._sync_demand_if_exists(tenant_id, sales_order_id, submitted_by)
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_order"
        )
        if not audit_required:
            logger.info("销售订单 %s 无需审核，自动通过", sales_order_id)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=DemandStatus.PENDING_REVIEW,
                    review_status=ReviewStatus.PENDING,
                    updated_by=submitted_by,
                )
            return await self.approve_sales_order(tenant_id, sales_order_id, submitted_by)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                updated_by=submitted_by,
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, submitted_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def approve_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
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
        if order.status not in (DemandStatus.AUDITED, DemandStatus.REJECTED):
            raise BusinessLogicError(f"只能反审核已审核或已驳回的订单，当前: {order.status}")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if demand and demand.pushed_to_computation:
            await self.withdraw_sales_order_from_computation(tenant_id, sales_order_id)

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
        if not self._is_draft(order.status):
            raise BusinessLogicError(f"只能删除草稿状态的订单，当前: {order.status}")

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
