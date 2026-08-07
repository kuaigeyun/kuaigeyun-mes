"""快制造货运单服务"""

from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.logistics import (
    Driver,
    FreightOrder,
    FreightOrderReceipt,
    FreightOrderSource,
    FreightTrackingEvent,
    LogisticsCarrier,
    Vehicle,
)
from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.schemas.logistics import (
    FreightOrderCreate,
    FreightOrderReceiptCreate,
    FreightOrderUpdate,
    FreightPullCandidate,
    FreightTrackingEventCreate,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


FREIGHT_STATUS_FLOW = {
    "draft": {"scheduled", "cancelled"},
    "scheduled": {"shipped", "cancelled"},
    "shipped": {"in_transit", "cancelled"},
    "in_transit": {"arrived", "cancelled"},
    "arrived": {"signed", "cancelled"},
    "signed": set(),
    "cancelled": set(),
}


class FreightOrderService(AppBaseService):
    def __init__(self):
        super().__init__(FreightOrder)

    async def _transition(self, order: FreightOrder, target: str) -> None:
        allowed = FREIGHT_STATUS_FLOW.get(order.status or "draft", set())
        if target not in allowed:
            raise BusinessLogicError(f"当前状态 {order.status} 不能变更为 {target}")
        order.status = target
        await order.save()

    async def _resolve_transport_refs(
        self,
        tenant_id: int,
        *,
        carrier_id: Optional[int],
        vehicle_id: Optional[int],
        driver_id: Optional[int],
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        if carrier_id:
            carrier = await LogisticsCarrier.get_or_none(id=carrier_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if not carrier:
                raise NotFoundError("承运商不存在")
            payload["carrier_id"] = carrier.id
            payload["carrier_name"] = carrier.name
        if vehicle_id:
            vehicle = await Vehicle.get_or_none(id=vehicle_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if not vehicle:
                raise NotFoundError("车辆不存在")
            payload["vehicle_id"] = vehicle.id
            payload["vehicle_plate"] = vehicle.plate_number
        if driver_id:
            driver = await Driver.get_or_none(id=driver_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if not driver:
                raise NotFoundError("驾驶员不存在")
            payload["driver_id"] = driver.id
            payload["driver_name"] = driver.name
            payload["driver_phone"] = driver.phone
        return payload

    async def list_pull_candidates(
        self,
        tenant_id: int,
        *,
        business_direction: Optional[str] = None,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        items: List[FreightPullCandidate] = []

        if business_direction in (None, "sales_outbound"):
            q = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if keyword:
                kw = keyword.strip()
                if kw:
                    q = q.filter(
                        Q(delivery_code__icontains=kw)
                        | Q(customer_name__icontains=kw)
                        | Q(tracking_number__icontains=kw)
                    )
            for row in await q.offset(skip).limit(limit).order_by("-created_at"):
                items.append(
                    FreightPullCandidate(
                        source_type="sales_delivery",
                        source_id=int(row.id),
                        source_code=str(row.delivery_code or ""),
                        partner_name=str(row.customer_name or ""),
                        business_direction="sales_outbound",
                        address=row.shipping_address if hasattr(row, "shipping_address") else None,
                        tracking_number=getattr(row, "tracking_number", None),
                    )
                )
            dn_q = DeliveryNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if keyword:
                kw = keyword.strip()
                if kw:
                    dn_q = dn_q.filter(
                        Q(notice_code__icontains=kw)
                        | Q(customer_name__icontains=kw)
                        | Q(tracking_number__icontains=kw)
                    )
            for row in await dn_q.offset(0).limit(limit).order_by("-created_at"):
                items.append(
                    FreightPullCandidate(
                        source_type="delivery_notice",
                        source_id=int(row.id),
                        source_code=str(row.notice_code or ""),
                        partner_name=str(row.customer_name or ""),
                        business_direction="sales_outbound",
                        address=row.shipping_address,
                        tracking_number=row.tracking_number,
                    )
                )

        if business_direction in (None, "purchase_inbound"):
            rn_q = ReceiptNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if keyword:
                kw = keyword.strip()
                if kw:
                    rn_q = rn_q.filter(
                        Q(notice_code__icontains=kw)
                        | Q(supplier_name__icontains=kw)
                    )
            for row in await rn_q.offset(0).limit(limit).order_by("-created_at"):
                items.append(
                    FreightPullCandidate(
                        source_type="receipt_notice",
                        source_id=int(row.id),
                        source_code=str(row.notice_code or ""),
                        partner_name=str(row.supplier_name or ""),
                        business_direction="purchase_inbound",
                        address=row.warehouse_name,
                    )
                )

        return {"items": items[skip : skip + limit], "total": len(items)}

    async def _build_order_response(self, order: FreightOrder) -> Dict[str, Any]:
        sources = await FreightOrderSource.filter(tenant_id=order.tenant_id, freight_order_id=order.id)
        events = await FreightTrackingEvent.filter(
            tenant_id=order.tenant_id,
            freight_order_id=order.id,
        ).order_by("event_time")
        receipt = await FreightOrderReceipt.get_or_none(tenant_id=order.tenant_id, freight_order_id=order.id)
        data = {field: getattr(order, field) for field in order._meta.fields_map.keys()}
        data["sources"] = sources
        data["tracking_events"] = events
        data["receipt"] = receipt
        return data

    async def list_orders(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        business_direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = FreightOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if business_direction:
            query = query.filter(business_direction=business_direction)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(order_code__icontains=kw)
                    | Q(tracking_number__icontains=kw)
                    | Q(carrier_name__icontains=kw)
                    | Q(driver_name__icontains=kw)
                )
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        items = [await self._build_order_response(row) for row in rows]
        return {"items": items, "total": total}

    async def get_order(self, tenant_id: int, order_id: int) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        return await self._build_order_response(order)

    async def create_order(
        self,
        tenant_id: int,
        data: FreightOrderCreate,
        *,
        created_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not data.sources:
            raise BusinessLogicError("请至少关联一条来源单据")
        refs = await self._resolve_transport_refs(
            tenant_id,
            carrier_id=data.carrier_id,
            vehicle_id=data.vehicle_id,
            driver_id=data.driver_id,
        )
        order_code = await self.generate_code(tenant_id, "FREIGHT_ORDER_CODE", prefix=f"FR{today_site_str()}")
        async with in_transaction():
            order = await FreightOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                business_direction=data.business_direction,
                transport_mode=data.transport_mode,
                tracking_number=data.tracking_number,
                origin_address=data.origin_address,
                destination_address=data.destination_address,
                planned_depart_at=data.planned_depart_at,
                planned_arrive_at=data.planned_arrive_at,
                remark=data.remark,
                status="draft",
                created_by=created_by,
                **refs,
            )
            for src in data.sources:
                await FreightOrderSource.create(
                    tenant_id=tenant_id,
                    freight_order_id=order.id,
                    **src.model_dump(),
                )
        return await self.get_order(tenant_id, int(order.id))

    async def update_order(self, tenant_id: int, order_id: int, data: FreightOrderUpdate, *, updated_by: Optional[int] = None) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        if order.status not in {"draft", "scheduled"}:
            raise BusinessLogicError("仅草稿或已调度状态可编辑")
        refs = await self._resolve_transport_refs(
            tenant_id,
            carrier_id=data.carrier_id if data.carrier_id is not None else order.carrier_id,
            vehicle_id=data.vehicle_id if data.vehicle_id is not None else order.vehicle_id,
            driver_id=data.driver_id if data.driver_id is not None else order.driver_id,
        )
        payload = data.model_dump(exclude_none=True)
        payload.update(refs)
        payload["updated_by"] = updated_by
        await order.update_from_dict(payload)
        await order.save()
        return await self.get_order(tenant_id, order_id)

    async def delete_order(self, tenant_id: int, order_id: int) -> None:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        if order.status not in {"draft", "cancelled"}:
            raise BusinessLogicError("仅草稿或已取消状态可删除")
        order.deleted_at = resolve_business_datetime()
        await order.save()

    async def dispatch_order(self, tenant_id: int, order_id: int, *, operator_id: Optional[int] = None) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        await self._transition(order, "scheduled")
        return await self.get_order(tenant_id, order_id)

    async def ship_order(self, tenant_id: int, order_id: int, *, operator_id: Optional[int] = None, operator_name: Optional[str] = None) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        now = resolve_business_datetime()
        await self._transition(order, "shipped")
        order.actual_depart_at = now
        await order.save()
        await FreightTrackingEvent.create(
            tenant_id=tenant_id,
            freight_order_id=order.id,
            event_type="depart",
            event_time=now,
            operator_id=operator_id,
            operator_name=operator_name,
        )
        return await self.get_order(tenant_id, order_id)

    async def mark_in_transit(self, tenant_id: int, order_id: int, *, operator_id: Optional[int] = None, operator_name: Optional[str] = None) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        now = resolve_business_datetime()
        await self._transition(order, "in_transit")
        await FreightTrackingEvent.create(
            tenant_id=tenant_id,
            freight_order_id=order.id,
            event_type="in_transit",
            event_time=now,
            operator_id=operator_id,
            operator_name=operator_name,
        )
        return await self.get_order(tenant_id, order_id)

    async def arrive_order(self, tenant_id: int, order_id: int, *, operator_id: Optional[int] = None, operator_name: Optional[str] = None) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        now = resolve_business_datetime()
        await self._transition(order, "arrived")
        order.actual_arrive_at = now
        await order.save()
        await FreightTrackingEvent.create(
            tenant_id=tenant_id,
            freight_order_id=order.id,
            event_type="arrived",
            event_time=now,
            operator_id=operator_id,
            operator_name=operator_name,
        )
        return await self.get_order(tenant_id, order_id)

    async def sign_receipt(
        self,
        tenant_id: int,
        order_id: int,
        data: FreightOrderReceiptCreate,
        *,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        if order.status != "arrived":
            raise BusinessLogicError("请先标记到达后再签收")
        signed_at = data.signed_at or resolve_business_datetime()
        async with in_transaction():
            await FreightOrderReceipt.filter(tenant_id=tenant_id, freight_order_id=order.id).delete()
            await FreightOrderReceipt.create(
                tenant_id=tenant_id,
                freight_order_id=order.id,
                signed_by=data.signed_by,
                signed_at=signed_at,
                receipt_result=data.receipt_result,
                remark=data.remark,
                attachments=data.attachments,
            )
            await self._transition(order, "signed")
            await FreightTrackingEvent.create(
                tenant_id=tenant_id,
                freight_order_id=order.id,
                event_type="signed",
                event_time=signed_at,
                operator_id=operator_id,
                operator_name=operator_name,
                remark=data.remark,
            )
        return await self.get_order(tenant_id, order_id)

    async def add_tracking_event(
        self,
        tenant_id: int,
        order_id: int,
        data: FreightTrackingEventCreate,
        *,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        await FreightTrackingEvent.create(
            tenant_id=tenant_id,
            freight_order_id=order.id,
            event_type=data.event_type,
            event_time=data.event_time or resolve_business_datetime(),
            location=data.location,
            remark=data.remark,
            operator_id=operator_id,
            operator_name=operator_name,
        )
        return await self.get_order(tenant_id, order_id)

    async def cancel_order(self, tenant_id: int, order_id: int) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        if order.status == "signed":
            raise BusinessLogicError("已签收货运单不可取消")
        await self._transition(order, "cancelled")
        return await self.get_order(tenant_id, order_id)
