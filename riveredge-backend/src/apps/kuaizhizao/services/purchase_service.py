"""
采购订单服务

提供采购订单相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

import json
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from tortoise.functions import Sum, Count

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.models.user import User as CurrentUser
from loguru import logger

from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderChange, effective_po_item_outstanding
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderItemResponse,
    PurchaseOrderApprove, PurchaseOrderConfirm, PurchaseOrderListParams,
    MaterialPriceHistoryResponse, MaterialPriceHistoryItem,
    PurchaseTrackingResponse, PurchaseTrackingNode,
    PriceComparisonResponse, MaterialPriceComparison, PriceComparisonItem,
    PurchaseReceiptPullCandidate,
)


def _is_purchase_requisition_source_type(source_type: Optional[str]) -> bool:
    """兼容 PurchaseRequisition / purchase_requisition 等写法。"""
    key = (source_type or "").strip().lower().replace("_", "")
    return key in {"purchaserequest", "purchaserequisition"}
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, LEGACY_AUDITED_VALUES, is_draft_status, is_pending_review_status
from infra.services.business_config_service import BusinessConfigService
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_purchase_order_detail_capabilities,
    enrich_purchase_order_list_capabilities,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date, today_site_str
from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    assert_purchase_order_capability,
)

PURCHASE_ORDER_SORTABLE_FIELDS = frozenset({
    "order_code",
    "supplier_name",
    "buyer_name",
    "order_date",
    "delivery_date",
    "total_quantity",
    "total_amount",
    "status",
    "review_status",
    "created_at",
    "updated_at",
})


class PurchaseService(AppBaseService[PurchaseOrder]):
    """采购订单服务类"""

    def __init__(self):
        super().__init__(PurchaseOrder)

    @staticmethod
    def _extract_material_purchase_benchmark_price(material: Material) -> Optional[Decimal]:
        """
        从物料默认值中提取采购基准价，用于采购价格偏差风控。
        优先级：defaults.purchase.standard_price -> defaults.purchase.purchase_price -> source_config.purchase_price。
        """
        def _to_decimal(v: Any) -> Optional[Decimal]:
            if v is None or v == "":
                return None
            try:
                d = Decimal(str(v))
            except Exception:
                return None
            if d <= 0:
                return None
            return d

        defaults = getattr(material, "defaults", None)
        if isinstance(defaults, dict):
            purchase_defaults = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
            for key in ("standard_price", "purchase_price"):
                d = _to_decimal(purchase_defaults.get(key))
                if d is not None:
                    return d

        source_cfg = getattr(material, "source_config", None)
        if isinstance(source_cfg, dict):
            d = _to_decimal(source_cfg.get("purchase_price"))
            if d is not None:
                return d
        return None

    @staticmethod
    def _validate_purchase_price_fluctuation_for_material(
        *,
        material: Material,
        unit_price: Decimal,
        fluctuation_limit_percent: float,
    ) -> None:
        """
        P3-P-004: 采购价格风控（最小闭环）。
        当阈值>0 且物料存在采购基准价时，若偏差超阈值则阻断下单/改单。
        """
        if fluctuation_limit_percent <= 0:
            return

        benchmark_price = PurchaseService._extract_material_purchase_benchmark_price(material)
        if benchmark_price is None or benchmark_price <= 0:
            return

        current_price = Decimal(str(unit_price or 0))
        deviation_pct = (abs(current_price - benchmark_price) / benchmark_price) * Decimal("100")
        if deviation_pct > Decimal(str(fluctuation_limit_percent)):
            material_label = getattr(material, "main_code", None) or getattr(material, "code", None) or str(material.id)
            raise BusinessLogicError(
                f"物料 {material_label} 采购单价偏差 {deviation_pct:.2f}% 超过阈值 "
                f"{Decimal(str(fluctuation_limit_percent)):.2f}%（基准价={benchmark_price}，当前={current_price}）"
            )

    async def create_purchase_order(
        self,
        tenant_id: int,
        order_data: PurchaseOrderCreate,
        created_by: int
    ) -> PurchaseOrderResponse:
        """
        创建采购订单

        Args:
            tenant_id: 租户ID
            order_data: 订单数据
            created_by: 创建人ID

        Returns:
            PurchaseOrderResponse: 创建的订单信息
        """
        async with in_transaction():
            # 生成订单编码
            if not order_data.order_code:
                today = today_site_str()
                order_data.order_code = await self.generate_code(tenant_id, "PURCHASE_ORDER_CODE", prefix=f"PO{today}")

            # 验证供应商（允许草稿订单临时无供应商：supplier_id<=0）
            supplier = None
            if int(order_data.supplier_id or 0) > 0:
                supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=order_data.supplier_id)
                if not supplier:
                    raise NotFoundError(f"供应商不存在: {order_data.supplier_id}")
            else:
                if (order_data.status or DocumentStatus.DRAFT.value) != DocumentStatus.DRAFT.value:
                    raise ValidationError("非草稿订单必须指定有效供应商")
                if not order_data.supplier_name:
                    order_data.supplier_name = "待定供应商"

            # 流程设置强执行：必须先有采购申请才可下采购单
            config_service = BusinessConfigService()
            biz_config = await config_service.get_business_config(tenant_id)
            purchase_price_fluctuation_limit = await config_service.get_purchase_price_fluctuation_limit_percent(tenant_id)
            require_purchase_requisition = (
                biz_config.get("parameters", {})
                .get("procurement", {})
                .get("require_purchase_requisition", False)
            )
            if require_purchase_requisition:
                source_type = (order_data.source_type or "").strip()
                source_id = order_data.source_id
                if _is_purchase_requisition_source_type(source_type) and source_id:
                    pass
                else:
                    # 兼容按明细挂接采购申请的场景
                    all_items_have_source = all(
                        bool(item.source_id)
                        and _is_purchase_requisition_source_type(item.source_type)
                        for item in order_data.items
                    )
                    if not all_items_have_source:
                        raise BusinessLogicError("当前组织要求先采购申请后下单，请先关联采购申请单")

            # 创建订单头
            order_dict = order_data.model_dump(exclude={'items'})
            user_info = await self.get_user_info(created_by)
            order_dict.update({
                'tenant_id': tenant_id,
                'created_by': created_by,
                'created_by_name': user_info["name"],
                'updated_by': created_by,
                'updated_by_name': user_info["name"],
            })

            # 自动带出归属采购员
            if not order_dict.get("buyer_id") and order_dict.get("supplier_id"):
                if supplier and supplier.buyer_id:
                    order_dict["buyer_id"] = supplier.buyer_id
                    order_dict["buyer_name"] = supplier.buyer_name

            order = await PurchaseOrder.create(**order_dict)

            # 创建订单明细
            total_quantity = Decimal(0)
            total_amount = Decimal(0)

            for item_data in order_data.items:
                # 验证物料
                material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                if not material:
                    raise NotFoundError(f"物料不存在: {item_data.material_id}")
                self._validate_purchase_price_fluctuation_for_material(
                    material=material,
                    unit_price=item_data.unit_price,
                    fluctuation_limit_percent=purchase_price_fluctuation_limit,
                )

                # 计算总价
                total_price = item_data.ordered_quantity * item_data.unit_price
                outstanding_quantity = item_data.ordered_quantity

                item_dict = item_data.model_dump()
                if not str(item_dict.get("material_name") or "").strip():
                    item_dict["material_name"] = str(material.name or "")[:200]
                if not str(item_dict.get("material_code") or "").strip():
                    item_dict["material_code"] = str(
                        material.main_code or getattr(material, "code", None) or ""
                    )[:50]
                item_dict.update({
                    'tenant_id': tenant_id,
                    'order_id': order.id,
                    'total_price': total_price,
                    'outstanding_quantity': outstanding_quantity,
                    'created_by': created_by,
                    'updated_by': created_by
                })

                await PurchaseOrderItem.create(**item_dict)

                total_quantity += item_data.ordered_quantity
                total_amount += total_price

            # 更新订单头金额信息
            tax_amount = total_amount * order_data.tax_rate
            net_amount = total_amount + tax_amount

            await order.update_from_dict({
                'total_quantity': total_quantity,
                'total_amount': total_amount,
                'tax_amount': tax_amount,
                'net_amount': net_amount,
                'updated_by': created_by,
                'updated_by_name': user_info["name"],
            }).save()

            return await self.get_purchase_order_by_id(tenant_id, order.id)

    async def get_purchase_order_by_id(self, tenant_id: int, order_id: int) -> PurchaseOrderResponse:
        """
        根据ID获取采购订单详情

        Args:
            tenant_id: 租户ID
            order_id: 订单ID

        Returns:
            PurchaseOrderResponse: 订单详情
        """
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        # 获取订单明细
        items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, items)
        
        # 使用model_validate，但需要手动处理items字段（因为order.items是ReverseRelation）
        # 先获取订单的所有字段，排除items
        order_data = order.__dict__.copy()
        # 移除items键（如果存在），因为它是ReverseRelation对象
        order_data.pop('items', None)
        
        # 使用model_construct构建响应对象
        response = PurchaseOrderResponse.model_construct(**order_data)
        # 手动设置items（编码/名称以物料主数据为准，避免明细行仅存 material_id 时名称为空）
        response.items = []
        for item in items:
            item_resp = PurchaseOrderItemResponse.model_validate(item)
            material_code, material_name = self._resolve_po_item_material_display(item, material_fallback)
            if material_code:
                item_resp.material_code = material_code
            if material_name:
                item_resp.material_name = material_name
            response.items.append(item_resp)
        # 生命周期
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_lifecycle, get_document_milestones
        milestones = await get_document_milestones(order.tenant_id, "purchase_order", order.id)
        response.lifecycle = get_purchase_order_lifecycle(order, milestones=milestones)
        from core.services.approval.audit_record_enricher import enrich_record

        response = await enrich_purchase_order_detail_capabilities(
            tenant_id, order, response, has_items=len(items) > 0
        )
        return await enrich_record(tenant_id, "purchase_order", response)

    async def list_purchase_orders(
        self,
        tenant_id: int,
        params: PurchaseOrderListParams,
        current_user: Optional[CurrentUser] = None
    ) -> Dict[str, Any]:
        """
        获取采购订单列表

        Args:
            tenant_id: 租户ID
            params: 查询参数

        Returns:
            List[PurchaseOrderListResponse]: 订单列表
        """
        query = PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if current_user:
            from core.services.authorization.data_scope_service import DataScopeService

            query = await DataScopeService.apply(
                query,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:purchase-order",
            )

        # 应用筛选条件
        if params.supplier_id:
            query = query.filter(supplier_id=params.supplier_id)
        if params.status:
            query = query.filter(status=params.status)
        if params.review_status:
            query = query.filter(review_status=params.review_status)
        if params.order_date_from:
            query = query.filter(order_date__gte=params.order_date_from)
        if params.order_date_to:
            query = query.filter(order_date__lte=params.order_date_to)
        if params.delivery_date_from:
            query = query.filter(delivery_date__gte=params.delivery_date_from)
        if params.delivery_date_to:
            query = query.filter(delivery_date__lte=params.delivery_date_to)
        if params.created_start_date:
            query = query.filter(
                created_at__gte=datetime.combine(params.created_start_date, time.min)
            )
        if params.created_end_date:
            query = query.filter(
                created_at__lte=datetime.combine(params.created_end_date, time(23, 59, 59))
            )
        if params.order_code:
            code = str(params.order_code).strip()
            if code:
                query = query.filter(order_code__icontains=code)
        if params.keyword:
            keyword = params.keyword.strip()
            if keyword:
                material_order_ids = (
                    await PurchaseOrderItem.filter(tenant_id=tenant_id)
                    .filter(
                        Q(material_code__icontains=keyword)
                        | Q(material_name__icontains=keyword)
                        | Q(material_spec__icontains=keyword)
                    )
                    .distinct()
                    .values_list("order_id", flat=True)
                )
                query = query.filter(
                    Q(order_code__icontains=keyword)
                    | Q(supplier_name__icontains=keyword)
                    | Q(buyer_name__icontains=keyword)
                    | Q(notes__icontains=keyword)
                    | Q(id__in=list(material_order_ids))
                )

        # 加载建采购变更：与 is_source_order_locked_for_direct_edit / create_change_order 粗过滤对齐
        if params.pullable_only and (params.pull_target or "").strip().lower() == "purchase_order_change":
            change_eligible_statuses = (
                "AUDITED",
                "CONFIRMED",
                "IN_PROGRESS",
                "COMPLETED",
                "CLOSED",
                "RELEASED",
                "已审核",
                "审核通过",
                "已确认",
                "执行中",
                "进行中",
                "已完成",
                "已关闭",
                "已下达",
            )
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            excluded_for_review_gate = (
                "DRAFT",
                "PENDING_REVIEW",
                "REJECTED",
                "草稿",
                "待审核",
                "已驳回",
            )
            query = query.filter(
                Q(status__in=change_eligible_statuses)
                | (
                    Q(review_status__in=approved_review)
                    & ~Q(status__in=excluded_for_review_gate)
                )
            )

        # 分页
        skip = params.skip or 0
        limit = params.limit or 20

        total = await query.count()
        order_clause = params.order_by or "-updated_at"
        field = order_clause.lstrip("-")
        if field not in PURCHASE_ORDER_SORTABLE_FIELDS:
            order_clause = "-updated_at"
        orders = await query.offset(skip).limit(limit).order_by(order_clause, "-id")

        # 不能直接 model_validate(order)：order.items 是 ReverseRelation，会导致 Pydantic 校验失败
        order_ids = [order.id for order in orders]
        totals_by_order = await self._batch_order_receipt_totals(tenant_id, order_ids)
        downstream_totals_by_order = await self._batch_order_downstream_totals(tenant_id, order_ids)

        items_by_order: Dict[int, List[PurchaseOrderItem]] = {}
        material_fallback: Dict[int, Dict[str, str]] = {}
        if params.include_items and order_ids:
            all_items = (
                await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids)
                .order_by("order_id", "id")
                .all()
            )
            for it in all_items:
                items_by_order.setdefault(int(it.order_id), []).append(it)
            material_fallback = await self._load_material_fallback_for_po_items(tenant_id, all_items)

        result = []
        for order in orders:
            totals = totals_by_order.get(order.id, {})
            downstream_totals = downstream_totals_by_order.get(order.id, {})
            items_count = int(totals.get("items_count", 0) or 0)
            ordered_total = Decimal(str(totals.get("ordered_total") or 0))
            received_total = Decimal(str(totals.get("received_total") or 0))
            outstanding_total = Decimal(str(totals.get("outstanding_total") or 0))
            pushed_notice_total = Decimal(str(downstream_totals.get("notice_total") or 0))
            pushed_receipt_total = Decimal(str(downstream_totals.get("receipt_total") or 0))
            downstream_pushed_total = max(pushed_notice_total, pushed_receipt_total)
            downstream_push_progress = (
                round(float((downstream_pushed_total / ordered_total) * Decimal(100)), 1)
                if ordered_total > 0
                else 0.0
            )
            if downstream_push_progress < 0:
                downstream_push_progress = 0.0
            if downstream_push_progress > 100:
                downstream_push_progress = 100.0
            receipt_progress = (
                round(float((received_total / ordered_total) * Decimal(100)), 1)
                if ordered_total > 0
                else 0.0
            )
            order_data = order.__dict__.copy()
            order_data.pop('items', None)
            order_data['items_count'] = items_count
            order_data['downstream_push_progress'] = downstream_push_progress
            order_data['received_total'] = received_total
            order_data['outstanding_total'] = outstanding_total
            order_data['receipt_progress'] = receipt_progress
            resp = PurchaseOrderListResponse.model_construct(**order_data)
            resp.items = []
            if params.include_items:
                for item in items_by_order.get(int(order.id), []):
                    item_resp = PurchaseOrderItemResponse.model_validate(item)
                    material_code, material_name = self._resolve_po_item_material_display(
                        item, material_fallback
                    )
                    item_resp.material_code = material_code
                    item_resp.material_name = material_name
                    resp.items.append(item_resp)
            resp.items_count = items_count
            resp.downstream_push_progress = downstream_push_progress
            resp.received_total = received_total
            resp.outstanding_total = outstanding_total
            resp.receipt_progress = receipt_progress
            from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_lifecycle
            resp.lifecycle = get_purchase_order_lifecycle(order)
            result.append(resp)

        has_items_by_id = {
            oid: int(totals_by_order.get(oid, {}).get("items_count", 0) or 0) > 0 for oid in order_ids
        }
        enriched = await enrich_purchase_order_list_capabilities(
            tenant_id, orders, result, has_items_by_id=has_items_by_id
        )

        # 返回前端期望的格式 { data, total, success }
        from core.services.approval.audit_record_enricher import enrich_data_payload

        return await enrich_data_payload(tenant_id, "purchase_order", {
            "data": [item.model_dump() for item in enriched],
            "total": total,
            "success": True
        })

    async def _batch_order_items_count(
        self, tenant_id: int, order_ids: List[int]
    ) -> Dict[int, int]:
        """批量统计采购订单明细行数（列表用，避免 N+1 count）。"""
        if not order_ids:
            return {}
        rows = (
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                order_id__in=order_ids,
            )
            .group_by("order_id")
            .annotate(cnt=Count("id"))
            .values("order_id", "cnt")
        )
        return {int(row["order_id"]): int(row["cnt"]) for row in rows}

    async def _batch_order_receipt_totals(
        self, tenant_id: int, order_ids: List[int]
    ) -> Dict[int, Dict[str, Decimal]]:
        """批量汇总采购订单明细的采购/已入库/未入库数量。"""
        if not order_ids:
            return {}
        rows = (
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                order_id__in=order_ids,
            )
            .group_by("order_id")
            .annotate(
                ordered_total=Sum("ordered_quantity"),
                received_total=Sum("received_quantity"),
                outstanding_total=Sum("outstanding_quantity"),
                items_count=Count("id"),
            )
            .values(
                "order_id",
                "ordered_total",
                "received_total",
                "outstanding_total",
                "items_count",
            )
        )
        result: Dict[int, Dict[str, Any]] = {}
        for row in rows:
            oid = int(row["order_id"])
            result[oid] = {
                "ordered_total": Decimal(str(row.get("ordered_total") or 0)),
                "received_total": Decimal(str(row.get("received_total") or 0)),
                "outstanding_total": Decimal(str(row.get("outstanding_total") or 0)),
                "items_count": int(row.get("items_count") or 0),
            }
        return result

    async def _batch_order_downstream_totals(
        self, tenant_id: int, order_ids: List[int]
    ) -> Dict[int, Dict[str, Any]]:
        """批量汇总采购订单下游单据数量（收货通知单、采购入库单）。"""
        if not order_ids:
            return {}
        from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
        from apps.kuaizhizao.services.warehouse_service import _PURCHASE_RECEIPT_VOID_STATUSES

        notice_rows = (
            await ReceiptNotice.filter(
                tenant_id=tenant_id,
                purchase_order_id__in=order_ids,
                deleted_at__isnull=True,
            )
            .group_by("purchase_order_id")
            .annotate(
                notice_total=Sum("total_quantity"),
                notice_count=Count("id"),
            )
            .values("purchase_order_id", "notice_total", "notice_count")
        )
        result: Dict[int, Dict[str, Any]] = {
            int(order_id): {
                "notice_total": Decimal("0"),
                "notice_count": 0,
                "receipt_total": Decimal("0"),
                "receipt_count": 0,
            }
            for order_id in order_ids
        }
        for row in notice_rows:
            oid = int(row["purchase_order_id"])
            bucket = result.setdefault(oid, {
                "notice_total": Decimal("0"),
                "notice_count": 0,
                "receipt_total": Decimal("0"),
                "receipt_count": 0,
            })
            bucket["notice_total"] = Decimal(str(row.get("notice_total") or 0))
            bucket["notice_count"] = int(row.get("notice_count") or 0)

        receipt_rows = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).values("id", "purchase_order_id", "status")
        receipt_order_map: Dict[int, int] = {}
        for row in receipt_rows:
            rid = int(row.get("id") or 0)
            if rid <= 0:
                continue
            status = str(row.get("status") or "").strip()
            if status in _PURCHASE_RECEIPT_VOID_STATUSES:
                continue
            oid = int(row.get("purchase_order_id") or 0)
            if oid <= 0:
                continue
            receipt_order_map[rid] = oid
            bucket = result.setdefault(oid, {
                "notice_total": Decimal("0"),
                "notice_count": 0,
                "receipt_total": Decimal("0"),
                "receipt_count": 0,
            })
            bucket["receipt_count"] = int(bucket.get("receipt_count", 0) or 0) + 1

        if receipt_order_map:
            receipt_item_rows = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id__in=list(receipt_order_map.keys()),
            ).values("receipt_id", "receipt_quantity")
            for row in receipt_item_rows:
                rid = int(row.get("receipt_id") or 0)
                oid = receipt_order_map.get(rid)
                if not oid:
                    continue
                qty = Decimal(str(row.get("receipt_quantity") or 0))
                if qty <= 0:
                    continue
                bucket = result.setdefault(oid, {
                    "notice_total": Decimal("0"),
                    "notice_count": 0,
                    "receipt_total": Decimal("0"),
                    "receipt_count": 0,
                })
                bucket["receipt_total"] = Decimal(str(bucket.get("receipt_total") or 0)) + qty
        return result

    async def list_purchase_receipt_pull_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        current_user: Optional[CurrentUser] = None,
    ) -> Dict[str, Any]:
        """
        采购入库选单弹窗候选项：单次查询订单 + 批量汇总明细数量，避免前端 N+1 拉详情。
        """
        query = PurchaseOrder.filter(
            tenant_id=tenant_id,
        )

        if current_user:
            from core.services.authorization.data_scope_service import DataScopeService

            query = await DataScopeService.apply(
                query,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:purchase-order",
            )

        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(order_code__icontains=kw) | Q(supplier_name__icontains=kw)
                )

        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        order_ids = [order.id for order in orders]
        totals_by_order = await self._batch_order_receipt_totals(tenant_id, order_ids)

        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_lifecycle

        candidates: List[PurchaseReceiptPullCandidate] = []
        for order in orders:
            agg = totals_by_order.get(order.id, {})
            outstanding = agg.get("outstanding_total", Decimal(0))
            candidates.append(
                PurchaseReceiptPullCandidate(
                    id=order.id,
                    order_code=order.order_code,
                    supplier_name=order.supplier_name,
                    status=order.status,
                    order_date=order.order_date,
                    delivery_date=order.delivery_date,
                    items_count=agg.get("items_count", 0),
                    ordered_total=agg.get("ordered_total", Decimal(0)),
                    received_total=agg.get("received_total", Decimal(0)),
                    outstanding_total=outstanding,
                    pullable=outstanding > 0,
                    lifecycle=get_purchase_order_lifecycle(order),
                )
            )

        has_items_by_id = {
            int(order.id): int(totals_by_order.get(order.id, {}).get("items_count", 0) or 0) > 0
            for order in orders
            if order.id is not None
        }
        enriched = await enrich_purchase_order_list_capabilities(
            tenant_id, list(orders), candidates, has_items_by_id=has_items_by_id
        )
        normalized: List[PurchaseReceiptPullCandidate] = []
        for item in enriched:
            push_allowed = bool(
                getattr(getattr(item, "capabilities", None), "push_receipt", None)
                and item.capabilities.push_receipt.allowed
            )
            normalized.append(
                item.model_copy(update={"pullable": push_allowed})
                if hasattr(item, "model_copy")
                else item
            )

        return {
            "data": [item.model_dump() for item in normalized],
            "total": total,
            "success": True,
        }

    async def update_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: PurchaseOrderUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> PurchaseOrderResponse:
        """
        更新采购订单

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            order_data: 更新数据
            updated_by: 更新人ID

        Returns:
            PurchaseOrderResponse: 更新后的订单信息
        """
        async with in_transaction():
            order = await PurchaseOrder.get_or_none(
                tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"采购订单不存在: {order_id}")

            from apps.kuaizhizao.constants import DocumentStatus, normalize_status

            if (
                normalize_status(order.status) == DocumentStatus.PENDING_REVIEW.value
                and not approval_edit_context
            ):
                from core.services.approval.approval_edit_guard import ApprovalEditGuard

                edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                    tenant_id, "purchase_order", order_id, updated_by
                )
                if not edit_ctx:
                    raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")

            if approval_edit_context:
                from core.config.audit_editable_fields import is_field_editable

                node_editable = approval_edit_context.get("editable_fields")
                upd_preview = order_data.model_dump(exclude_unset=True, exclude={"items", "change_reason"})
                for field in upd_preview:
                    if field in ("updated_by",):
                        continue
                    if not is_field_editable("purchase_order", field, node_editable):
                        raise ValidationError(f"字段「{field}」不允许在审核中修改")
                if order_data.items is not None and not is_field_editable(
                    "purchase_order", "items", node_editable
                ):
                    raise ValidationError("字段「订单明细」不允许在审核中修改")

            from apps.kuaizhizao.services.order_change.helpers import is_source_order_locked_for_direct_edit
            if is_source_order_locked_for_direct_edit(order.status, order.review_status):
                raise BusinessLogicError(
                    f"采购订单已生效或执行中，禁止直接修改，请通过采购变更单变更。当前状态: {order.status}"
                )

            requires_audit = order.status not in [DocumentStatus.DRAFT.value]
            operator_name = ""
            try:
                from apps.common.base_service import AppBaseService
                operator_name = await AppBaseService().get_user_name(updated_by) or str(updated_by)
            except Exception:
                operator_name = str(updated_by)

            if requires_audit:
                update_items = order_data.model_dump(exclude_unset=True, exclude={'items', 'change_reason'})
                for field, new_val in update_items.items():
                    old_val = getattr(order, field, None)
                    if str(old_val) != str(new_val):
                        await PurchaseOrderChange.create(
                            tenant_id=tenant_id,
                            order_id=order_id,
                            change_type="Modify",
                            field_name=field,
                            old_value=str(old_val),
                            new_value=str(new_val),
                            reason=order_data.change_reason,
                            operator_id=updated_by,
                            operator_name=operator_name
                        )

            # 更新订单头
            update_dict = order_data.model_dump(exclude_unset=True, exclude={'items', 'change_reason'})
            user_info = await self.get_user_info(updated_by)
            update_dict['updated_by'] = updated_by
            update_dict['updated_by_name'] = user_info["name"]

            await order.update_from_dict(update_dict).save()

            # 如果有明细更新，重新计算金额
            if order_data.items:
                purchase_price_fluctuation_limit = await BusinessConfigService().get_purchase_price_fluctuation_limit_percent(
                    tenant_id
                )
                # 删除原有明细
                await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()

                # 重新创建明细
                total_quantity = Decimal(0)
                total_amount = Decimal(0)

                for item_data in order_data.items:
                    material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                    if not material:
                        raise NotFoundError(f"物料不存在: {item_data.material_id}")
                    self._validate_purchase_price_fluctuation_for_material(
                        material=material,
                        unit_price=item_data.unit_price,
                        fluctuation_limit_percent=purchase_price_fluctuation_limit,
                    )

                    total_price = item_data.ordered_quantity * item_data.unit_price
                    outstanding_quantity = item_data.ordered_quantity

                    item_dict = item_data.model_dump()
                    if not str(item_dict.get("material_name") or "").strip():
                        item_dict["material_name"] = str(material.name or "")[:200]
                    if not str(item_dict.get("material_code") or "").strip():
                        item_dict["material_code"] = str(
                            material.main_code or getattr(material, "code", None) or ""
                        )[:50]
                    item_dict.update({
                        'tenant_id': tenant_id,
                        'order_id': order.id,
                        'total_price': total_price,
                        'outstanding_quantity': outstanding_quantity,
                        'updated_by': updated_by
                    })

                    if requires_audit:
                        # 对于明细的变更，目前简化记录为"明细整批更新"，后续可根据需求实现行级更细精度的对比
                        await PurchaseOrderChange.create(
                            tenant_id=tenant_id,
                            order_id=order_id,
                            change_type="Modify",
                            field_name="items",
                            old_value="[Batch Items Update]",
                            new_value=f"Original Material IDs updated by {operator_name}",
                            reason=order_data.change_reason,
                            operator_id=updated_by,
                            operator_name=operator_name
                        )
                    await PurchaseOrderItem.create(**item_dict)

                    total_quantity += item_data.ordered_quantity
                    total_amount += total_price

                # 更新订单头金额
                tax_amount = total_amount * (order_data.tax_rate or order.tax_rate)
                net_amount = total_amount + tax_amount

                await order.update_from_dict({
                    'total_quantity': total_quantity,
                    'total_amount': total_amount,
                    'tax_amount': tax_amount,
                    'net_amount': net_amount,
                    'updated_by': updated_by
                }).save()

            return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def submit_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        submitted_by: int
    ) -> PurchaseOrderResponse:
        """
        提交采购订单（非审核，仅改变状态为待审核）
        
        如果配置了采购订单审批流程，则自动启动审批流程（采购审批流程增强）。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            submitted_by: 提交人ID

        Returns:
            PurchaseOrderResponse: 提交后的订单信息
        """
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        assert_purchase_order_capability(order, "submit", has_items=True)

        # 检查业务配置：若无需审核，则提交后直接设为已审核（考虑中小企业实情）
        from infra.services.business_config_service import BusinessConfigService
        config_service = BusinessConfigService()
        audit_required = await config_service.check_audit_required(tenant_id, "purchase_order")

        if not audit_required:
            # 无需审核，直接确认
            await order.update_from_dict({
                'status': DocumentStatus.CONFIRMED.value,
                'review_status': ReviewStatus.APPROVED.value,
                'updated_by': submitted_by
            }).save()
            return await self.get_purchase_order_by_id(tenant_id, order_id)

        # 启动审批流程（统一使用 ApprovalInstanceService）
        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService
            instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=submitted_by,
                node_key="purchase_order",
                entity_type="purchase_order",
                entity_id=order_id,
                entity_uuid=str(order.uuid),
                title=f"采购订单审批: {order.order_code}",
                content=f"供应商: {order.supplier_name}, 金额: {order.total_amount}",
            )
            status = DocumentStatus.PENDING_REVIEW.value
        except Exception as e:
            logger.warning(f"启动采购订单审批流程失败: {str(e)}，订单ID: {order_id}")
            status = DocumentStatus.PENDING_REVIEW.value

        await order.update_from_dict({
            'status': status,
            'review_status': ReviewStatus.PENDING.value,
            'updated_by': submitted_by
        }).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def withdraw_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        withdrawn_by: int,
    ) -> PurchaseOrderResponse:
        """撤回提交：待审核 → 草稿（提交人撤回，非反审核）"""
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")
        assert_purchase_order_capability(order, "withdraw_submit")

        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="purchase_order",
                entity_id=order_id,
                operator_id=withdrawn_by,
            )
        except Exception as e:
            logger.warning("取消采购订单审批流程失败或无需取消: {}", e)

        await order.update_from_dict({
            "status": DocumentStatus.DRAFT.value,
            "review_status": ReviewStatus.PENDING.value,
            "reviewer_id": None,
            "review_time": None,
            "review_remarks": None,
            "updated_by": withdrawn_by,
        }).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def approve_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        approve_data: PurchaseOrderApprove,
        approved_by: int
    ) -> PurchaseOrderResponse:
        """
        审核采购订单（采购审批流程增强）
        
        如果启动了审批流程，则通过审批流程系统审核；否则使用原有逻辑。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            approve_data: 审核数据
            approved_by: 审核人ID

        Returns:
            PurchaseOrderResponse: 审核后的订单信息
        """
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        assert_purchase_order_capability(order, "approve")

        approver_name = await self.get_user_name(approved_by)

        approval_status = await ApprovalInstanceService.get_approval_status(
            tenant_id=tenant_id,
            entity_type="purchase_order",
            entity_id=order_id,
        )

        if approval_status.get("has_flow"):
            result = await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type="purchase_order",
                entity_id=order_id,
                approver_id=approved_by,
                approved=approve_data.approved,
                comment=approve_data.review_remarks,
            )
            if result.get("flow_rejected"):
                update_dict = {
                    'reviewer_id': approved_by,
                    'reviewer_name': approver_name,
                    'review_time': resolve_business_datetime(),
                    'review_status': ReviewStatus.REJECTED.value,
                    'review_remarks': approve_data.review_remarks,
                    'status': DocumentStatus.REJECTED.value,
                    'updated_by': approved_by
                }
            elif result.get("flow_completed"):
                update_dict = {
                    'reviewer_id': approved_by,
                    'reviewer_name': approver_name,
                    'review_time': resolve_business_datetime(),
                    'review_status': ReviewStatus.APPROVED.value,
                    'review_remarks': approve_data.review_remarks,
                    'status': DocumentStatus.CONFIRMED.value,
                    'updated_by': approved_by
                }
            else:
                update_dict = {
                    'reviewer_id': approved_by,
                    'reviewer_name': approver_name,
                    'review_time': resolve_business_datetime(),
                    'review_status': "审核中" if approve_data.approved else ReviewStatus.REJECTED.value,
                    'review_remarks': approve_data.review_remarks,
                    'updated_by': approved_by
                }
                if not approve_data.approved:
                    update_dict['status'] = DocumentStatus.REJECTED.value
        else:
            # 没有启动审批流程，使用原有逻辑
            from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES
            current_review = str(order.review_status or "").strip()
            if REVIEW_STATUS_ALIASES.get(current_review, current_review) != ReviewStatus.PENDING.value:
                raise BusinessLogicError("订单已被审核")

            update_dict = {
                'reviewer_id': approved_by,
                'reviewer_name': approver_name,
                'review_time': resolve_business_datetime(),
                'review_status': ReviewStatus.APPROVED.value if approve_data.approved else ReviewStatus.REJECTED.value,
                'review_remarks': approve_data.review_remarks,
                'updated_by': approved_by
            }

            if approve_data.approved:
                update_dict['status'] = DocumentStatus.CONFIRMED.value

        await order.update_from_dict(update_dict).save()

        if update_dict.get("status") == DocumentStatus.CONFIRMED.value:
            await order.refresh_from_db()
            from apps.kuaicaiwu.services.finance_integration_hooks import (
                ensure_prepayment_payment_for_purchase_order,
            )

            await ensure_prepayment_payment_for_purchase_order(
                tenant_id=tenant_id,
                order_id=order_id,
                order_code=order.order_code,
                supplier_id=order.supplier_id,
                supplier_name=order.supplier_name,
                prepayment_amount=order.prepayment_amount,
                prepayment_bank_account_id=order.prepayment_bank_account_id,
                operator_id=approved_by,
            )

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def revoke_purchase_order_approval(
        self,
        tenant_id: int,
        order_id: int,
        operator_id: int,
    ) -> PurchaseOrderResponse:
        """撤销审核：人工审→待审核，自动审→草稿。"""
        from apps.kuaizhizao.services.document_action_policy.enricher import purchase_order_has_downstream
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService
        from infra.services.business_config_service import BusinessConfigService

        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        has_downstream = await purchase_order_has_downstream(tenant_id, order_id)
        assert_purchase_order_capability(
            order,
            "revoke_approval",
            has_downstream=has_downstream,
        )

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "purchase_order"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_status = (
            DocumentStatus.PENDING_REVIEW.value
            if landing == "pending"
            else DocumentStatus.DRAFT.value
        )

        async def _do_revoke() -> PurchaseOrderResponse:
            await order.update_from_dict({
                "status": target_status,
                "review_status": ReviewStatus.PENDING.value,
                "reviewer_id": None,
                "reviewer_name": None,
                "review_time": None,
                "review_remarks": None,
                "updated_by": operator_id,
            }).save()
            return await self.get_purchase_order_by_id(tenant_id, order_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="purchase_order",
            entity_id=order_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def confirm_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        confirm_data: PurchaseOrderConfirm,
        confirmed_by: int
    ) -> PurchaseOrderResponse:
        """
        确认采购订单（供应商确认）

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            confirm_data: 确认数据
            confirmed_by: 确认人ID

        Returns:
            PurchaseOrderResponse: 确认后的订单信息
        """
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核的订单才能确认")

        await order.update_from_dict({
            'status': DocumentStatus.CONFIRMED.value,
            'notes': order.notes + f"\n确认备注：{confirm_data.confirm_remarks or ''}",
            'updated_by': confirmed_by
        }).save()

        await order.refresh_from_db()
        from apps.kuaicaiwu.services.finance_integration_hooks import (
            ensure_prepayment_payment_for_purchase_order,
        )

        await ensure_prepayment_payment_for_purchase_order(
            tenant_id=tenant_id,
            order_id=order_id,
            order_code=order.order_code,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            prepayment_amount=order.prepayment_amount,
            prepayment_bank_account_id=order.prepayment_bank_account_id,
            operator_id=confirmed_by,
        )

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def delete_purchase_order(
        self, tenant_id: int, order_id: int, operator_id: Optional[int] = None
    ) -> bool:
        """
        删除采购订单

        删除前会同步回滚关联的采购申请：清除申请明细的 purchase_order_id，
        并重新计算采购申请状态（全部转单→部分转单→已通过），同时在采购申请上留下操作记录。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            operator_id: 操作人ID（用于记录操作历史）

        Returns:
            bool: 是否删除成功
        """
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        assert_purchase_order_capability(order, "delete")

        po_code = getattr(order, "order_code", str(order_id))

        # 同步回滚采购申请：清除关联申请明细的转单引用，重算申请状态，并记录操作历史
        await self._sync_requisition_on_po_delete(
            tenant_id=tenant_id, order_id=order_id, po_code=po_code, operator_id=operator_id
        )

        # 删除采购申请→采购订单 的 DocumentRelation（避免操作历史显示已删除的下游）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="purchase_requisition",
            target_type="purchase_order",
            target_id=order_id,
        ).delete()

        # 明细硬删；订单头软删（与销售订单一致，兼容 tenant+code 部分唯一索引）
        await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()
        await PurchaseOrder.filter(tenant_id=tenant_id, id=order_id).update(
            deleted_at=resolve_business_datetime()
        )

        return True

    async def _sync_requisition_on_po_delete(
        self,
        tenant_id: int,
        order_id: int,
        po_code: str = "",
        operator_id: Optional[int] = None,
    ) -> None:
        """采购订单删除时，清除关联采购申请明细的转单引用、重算申请状态，并记录操作历史"""
        from apps.kuaizhizao.models import PurchaseRequisition, PurchaseRequisitionItem
        from apps.kuaizhizao.models.state_transition import StateTransitionLog
        from apps.kuaizhizao.constants import DocumentStatus
        from apps.common.base_service import AppBaseService
        from datetime import datetime

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, purchase_order_id=order_id
        ).all()
        if not items:
            return

        operator_name = ""
        if operator_id:
            try:
                operator_name = await AppBaseService().get_user_name(operator_id) or str(operator_id)
            except Exception:
                operator_name = str(operator_id)

        requisition_ids = list({i.requisition_id for i in items})
        for item in items:
            await item.update_from_dict({
                "purchase_order_id": None,
                "purchase_order_item_id": None,
                "supplier_id": None,
            }).save()

        reason = f"下游采购单已删除（{po_code}）" if po_code else "下游采购单已删除"
        comment = json.dumps({"deleted_po_id": order_id, "deleted_po_code": po_code}, ensure_ascii=False)

        for rid in requisition_ids:
            req = await PurchaseRequisition.get_or_none(
                tenant_id=tenant_id, id=rid, deleted_at__isnull=True
            )
            if not req:
                continue

            from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService
            await PurchaseRequisitionService().merge_split_requisition_items(tenant_id, rid)

            old_status = req.status
            all_items = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=rid
            ).all()
            if not all_items:
                continue
            has_any = any(i.purchase_order_id for i in all_items)
            all_converted = all(i.purchase_order_id for i in all_items)
            if all_converted:
                req.status = DocumentStatus.FULL_CONVERTED.value
            elif has_any:
                req.status = DocumentStatus.PARTIAL_CONVERTED.value
            else:
                req.status = "已通过"
            await req.save()

            if operator_id:
                await StateTransitionLog.create(
                    tenant_id=tenant_id,
                    entity_type="purchase_requisition",
                    entity_id=rid,
                    from_state=old_status,
                    to_state=req.status,
                    transition_reason=reason,
                    transition_comment=comment,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    transition_time=resolve_business_datetime(),
                    related_entity_type="purchase_order",
                    related_entity_id=order_id,
                )

    async def _load_material_fallback_for_po_items(
        self,
        tenant_id: int,
        items: List[PurchaseOrderItem],
    ) -> Dict[int, Dict[str, str]]:
        """从物料主数据加载编码/名称（下推预览等展示以主数据为准）。"""
        from apps.master_data.models.material import Material

        need_ids = {
            int(it.material_id)
            for it in items
            if getattr(it, "material_id", None) and int(it.material_id) > 0
        }
        if not need_ids:
            return {}
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=list(need_ids),
            deleted_at__isnull=True,
        ).all()
        fallback: Dict[int, Dict[str, str]] = {}
        for m in materials:
            fallback[int(m.id)] = {
                "code": str(m.main_code or getattr(m, "code", None) or "")[:50],
                "name": str(m.name or "")[:200],
            }
        return fallback

    @staticmethod
    def _resolve_po_item_material_display(
        item: PurchaseOrderItem,
        material_fallback: Dict[int, Dict[str, str]],
    ) -> tuple[str, str]:
        mid = int(item.material_id) if getattr(item, "material_id", None) else 0
        mf = material_fallback.get(mid) if mid > 0 else None
        if mf:
            code = (mf.get("code") or "").strip()[:50]
            name = (mf.get("name") or "").strip()[:200]
            if code or name:
                return code, name
        code = str(getattr(item, "material_code", None) or "").strip()[:50]
        name = str(getattr(item, "material_name", None) or "").strip()[:200]
        return code, name

    async def _build_outstanding_push_preview_items(
        self,
        tenant_id: int,
        order_id: int,
        *,
        subtract_draft_occupied: bool = False,
        subtract_noticed: bool = False,
    ) -> tuple[List[Dict[str, Any]], List[PurchaseOrderItem]]:
        """构建未入库明细的标准下推预览行（quantity/pushed_quantity/max_push_quantity）。"""
        from apps.kuaizhizao.services.warehouse_service import (
            noticed_qty_by_po_item_ids,
            occupied_purchase_receipt_qty_by_po_item_ids,
            sync_purchase_order_receipt_quantities,
        )

        await sync_purchase_order_receipt_quantities(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id,
        ).all()
        occupied_by_item: dict[int, float] = {}
        if subtract_draft_occupied:
            occupied_raw = await occupied_purchase_receipt_qty_by_po_item_ids(
                tenant_id, [order_id]
            )
            occupied_by_item = {k: float(v) for k, v in occupied_raw.items()}
        noticed_by_item: dict[int, float] = {}
        if subtract_noticed:
            noticed_raw = await noticed_qty_by_po_item_ids(tenant_id, [order_id])
            noticed_by_item = {k: float(v) for k, v in noticed_raw.items()}
        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, order_items)
        preview_items: List[Dict[str, Any]] = []
        for item in order_items:
            ordered = float(item.ordered_quantity or 0)
            received = float(item.received_quantity or 0)
            outstanding = float(effective_po_item_outstanding(item))
            if outstanding <= 0:
                continue
            occupied = occupied_by_item.get(int(item.id), 0.0)
            noticed = noticed_by_item.get(int(item.id), 0.0)
            if subtract_noticed:
                max_push = min(outstanding, max(0.0, ordered - noticed))
                pushed_quantity = noticed
            else:
                max_push = outstanding - occupied
                pushed_quantity = received + occupied
            if max_push <= 0:
                continue
            material_code, material_name = self._resolve_po_item_material_display(
                item, material_fallback
            )
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": ordered,
                    "pushed_quantity": pushed_quantity,
                    "max_push_quantity": max_push,
                }
            )
        return preview_items, order_items

    async def _enrich_po_push_preview_items_with_warehouse(
        self,
        tenant_id: int,
        preview_items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """为采购下推预览行补全物料默认入库仓库。"""
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        enriched: List[Dict[str, Any]] = []
        for row in preview_items:
            item = dict(row)
            line_wh_id: Optional[int] = None
            line_wh_name: Optional[str] = None
            material_id = item.get("material_id")
            if material_id:
                material_wh = await resolve_primary_default_warehouse_from_material(
                    tenant_id,
                    material_id=int(material_id),
                )
                if material_wh:
                    line_wh_id, line_wh_name = material_wh
            item["warehouse_id"] = line_wh_id
            item["warehouse_name"] = line_wh_name
            enriched.append(item)
        return enriched

    async def preview_push_to_receipt_notice(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        order_model = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order_model:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        preview_items, order_items = await self._build_outstanding_push_preview_items(
            tenant_id, order_id, subtract_noticed=True
        )
        preview_items = await self._enrich_po_push_preview_items_with_warehouse(tenant_id, preview_items)
        has_raw_outstanding = any(float(effective_po_item_outstanding(i)) > 0 for i in order_items)
        has_pushable = bool(preview_items)
        assert_purchase_order_capability(
            order_model,
            "push_receipt_notice",
            has_items=bool(order_items),
            has_outstanding=has_raw_outstanding,
            has_pushable_notice_outstanding=has_pushable,
        )

        pushable_count = len(preview_items)
        has_blocking = pushable_count == 0
        blocking_reason = (
            "purchase_order.push_receipt_notice.qty_occupied"
            if has_raw_outstanding and not has_pushable
            else "purchase_order.push_receipt.no_outstanding"
            if has_blocking
            else None
        )
        return {
            "target_type": "receipt_notice",
            "order_id": order_id,
            "order_code": order_model.order_code,
            "summary": (
                f"请选择本次要下推的收货通知明细（{pushable_count} 行可下推）"
                if not has_blocking
                else "当前采购单无可下推收货通知明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "请为每行选择入库仓库；系统将按所选明细与数量生成收货通知单。",
            "line_warehouse_required": True,
        }

    async def preview_push_to_receipt(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        order_model = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order_model:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        preview_items, order_items = await self._build_outstanding_push_preview_items(
            tenant_id, order_id, subtract_draft_occupied=True
        )
        preview_items = await self._enrich_po_push_preview_items_with_warehouse(tenant_id, preview_items)
        has_raw_outstanding = any(float(effective_po_item_outstanding(i)) > 0 for i in order_items)
        has_pushable = bool(preview_items)
        assert_purchase_order_capability(
            order_model,
            "push_receipt",
            has_items=bool(order_items),
            has_outstanding=has_raw_outstanding,
            has_pushable_receipt_outstanding=has_pushable,
        )

        pushable_count = len(preview_items)
        has_blocking = pushable_count == 0
        blocking_reason = (
            "purchase_order.push_receipt.qty_occupied"
            if has_raw_outstanding and not has_pushable
            else "purchase_order.push_receipt.no_outstanding"
            if has_blocking
            else None
        )
        return {
            "target_type": "purchase_receipt",
            "order_id": order_id,
            "order_code": order_model.order_code,
            "summary": (
                f"请选择本次要下推的采购入库明细（{pushable_count} 行可下推）"
                if not has_blocking
                else "当前采购单无可下推采购入库明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "请为每行选择入库仓库与本次下推数量，确认后将生成采购入库草稿。",
            "line_warehouse_required": True,
        }

    async def preview_push_to_invoice(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice

        order_model = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order_model:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        has_invoice = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id,
            deleted_at__isnull=True,
        ).exists()
        assert_purchase_order_capability(
            order_model,
            "push_invoice",
            has_items=bool(order_items),
            has_invoice=has_invoice,
        )

        preview_items: List[Dict[str, Any]] = []
        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, order_items)
        for item in order_items:
            ordered = float(item.ordered_quantity or 0)
            if ordered <= 0:
                continue
            material_code, material_name = self._resolve_po_item_material_display(
                item, material_fallback
            )
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": ordered,
                    "pushed_quantity": 0.0,
                    "max_push_quantity": ordered,
                    "unit_price": float(item.unit_price or 0),
                }
            )

        has_blocking = has_invoice
        blocking_reason = (
            "purchase_order.push_invoice.already_exists" if has_blocking else None
        )
        return {
            "target_type": "purchase_invoice",
            "order_id": order_id,
            "order_code": order_model.order_code,
            "summary": (
                f"将按采购订单 {order_model.order_code} 生成采购发票草稿（{len(preview_items)} 行明细）"
                if not has_blocking
                else "该采购单已存在采购发票，不能重复下推"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "发票号码等信息可在财务管理中补全。",
        }

    async def preview_push_to_purchase_return(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.purchase_return import PurchaseReturn
        from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem

        order_model = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order_model:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        has_received = any(float(item.received_quantity or 0) > 0 for item in order_items)
        assert_purchase_order_capability(
            order_model,
            "push_purchase_return",
            has_items=bool(order_items),
            has_received=has_received,
        )

        return_ids = await PurchaseReturn.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id,
            deleted_at__isnull=True,
        ).exclude(status="已取消").values_list("id", flat=True)
        returned_by_material: Dict[int, float] = {}
        if return_ids:
            return_items = await PurchaseReturnItem.filter(
                tenant_id=tenant_id,
                return_id__in=list(return_ids),
            ).all()
            for ri in return_items:
                mid = int(ri.material_id)
                returned_by_material[mid] = returned_by_material.get(mid, 0.0) + float(ri.return_quantity or 0)

        preview_items: List[Dict[str, Any]] = []
        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, order_items)
        for item in order_items:
            received = float(item.received_quantity or 0)
            if received <= 0:
                continue
            returned = returned_by_material.get(int(item.material_id), 0.0)
            max_return = max(0.0, received - returned)
            if max_return <= 0:
                continue
            material_code, material_name = self._resolve_po_item_material_display(
                item, material_fallback
            )
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": received,
                    "pushed_quantity": returned,
                    "max_push_quantity": max_return,
                }
            )

        pushable_count = len(preview_items)
        has_blocking = pushable_count == 0
        blocking_reason = (
            "purchase_order.push_purchase_return.no_lines" if has_blocking else None
        )
        return {
            "target_type": "purchase_return",
            "order_id": order_id,
            "order_code": order_model.order_code,
            "summary": (
                f"请选择本次要下推的采购退货明细（{pushable_count} 行可退）"
                if not has_blocking
                else "当前采购单无可退货明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "确认后将选择退货仓库并生成采购退货单。",
        }

    async def push_to_receipt_preview(
        self,
        tenant_id: int,
        order_id: int,
        receipt_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推采购入库预览：返回将生成的明细及预生成批号（供下推弹窗展示）
        
        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            receipt_quantities: 入库数量字典 {item_id: quantity}
            
        Returns:
            Dict: items 列表，每项含 item_id, material_code, material_name, receipt_quantity, batch_number
        """
        from apps.master_data.models.material import Material
        from apps.master_data.models.supplier import Supplier
        from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
        from decimal import Decimal

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()
        from apps.kuaizhizao.services.warehouse_service import (
            occupied_purchase_receipt_qty_by_po_item_ids,
            sync_purchase_order_receipt_quantities,
        )

        await sync_purchase_order_receipt_quantities(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()
        occupied_by_item = await occupied_purchase_receipt_qty_by_po_item_ids(
            tenant_id, [order_id]
        )
        has_raw_outstanding = any(float(effective_po_item_outstanding(item)) > 0 for item in order_items)
        has_pushable = any(
            float(effective_po_item_outstanding(item))
            - float(occupied_by_item.get(int(item.id), 0))
            > 0
            for item in order_items
        )
        assert_purchase_order_capability(
            order,
            "push_receipt",
            has_items=bool(order_items),
            has_outstanding=has_raw_outstanding,
            has_pushable_receipt_outstanding=has_pushable,
        )

        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成入库单")

        supplier_code = None
        if order.supplier_id:
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=order.supplier_id, deleted_at__isnull=True)
            if supplier:
                supplier_code = supplier.code

        class _ItemData:
            def __init__(self, batch_number=None):
                self.batch_number = batch_number

        items = []
        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, order_items)
        qty_keys = set(receipt_quantities.keys()) if receipt_quantities else None
        for item in order_items:
            if qty_keys is not None and item.id not in qty_keys:
                continue
            item_outstanding = effective_po_item_outstanding(item)
            if receipt_quantities and item.id in receipt_quantities:
                receipt_quantity = Decimal(str(receipt_quantities[item.id]))
            else:
                receipt_quantity = item_outstanding
            if receipt_quantity <= 0:
                continue
            occupied = Decimal(str(occupied_by_item.get(int(item.id), 0)))
            max_pushable = item_outstanding - occupied
            if max_pushable <= 0:
                continue
            if receipt_quantity > max_pushable:
                continue

            material = await Material.get_or_none(
                tenant_id=tenant_id,
                id=item.material_id,
                deleted_at__isnull=True,
            )
            material_code, material_name = self._resolve_po_item_material_display(
                item, material_fallback
            )
            batch_number = None
            if material:
                batch_number = await ensure_batch_no_for_item(
                    tenant_id=tenant_id,
                    material=material,
                    item_data=_ItemData(),
                    supplier_code=supplier_code,
                )

            items.append({
                "item_id": item.id,
                "material_id": item.material_id,
                "material_code": material_code,
                "material_name": material_name,
                "receipt_quantity": float(receipt_quantity),
                "batch_number": batch_number,
            })

        return {"items": items}

    async def _resolve_po_item_receipt_snapshot(
        self,
        tenant_id: int,
        item: PurchaseOrderItem,
    ) -> dict[str, str]:
        """补全下推入库所需的物料编码/名称/单位，避免空值触发 schema 校验异常。"""
        from apps.master_data.models.material import Material

        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, [item])
        code, name = self._resolve_po_item_material_display(item, material_fallback)
        unit = str(item.unit or "").strip()
        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=item.material_id,
            deleted_at__isnull=True,
        )
        if material and not unit:
            unit = str(getattr(material, "base_unit", None) or getattr(material, "unit", None) or "").strip()
        if not unit:
            unit = "件"
        if not code or not name:
            raise ValidationError(f"物料 {item.material_id} 缺少编码或名称，无法生成入库单")
        return {
            "material_code": code,
            "material_name": name,
            "material_unit": unit,
        }

    async def push_to_receipt(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        receipt_quantities: Optional[Dict[int, float]] = None,
        batch_numbers: Optional[Dict[int, str]] = None,
        warehouse_id: Optional[int] = None,
        line_warehouses: Optional[Dict[int, int]] = None,
        line_location_ids: Optional[Dict[int, int]] = None,
        line_location_codes: Optional[Dict[int, str]] = None,
    ) -> Dict[str, Any]:
        """
        下推到采购入库
        
        从采购单下推，自动生成采购入库单
        
        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID
            receipt_quantities: 入库数量字典 {item_id: quantity}，如果不提供则使用订单数量
            batch_numbers: 预生成批号字典 {item_id: batch_number}（可选，来自预览时使用以避免重复生成）
            warehouse_id: 入库单表头仓库 ID（可选；未传则取行级或第一个可用仓库）
            line_warehouses: 行级仓库 {purchase_order_item_id: warehouse_id}
            line_location_ids: 行级库位 {purchase_order_item_id: location_id}
            line_location_codes: 行级库位编码 {purchase_order_item_id: location_code}
            
        Returns:
            Dict: 包含创建的采购入库单信息
            
        Raises:
            NotFoundError: 采购单不存在
            BusinessLogicError: 采购单未审核或已全部入库
        """
        from apps.kuaizhizao.services.warehouse_service import (
            PurchaseReceiptService,
            occupied_purchase_receipt_qty_by_po_item_ids,
            sync_purchase_order_receipt_quantities,
            _resolve_warehouse_name_by_id,
        )
        from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
        from decimal import Decimal
        
        # 验证采购单存在且已审核
        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()

        await sync_purchase_order_receipt_quantities(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()
        occupied_by_item = await occupied_purchase_receipt_qty_by_po_item_ids(
            tenant_id, [order_id]
        )
        has_raw_outstanding = any(float(effective_po_item_outstanding(item)) > 0 for item in order_items)
        has_pushable = any(
            float(effective_po_item_outstanding(item))
            - float(occupied_by_item.get(int(item.id), 0))
            > 0
            for item in order_items
        )
        assert_purchase_order_capability(
            order,
            "push_receipt",
            has_items=bool(order_items),
            has_outstanding=has_raw_outstanding,
            has_pushable_receipt_outstanding=has_pushable,
        )

        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成入库单")

        if not has_pushable:
            raise BusinessLogicError("该采购单存在未完成的采购入库单，请处理后再下推")
        
        # 创建采购入库单
        receipt_service = PurchaseReceiptService()
        
        # 构建入库单明细
        receipt_items = []
        qty_keys = set(receipt_quantities.keys()) if receipt_quantities else None
        for item in order_items:
            if qty_keys is not None and item.id not in qty_keys:
                continue
            item_outstanding = effective_po_item_outstanding(item)
            # 确定入库数量
            if receipt_quantities and item.id in receipt_quantities:
                receipt_quantity = Decimal(str(receipt_quantities[item.id]))
            else:
                receipt_quantity = item_outstanding
            
            # 跳过数量为0的明细
            if receipt_quantity <= 0:
                continue
            
            occupied = Decimal(str(occupied_by_item.get(int(item.id), 0)))
            max_pushable = item_outstanding - occupied
            if max_pushable <= 0:
                continue

            # 验证入库数量不超过可下推余量
            if receipt_quantity > max_pushable:
                raise ValidationError(
                    f"物料 {item.material_code} 的入库数量 {receipt_quantity} 超过可下推数量 {max_pushable}"
                )

            batch_number = batch_numbers.get(item.id) if batch_numbers else None
            snapshot = await self._resolve_po_item_receipt_snapshot(tenant_id, item)

            line_wh: Optional[int] = None
            if line_warehouses and item.id in line_warehouses:
                line_wh = int(line_warehouses[item.id])
            elif warehouse_id is not None:
                line_wh = int(warehouse_id)

            line_loc_id: Optional[int] = None
            line_loc_code: Optional[str] = None
            if line_location_ids and item.id in line_location_ids:
                line_loc_id = int(line_location_ids[item.id])
            if line_location_codes and item.id in line_location_codes:
                raw_code = line_location_codes[item.id]
                if raw_code and str(raw_code).strip():
                    line_loc_code = str(raw_code).strip()

            line_wh_name: Optional[str] = None
            if line_wh is not None:
                line_wh_name = await _resolve_warehouse_name_by_id(tenant_id, line_wh)

            receipt_items.append(PurchaseReceiptItemCreate(
                purchase_order_item_id=item.id,
                material_id=item.material_id,
                material_code=snapshot["material_code"],
                material_name=snapshot["material_name"],
                material_unit=snapshot["material_unit"],
                receipt_quantity=receipt_quantity,
                unit_price=item.unit_price,
                total_amount=receipt_quantity * item.unit_price,
                qualified_quantity=receipt_quantity,  # 默认全部合格，后续可通过检验调整
                unqualified_quantity=Decimal('0'),  # 默认无不合格数量
                batch_number=batch_number,
                warehouse_id=line_wh,
                warehouse_name=line_wh_name,
                location_id=line_loc_id,
                location_code=line_loc_code,
            ))
        
        if not receipt_items:
            raise BusinessLogicError("没有可入库的明细")

        from apps.master_data.models.warehouse import Warehouse

        header_wh_id = warehouse_id
        if header_wh_id is None and line_warehouses:
            for ri in receipt_items:
                if getattr(ri, "warehouse_id", None):
                    header_wh_id = int(ri.warehouse_id)
                    break

        wh_query = Warehouse.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
        if header_wh_id is not None:
            wh = await wh_query.filter(id=int(header_wh_id)).first()
            if not wh:
                raise BusinessLogicError(f"仓库不存在或已停用: {header_wh_id}")
        else:
            wh = await wh_query.order_by("id").first()
            if not wh:
                raise BusinessLogicError("未配置可用仓库，无法生成采购入库单。请先在主数据维护仓库。")
        wh_name = str(getattr(wh, "name", None) or getattr(wh, "code", None) or "").strip()
        if not wh_name:
            raise BusinessLogicError(f"仓库名称未配置: {wh.id}")

        receipt_data = PurchaseReceiptCreate(
            purchase_order_id=int(order.id),
            purchase_order_code=str(order.order_code or ""),
            supplier_id=int(order.supplier_id),
            supplier_name=str(order.supplier_name or ""),
            warehouse_id=int(wh.id),
            warehouse_name=wh_name,
            status="草稿",
            review_status="待审核",
            notes=f"由采购订单 {order.order_code} 下推生成（草稿）",
            items=receipt_items,
        )

        created = await receipt_service.create_purchase_receipt(
            tenant_id=tenant_id,
            receipt_data=receipt_data,
            created_by=created_by,
        )
        return {"id": created.id, "receipt_code": created.receipt_code}

    # === 采购员赋能增强方法 ===

    async def get_material_price_history(self, tenant_id: int, material_id: int) -> MaterialPriceHistoryResponse:
        """获取物料历史成交价"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES

        # 获取该物料最近 10 次已审核订单的成交记录
        items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            order__status__in=LEGACY_AUDITED_VALUES
        ).select_related("order").order_by("-order__order_date").limit(10).all()

        history_items = []
        prices = []
        for item in items:
            history_items.append(MaterialPriceHistoryItem(
                order_id=item.order_id,
                order_code=item.order.order_code,
                order_date=item.order.order_date,
                supplier_id=item.order.supplier_id,
                supplier_name=item.order.supplier_name,
                unit_price=item.unit_price,
                # currency=item.order.currency
            ))
            prices.append(item.unit_price)

        if not prices:
            return MaterialPriceHistoryResponse(
                material_id=material_id,
                history_items=[],
                average_price=0,
                min_price=0,
                max_price=0
            )

        return MaterialPriceHistoryResponse(
            material_id=material_id,
            history_items=history_items,
            average_price=sum(prices) / len(prices),
            min_price=min(prices),
            max_price=max(prices)
        )

    async def get_purchase_order_changes(self, tenant_id: int, order_id: int):
        """获取采购订单的详细变更审计记录"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderChange
        return await PurchaseOrderChange.filter(tenant_id=tenant_id, order_id=order_id).order_by("-created_at")

    async def get_purchase_order_tracking(self, tenant_id: int, order_id: int) -> PurchaseTrackingResponse:
        """获取采购订单全链路追踪"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.constants import DocumentStatus

        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"订单不存在: {order_id}")

        nodes = []
        # 1. 订单下达
        nodes.append(PurchaseTrackingNode(
            node_name="订单下达",
            status="已完成",
            time=order.created_at,
            detail=f"单号: {order.order_code}",
            is_completed=True
        ))

        # 2. 订单审核
        is_audited = order.status in ["AUDITED", "已审核", "CONFIRMED", "已确认", "audited", "已通过"]
        nodes.append(PurchaseTrackingNode(
            node_name="订单审核",
            status=order.review_status or "待审核",
            time=order.review_time,
            operator=order.reviewer_name,
            is_completed=is_audited,
            is_warning=order.review_status == "已驳回"
        ))

        # 3. 供应商确认
        is_confirmed = order.status in ["CONFIRMED", "已确认"]
        nodes.append(PurchaseTrackingNode(
            node_name="供应商确认",
            status="已确认" if is_confirmed else "待确认",
            is_completed=is_confirmed
        ))

        # 4. 质检进度 (查询关联的来料检验单)
        inspections = await IncomingInspection.filter(
            tenant_id=tenant_id,
            purchase_receipt_id__in=await PurchaseReceipt.filter(purchase_order_id=order_id).values_list("id", flat=True)
        ).all()
        
        inspection_status = "待检验"
        inspection_completed = False
        inspection_warning = False
        if inspections:
            inspection_completed = all(i.status == "已完成" for i in inspections)
            any_fail = any(i.quality_status == "不合格" for i in inspections)
            inspection_status = "质检完成" if inspection_completed else "质检中"
            if any_fail:
                inspection_status += " (含有不合格)"
                inspection_warning = True
        
        nodes.append(PurchaseTrackingNode(
            node_name="来料质检",
            status=inspection_status,
            is_completed=inspection_completed,
            is_warning=inspection_warning,
            detail=f"共 {len(inspections)} 笔检单" if inspections else "暂无质检记录"
        ))

        # 5. 入库进度
        receipts = await PurchaseReceipt.filter(tenant_id=tenant_id, purchase_order_id=order_id).all()
        total_received = sum(r.total_quantity for r in receipts)
        is_receipt_completed = total_received >= order.total_quantity and order.total_quantity > 0
        
        nodes.append(PurchaseTrackingNode(
            node_name="仓库入库",
            status=f"已入库 {total_received}/{order.total_quantity}",
            is_completed=is_receipt_completed,
            detail=f"共 {len(receipts)} 笔入库单" if receipts else "待入库"
        ))

        # 计算进度
        completed_count = sum(1 for n in nodes if n.is_completed)
        progress = int((completed_count / len(nodes)) * 100)

        return PurchaseTrackingResponse(
            order_id=order_id,
            order_code=order.order_code,
            overall_progress=progress,
            nodes=nodes
        )

    async def get_price_comparison(self, tenant_id: int, material_ids: List[int]) -> PriceComparisonResponse:
        """
        获取物料的多供应商价格对比（比价助手）

        从历史成交记录中提取不同供应商的最近成交价。
        """
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES
        
        results = []
        for mid in material_ids:
            material = await Material.get_or_none(tenant_id=tenant_id, id=mid)
            if not material:
                continue
            
            # 查询该物料最近的成交记录
            items = await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                material_id=mid,
                order__status__in=LEGACY_AUDITED_VALUES
            ).select_related("order").order_by("-order__order_date").limit(50).all()
            
            # 按供应商去重，保留各供应商最近的一笔
            supplier_latest = {} # supplier_id -> item
            for item in items:
                sid = item.order.supplier_id
                if sid not in supplier_latest:
                    supplier_latest[sid] = item
                if len(supplier_latest) >= 5: # 最多对比5家
                    break
            
            comparisons = []
            for sid, item in supplier_latest.items():
                delivery_lead_days = 0
                try:
                    rec = (
                        await PurchaseReceipt.filter(
                            tenant_id=tenant_id, purchase_order_id=item.order.id
                        )
                        .order_by("receipt_time")
                        .first()
                    )
                    if rec and rec.receipt_time and item.order.order_date:
                        delivery_lead_days = max(
                            0,
                            (rec.receipt_time.date() - item.order.order_date).days,
                        )
                except Exception:
                    pass

                comparisons.append(
                    PriceComparisonItem(
                        supplier_id=sid,
                        supplier_name=item.order.supplier_name,
                        last_price=item.unit_price,
                        last_order_date=item.order.order_date,
                        delivery_lead_time=max(0, delivery_lead_days),
                    )
                )

            # 按价格升序排列（便宜优先）
            comparisons.sort(key=lambda x: x.last_price)

            results.append(
                MaterialPriceComparison(
                    material_id=mid,
                    material_name=material.name,
                    material_code=material.main_code or material.code or None,
                    comparison=comparisons,
                )
            )

        return PriceComparisonResponse(results=results)

    async def push_to_receipt_notice(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        notice_quantities: Optional[Dict[int, float]] = None,
        selected_item_ids: Optional[List[int]] = None,
        line_warehouses: Optional[Dict[int, int]] = None,
    ) -> Dict[str, Any]:
        """
        下推到收货通知

        从采购单下推，自动生成收货通知单（通知仓库收货，不直接动库存）。

        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID
            notice_quantities: 通知数量字典 {item_id: quantity}
            selected_item_ids: 所选采购订单明细 ID（分批下推）
            line_warehouses: 行级仓库 {purchase_order_item_id: warehouse_id}

        Returns:
            Dict: 包含创建的收货通知单信息
        """
        from apps.kuaizhizao.services.receipt_notice_service import ReceiptNoticeService
        from apps.kuaizhizao.schemas.receipt_notice import ReceiptNoticeCreate, ReceiptNoticeItemCreate
        from apps.kuaizhizao.services.warehouse_service import (
            _resolve_warehouse_name_by_id,
            noticed_qty_by_po_item_ids,
            sync_purchase_order_receipt_quantities,
        )
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )
        from decimal import Decimal

        order_model = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order_model:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        await sync_purchase_order_receipt_quantities(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        noticed_by_item_raw = await noticed_qty_by_po_item_ids(tenant_id, [order_id])
        noticed_by_item = {int(k): float(v) for k, v in noticed_by_item_raw.items()}

        def _max_notice_qty(po_item: PurchaseOrderItem) -> float:
            outstanding_qty = float(effective_po_item_outstanding(po_item))
            ordered_qty = float(po_item.ordered_quantity or 0)
            noticed_qty = noticed_by_item.get(int(po_item.id), 0.0)
            return min(outstanding_qty, max(0.0, ordered_qty - noticed_qty))

        has_outstanding = any(float(effective_po_item_outstanding(item)) > 0 for item in order_items)
        has_pushable_notice = any(_max_notice_qty(item) > 0 for item in order_items)
        assert_purchase_order_capability(
            order_model,
            "push_receipt_notice",
            has_items=bool(order_items),
            has_outstanding=has_outstanding,
            has_pushable_notice_outstanding=has_pushable_notice,
        )

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成收货通知单")

        if selected_item_ids is not None:
            selected = {int(v) for v in selected_item_ids if v is not None}
            order_items = [it for it in order_items if int(getattr(it, "id", 0)) in selected]
            if not order_items:
                raise BusinessLogicError("所选明细为空，无法下推收货通知单")

        material_fallback = await self._load_material_fallback_for_po_items(tenant_id, order_items)

        def _resolve_notice_qty(po_item: PurchaseOrderItem) -> float:
            base = _max_notice_qty(po_item)
            if not notice_quantities or not isinstance(notice_quantities, dict):
                return base
            raw = notice_quantities.get(po_item.id)
            if raw is None:
                raw = notice_quantities.get(str(po_item.id))
            if raw is None:
                if selected_item_ids is not None:
                    return 0.0
                return base
            try:
                return float(raw)
            except (TypeError, ValueError):
                return base

        header_wh_id: Optional[int] = None
        header_wh_name: Optional[str] = None
        items = []
        for item in order_items:
            qty = _resolve_notice_qty(item)
            if qty <= 0:
                continue
            max_notice_qty = _max_notice_qty(item)
            if qty > max_notice_qty:
                raise ValidationError(
                    f"物料 {item.material_code} 的通知数量 {qty} 超过可通知数量 {max_notice_qty}"
                )
            if not item.material_id:
                raise ValidationError("采购订单存在缺失物料ID的明细，无法下推收货通知")
            try:
                unit_price = float(item.unit_price or 0)
            except (TypeError, ValueError):
                raise ValidationError(f"物料 {item.material_code or item.material_name or item.id} 的单价无效，无法下推收货通知")

            item_id = int(item.id)
            line_wh_id: Optional[int] = None
            line_wh_name: Optional[str] = None
            if line_warehouses and item_id in line_warehouses:
                line_wh_id = int(line_warehouses[item_id])
            if (line_wh_id is None or line_wh_id <= 0) and item.material_id:
                material_wh = await resolve_primary_default_warehouse_from_material(
                    tenant_id,
                    material_id=int(item.material_id),
                )
                if material_wh:
                    line_wh_id, line_wh_name = material_wh
            if line_wh_id is None or line_wh_id <= 0:
                material_code, material_name = self._resolve_po_item_material_display(item, material_fallback)
                raise ValidationError(
                    f"请为物料 {material_code or material_name or item_id} 选择入库仓库"
                )
            if not line_wh_name:
                line_wh_name = await _resolve_warehouse_name_by_id(tenant_id, line_wh_id)
            if header_wh_id is None:
                header_wh_id = line_wh_id
                header_wh_name = line_wh_name

            material_code, material_name = self._resolve_po_item_material_display(item, material_fallback)
            items.append(ReceiptNoticeItemCreate(
                material_id=item.material_id,
                material_code=material_code,
                material_name=material_name,
                material_spec=item.material_spec or "",
                material_unit=str(item.unit or "件"),
                notice_quantity=qty,
                unit_price=unit_price,
                total_amount=qty * unit_price,
                purchase_order_item_id=item.id,
                warehouse_id=line_wh_id,
                warehouse_name=line_wh_name,
            ))

        if not items:
            raise BusinessLogicError("没有可通知的明细")

        notice_data = ReceiptNoticeCreate(
            purchase_order_id=order_id,
            purchase_order_code=order.order_code,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            supplier_contact=order.supplier_contact,
            supplier_phone=order.supplier_phone,
            warehouse_id=header_wh_id,
            warehouse_name=header_wh_name,
            planned_receipt_date=order.delivery_date,
            status="待收货",
            notes=f"从采购订单 {order.order_code} 下推",
            items=items,
        )
        notice_service = ReceiptNoticeService()
        notice = await notice_service.create_receipt_notice(tenant_id=tenant_id, notice_data=notice_data, created_by=created_by)
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "notice_id": notice.id,
            "notice_code": notice.notice_code,
            "message": "收货通知单创建成功",
        }

    async def push_to_invoice(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        下推到采购发票

        从采购单下推，自动生成采购发票（草稿，待补全发票号码等）。

        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID

        Returns:
            Dict: 包含创建的采购发票信息
        """
        from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
        from apps.kuaicaiwu.schemas.finance import PurchaseInvoiceCreate

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice

        has_invoice = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id,
            deleted_at__isnull=True,
        ).exists()
        assert_purchase_order_capability(
            order,
            "push_invoice",
            has_items=bool(order_items),
            has_invoice=has_invoice,
        )

        today = today_site_str()
        invoice_code = await self.generate_code(tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today}")

        total_amount = float(order.total_amount or 0)
        tax_rate = float(order.tax_rate or 0)
        tax_amount = total_amount * tax_rate if tax_rate else 0
        invoice_amount = total_amount
        total_with_tax = total_amount + tax_amount

        invoice_data = PurchaseInvoiceCreate(
            invoice_code=invoice_code,
            purchase_order_id=order_id,
            purchase_order_code=order.order_code,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            invoice_number="待补全",
            invoice_date=to_site_date(resolve_business_datetime()),
            invoice_type="增值税专用发票",
            tax_rate=tax_rate,
            invoice_amount=invoice_amount,
            tax_amount=tax_amount,
            total_amount=total_with_tax,
            status="未审核",
            review_status="待审核",
            notes=f"从采购订单 {order.order_code} 下推",
        )
        invoice_service = PurchaseInvoiceService()
        invoice = await invoice_service.create_purchase_invoice(tenant_id=tenant_id, invoice_data=invoice_data, created_by=created_by)
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "invoice_id": invoice.id,
            "invoice_code": invoice.invoice_code,
            "message": "采购发票创建成功",
        }
