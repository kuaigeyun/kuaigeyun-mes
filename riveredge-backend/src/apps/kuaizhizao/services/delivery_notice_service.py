"""
送货单服务模块

在销售出库前/后向客户发送发货通知，记录物流信息。不直接动库存。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.schemas.delivery_notice import (
    DeliveryNoticeCreate,
    DeliveryNoticeUpdate,
    DeliveryNoticeResponse,
    DeliveryNoticeListResponse,
    DeliveryNoticeWithItemsResponse,
    DeliveryNoticeItemCreate,
    DeliveryNoticeItemResponse,
    DeliveryNoticePullCandidate,
    DeliveryNoticePullPreviewLine,
    DeliveryNoticePullPreviewResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date


class DeliveryNoticeService(AppBaseService[DeliveryNotice]):
    """送货单服务"""

    def __init__(self):
        super().__init__(DeliveryNotice)
        self.business_config_service = BusinessConfigService()

    async def batch_sales_deliveries_have_notice(
        self,
        tenant_id: int,
        sales_delivery_ids: List[int],
    ) -> Dict[int, bool]:
        if not sales_delivery_ids:
            return {}
        rows = await DeliveryNotice.filter(
            tenant_id=tenant_id,
            sales_delivery_id__in=sales_delivery_ids,
            deleted_at__isnull=True,
        ).values_list("sales_delivery_id", flat=True)
        linked = {int(row) for row in rows if row is not None}
        return {int(delivery_id): int(delivery_id) in linked for delivery_id in sales_delivery_ids}

    async def batch_sales_deliveries_have_noticeable_lines(
        self,
        tenant_id: int,
        sales_delivery_ids: List[int],
    ) -> Dict[int, bool]:
        if not sales_delivery_ids:
            return {}
        rows = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=sales_delivery_ids,
            delivery_quantity__gt=0,
        ).values_list("delivery_id", flat=True)
        with_lines = {int(row) for row in rows if row is not None}
        return {int(delivery_id): int(delivery_id) in with_lines for delivery_id in sales_delivery_ids}

    async def noticed_qty_by_sales_delivery_item_ids(
        self,
        tenant_id: int,
        item_ids: List[int],
    ) -> Dict[int, float]:
        """已通知量按销售出库明细归属，不能按送货单头表出库单号。"""
        selected = [int(v) for v in item_ids if v is not None]
        if not selected:
            return {}
        notice_items = await DeliveryNoticeItem.filter(
            tenant_id=tenant_id,
            delivery_item_id__in=selected,
        ).all()
        notice_ids = {int(row.notice_id) for row in notice_items if row.notice_id is not None}
        if not notice_ids:
            return {}
        active_ids = {
            int(row)
            for row in await DeliveryNotice.filter(
                tenant_id=tenant_id,
                id__in=list(notice_ids),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        }
        noticed: Dict[int, float] = {}
        for row in notice_items:
            if int(row.notice_id) not in active_ids:
                continue
            item_id = int(row.delivery_item_id or 0)
            if item_id <= 0:
                continue
            noticed[item_id] = noticed.get(item_id, 0.0) + float(row.notice_quantity or 0)
        return noticed

    async def list_delivery_notice_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        sales_delivery_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        """开口销售出库行：可转送货单的剩余明细。"""
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            _CANCELLED,
        )

        delivery_query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if sales_delivery_id is not None:
            delivery_query = delivery_query.filter(id=int(sales_delivery_id))
        deliveries = await delivery_query.only(
            "id",
            "delivery_code",
            "status",
            "customer_id",
            "customer_name",
            "delivery_date",
        )
        delivery_by_id = {int(row.id): row for row in deliveries}
        if not delivery_by_id:
            return {"data": [], "total": 0}

        items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=list(delivery_by_id.keys()),
        ).all()
        noticed_by_item = await self.noticed_qty_by_sales_delivery_item_ids(
            tenant_id,
            [int(row.id) for row in items if row.id is not None],
        )
        kw = (keyword or "").strip().lower()
        lines: List[Dict[str, Any]] = []
        for item in items:
            delivery = delivery_by_id.get(int(item.delivery_id))
            if not delivery:
                continue
            qty = float(item.delivery_quantity or 0)
            if qty <= 0:
                continue
            pushed = noticed_by_item.get(int(item.id), 0.0)
            remaining = max(0.0, qty - pushed)
            status = str(delivery.status or "").strip()
            selectable = (
                status not in _CANCELLED
                and bool(delivery.customer_id)
                and remaining > 0
            )
            if pullable_only and not selectable:
                continue
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            material_spec = str(item.material_spec or "").strip()
            if kw:
                haystack = " ".join([material_code, material_name, material_spec]).lower()
                if kw not in haystack:
                    continue
            lines.append(
                {
                    "id": int(item.id),
                    "sales_delivery_id": int(item.delivery_id),
                    "delivery_code": delivery.delivery_code,
                    "customer_id": delivery.customer_id,
                    "customer_name": delivery.customer_name,
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": material_spec or None,
                    "unit": item.material_unit or "个",
                    "suggested_quantity": qty,
                    "pushed_quantity": pushed,
                    "remaining_quantity": remaining,
                    "required_date": str(delivery.delivery_date) if delivery.delivery_date else None,
                }
            )
        lines.sort(
            key=lambda row: (
                str(row.get("delivery_code") or ""),
                str(row.get("material_code") or ""),
                int(row.get("id") or 0),
            )
        )
        return {"data": lines[skip : skip + limit], "total": len(lines)}

    async def create_delivery_notices_from_sales_delivery_items(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        """按销售出库行 id 建送货单，可跨多张出库单；同客户合并一张。"""
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            _CANCELLED,
        )

        selected_ids = [int(v) for v in item_ids if v is not None]
        if not selected_ids:
            raise BusinessLogicError("请至少选择一条可通知销售出库明细")
        items = await SalesDeliveryItem.filter(tenant_id=tenant_id, id__in=selected_ids).all()
        if not items:
            raise BusinessLogicError("没有可通知的销售出库行")
        delivery_ids = sorted({int(row.delivery_id) for row in items})
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            id__in=delivery_ids,
            deleted_at__isnull=True,
        ).all()
        delivery_by_id = {int(row.id): row for row in deliveries}
        if len(delivery_by_id) != len(delivery_ids):
            raise NotFoundError("销售出库单不存在")
        noticed_by_item = await self.noticed_qty_by_sales_delivery_item_ids(tenant_id, selected_ids)

        def _max_notice_qty(delivery_item: SalesDeliveryItem) -> float:
            qty = float(delivery_item.delivery_quantity or 0)
            pushed = noticed_by_item.get(int(delivery_item.id), 0.0)
            return max(0.0, qty - pushed)

        for delivery in deliveries:
            status = str(delivery.status or "").strip()
            if status in _CANCELLED:
                raise BusinessLogicError("销售出库单已取消，不可下推送货单")
            if not delivery.customer_id:
                raise BusinessLogicError("销售出库单缺少客户，不可下推送货单")

        groups: Dict[int, List[SalesDeliveryItem]] = {}
        for item in items:
            groups.setdefault(int(delivery_by_id[int(item.delivery_id)].customer_id or 0), []).append(item)

        notices_out: List[Dict[str, Any]] = []
        for customer_id, group_items in groups.items():
            if customer_id <= 0:
                raise BusinessLogicError("销售出库单缺少客户，不可下推送货单")
            notice_items: List[DeliveryNoticeItemCreate] = []
            remaining_items: List[SalesDeliveryItem] = []
            for item in group_items:
                qty = _max_notice_qty(item)
                if qty <= 0:
                    continue
                if not item.material_id:
                    raise ValidationError("销售出库单存在缺失物料ID的明细，无法下推送货单")
                remaining_items.append(item)
                notice_items.append(
                    DeliveryNoticeItemCreate(
                        material_id=int(item.material_id),
                        material_code=str(item.material_code or ""),
                        material_name=str(item.material_name or ""),
                        material_spec=item.material_spec or "",
                        material_unit=str(item.material_unit or "个"),
                        notice_quantity=qty,
                        unit_price=float(item.unit_price or 0),
                        delivery_item_id=int(item.id),
                    )
                )
            if not notice_items:
                raise BusinessLogicError("所选明细已全部通知，无法创建送货单")
            primary = delivery_by_id[int(remaining_items[0].delivery_id)]
            planned = getattr(primary, "delivery_date", None) or to_site_date(resolve_business_datetime())
            created = await self.create_delivery_notice(
                tenant_id,
                DeliveryNoticeCreate(
                    sales_delivery_id=int(primary.id),
                    sales_delivery_code=str(primary.delivery_code or ""),
                    sales_order_id=primary.sales_order_id,
                    sales_order_code=primary.sales_order_code,
                    customer_id=int(primary.customer_id),
                    customer_name=str(primary.customer_name or ""),
                    customer_contact=getattr(primary, "customer_contact", None),
                    customer_phone=getattr(primary, "customer_phone", None),
                    planned_delivery_date=planned,
                    shipping_address=getattr(primary, "shipping_address", None),
                    items=notice_items,
                ),
                created_by,
            )
            notices_out.append(
                {
                    "notice_id": created.id,
                    "notice_code": created.notice_code,
                }
            )
        return {
            "success": True,
            "message": f"已创建 {len(notices_out)} 张送货单",
            "notice_id": notices_out[0]["notice_id"] if len(notices_out) == 1 else None,
            "notice_code": notices_out[0]["notice_code"] if len(notices_out) == 1 else None,
            "notices": notices_out,
        }

    async def list_delivery_notice_pull_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            derive_sales_delivery_pull_capabilities,
        )

        query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(delivery_code__icontains=kw)
                    | Q(sales_order_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                )
        total = await query.count()
        deliveries = await query.offset(skip).limit(limit).order_by("-created_at")
        delivery_ids = [int(d.id) for d in deliveries if d.id is not None]
        notice_by_id = await self.batch_sales_deliveries_have_notice(tenant_id, delivery_ids)
        lines_by_id = await self.batch_sales_deliveries_have_noticeable_lines(tenant_id, delivery_ids)

        candidates: List[DeliveryNoticePullCandidate] = []
        for delivery in deliveries:
            delivery_id = int(delivery.id)
            has_notice = notice_by_id.get(delivery_id, False)
            has_lines = lines_by_id.get(delivery_id, False)
            caps = derive_sales_delivery_pull_capabilities(
                delivery,
                has_delivery_notice=has_notice,
                has_noticeable_lines=has_lines,
            )
            pullable = bool(caps.push_delivery_notice.allowed)
            candidates.append(
                DeliveryNoticePullCandidate(
                    id=delivery_id,
                    delivery_code=str(delivery.delivery_code or ""),
                    sales_order_id=delivery.sales_order_id,
                    sales_order_code=delivery.sales_order_code,
                    customer_id=int(delivery.customer_id),
                    customer_name=str(delivery.customer_name or ""),
                    status=str(delivery.status or ""),
                    delivery_date=getattr(delivery, "delivery_date", None),
                    updated_at=delivery.updated_at,
                    pullable=pullable,
                    capabilities=caps,
                )
            )
        return {
            "data": [item.model_dump() for item in candidates],
            "total": total,
            "success": True,
        }

    async def get_delivery_notice_pull_preview(
        self,
        tenant_id: int,
        sales_delivery_id: int,
    ) -> DeliveryNoticePullPreviewResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            assert_sales_delivery_pull_capability,
        )

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id,
            id=sales_delivery_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {sales_delivery_id}")

        has_notice = bool(
            await DeliveryNotice.filter(
                tenant_id=tenant_id,
                sales_delivery_id=sales_delivery_id,
                deleted_at__isnull=True,
            ).exists()
        )
        items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id=sales_delivery_id,
            delivery_quantity__gt=0,
        ).all()
        has_lines = len(items) > 0
        assert_sales_delivery_pull_capability(
            delivery,
            "push_delivery_notice",
            has_delivery_notice=has_notice,
            has_noticeable_lines=has_lines,
        )

        preview_lines: List[DeliveryNoticePullPreviewLine] = []
        for item in items:
            qty = float(item.delivery_quantity or 0)
            if qty <= 0:
                continue
            preview_lines.append(
                DeliveryNoticePullPreviewLine(
                    item_id=int(item.id),
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    material_unit=str(item.material_unit or "个"),
                    quantity=qty,
                    pushed_quantity=0.0,
                    max_push_quantity=qty,
                    unit_price=float(item.unit_price or 0),
                )
            )

        message = None
        if not preview_lines:
            message = "sales_delivery.push_delivery_notice.no_lines"

        return DeliveryNoticePullPreviewResponse(
            sales_delivery_id=sales_delivery_id,
            sales_delivery_code=str(delivery.delivery_code or sales_delivery_id),
            customer_id=int(delivery.customer_id),
            customer_name=str(delivery.customer_name or ""),
            customer_contact=getattr(delivery, "customer_contact", None),
            customer_phone=getattr(delivery, "customer_phone", None),
            sales_order_id=delivery.sales_order_id,
            sales_order_code=delivery.sales_order_code,
            planned_delivery_date=getattr(delivery, "delivery_date", None),
            shipping_address=getattr(delivery, "shipping_address", None),
            items=preview_lines,
            message=message,
        )

    async def create_delivery_notice(
        self,
        tenant_id: int,
        notice_data: DeliveryNoticeCreate,
        created_by: int
    ) -> DeliveryNoticeResponse:
        """创建送货单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "delivery_notice")
        if not is_enabled:
            raise BusinessLogicError("送货单节点未启用，无法创建送货单")
        if notice_data.sales_delivery_id:
            source_delivery = await SalesDelivery.get_or_none(
                tenant_id=tenant_id,
                id=notice_data.sales_delivery_id,
                deleted_at__isnull=True,
            )
            if not source_delivery:
                raise BusinessLogicError("销售出库单不存在或已删除，无法创建送货单")
            source_items = await SalesDeliveryItem.filter(
                tenant_id=tenant_id,
                delivery_id=notice_data.sales_delivery_id,
                delivery_quantity__gt=0,
            ).all()
            noticed_by_item = await self.noticed_qty_by_sales_delivery_item_ids(
                tenant_id,
                [int(row.id) for row in source_items if row.id is not None],
            )
            has_lines = len(source_items) > 0
            has_remaining = any(
                max(0.0, float(row.delivery_quantity or 0) - noticed_by_item.get(int(row.id), 0.0)) > 0
                for row in source_items
            )
            from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
                assert_sales_delivery_pull_capability,
            )

            assert_sales_delivery_pull_capability(
                source_delivery,
                "push_delivery_notice",
                has_delivery_notice=has_lines and not has_remaining,
                has_noticeable_lines=has_remaining,
            )
        async with in_transaction():
            today = today_site_str()
            code = await self.generate_code(tenant_id, "DELIVERY_NOTICE_CODE", prefix=f"DN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            user_info = await self.get_user_info(created_by)
            notice = await DeliveryNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                **dump,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            items = getattr(notice_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.notice_quantity))
                amt = item_data.total_amount if item_data.total_amount is not None else qty * Decimal(str(item_data.unit_price or 0))
                await DeliveryNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    notice_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"notice_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await DeliveryNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await DeliveryNotice.get(tenant_id=tenant_id, id=notice.id)
            return DeliveryNoticeResponse.model_validate(notice)

    async def get_delivery_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> DeliveryNoticeWithItemsResponse:
        """根据ID获取送货单（含明细）"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")

        items = await DeliveryNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = DeliveryNoticeWithItemsResponse.model_validate(notice)
        response.items = [DeliveryNoticeItemResponse.model_validate(i) for i in items]
        from apps.kuaizhizao.services.document_lifecycle_service import get_delivery_notice_lifecycle

        response.lifecycle = get_delivery_notice_lifecycle(notice, milestones=[])
        return response

    async def list_delivery_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> tuple[List[DeliveryNoticeListResponse], int]:
        """获取送货单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import apply_delivery_notice_list_filters

        query = DeliveryNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("sales_delivery_id"):
            query = query.filter(sales_delivery_id=filters["sales_delivery_id"])
        if filters.get("sales_order_id"):
            query = query.filter(sales_order_id=filters["sales_order_id"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=filters["customer_id"])

        query, order_clause = apply_delivery_notice_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            sent_start_date=filters.get("sent_start_date"),
            sent_end_date=filters.get("sent_end_date"),
            planned_delivery_start_date=filters.get("planned_delivery_start_date"),
            planned_delivery_end_date=filters.get("planned_delivery_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        notices = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_lifecycle_service import get_delivery_notice_lifecycle

        responses = [DeliveryNoticeListResponse.model_validate(r) for r in notices]
        for notice, resp in zip(notices, responses):
            resp.lifecycle = get_delivery_notice_lifecycle(notice, milestones=[])
        return responses, total

    async def update_delivery_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: DeliveryNoticeUpdate,
        updated_by: int
    ) -> DeliveryNoticeResponse:
        """更新送货单"""
        notice = await self.get_delivery_notice_by_id(tenant_id, notice_id)
        if notice.status != "待发送":
            raise BusinessLogicError("只能更新待发送状态的送货单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
            await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return DeliveryNoticeResponse.model_validate(
                await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_delivery_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除送货单"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只能删除待发送状态的送货单")

        await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=resolve_business_datetime())
        return True

    async def send_notice(
        self,
        tenant_id: int,
        notice_id: int,
        sent_by: int
    ) -> DeliveryNoticeResponse:
        """发送通知（标记为已发送，可对接邮件/短信/打印）"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只有待发送状态的通知单才能发送")

        await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已发送",
            sent_at=resolve_business_datetime(),
            updated_by=sent_by,
            updated_by_name=(await self.get_user_info(sent_by))["name"],
        )
        return DeliveryNoticeResponse.model_validate(
            await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
        )
