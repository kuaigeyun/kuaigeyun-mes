"""快制造货运单服务"""

import re
from typing import Any, Dict, Iterable, List, Optional

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
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.schemas.logistics import (
    FreightOrderCreate,
    FreightOrderReceiptCreate,
    FreightOrderUpdate,
    FreightPullCandidate,
    FreightTrackingEventCreate,
)
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from core.services.amap_geocode_service import geocode_address
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


def extract_phone_last4(raw: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) >= 4:
        return digits[-4:]
    return None


def _clean_phone(raw: Optional[str]) -> Optional[str]:
    text = (raw or "").strip()
    return text or None


def _first_phone(*values: Optional[str]) -> Optional[str]:
    for value in values:
        cleaned = _clean_phone(value)
        if cleaned:
            return cleaned
    return None


def _first_phone_last4(*values: Optional[str]) -> Optional[str]:
    for value in values:
        last4 = extract_phone_last4(value)
        if last4:
            return last4
    return None


def _shipment_notice_links_delivery(notice: ShipmentNotice, delivery_ids: Iterable[int]) -> bool:
    wanted = {int(item) for item in delivery_ids}
    primary = getattr(notice, "sales_delivery_id", None)
    if primary is not None and int(primary) in wanted:
        return True
    related_raw = getattr(notice, "related_sales_delivery_ids", None) or []
    if not isinstance(related_raw, list):
        return False
    for entry in related_raw:
        eid = entry.get("id") if isinstance(entry, dict) else None
        if eid is not None and int(eid) in wanted:
            return True
    return False


FREIGHT_STATUS_FLOW = {
    "draft": {"scheduled", "cancelled"},
    "scheduled": {"shipped", "cancelled"},
    "shipped": {"in_transit", "cancelled"},
    "in_transit": {"arrived", "cancelled"},
    "arrived": {"signed", "cancelled"},
    "signed": set(),
    "cancelled": set(),
}


FREIGHT_SOURCE_BLOCKED_REASON = "已关联未取消的货运单"


class FreightOrderService(AppBaseService):
    def __init__(self):
        super().__init__(FreightOrder)

    async def _active_linked_source_keys(self, tenant_id: int) -> set[tuple[str, int]]:
        """来源单据 -> 未取消货运单的占用集合。"""
        sources = await FreightOrderSource.filter(tenant_id=tenant_id).all()
        if not sources:
            return set()
        order_ids = {int(s.freight_order_id) for s in sources}
        active_orders = await FreightOrder.filter(
            tenant_id=tenant_id,
            id__in=list(order_ids),
            deleted_at__isnull=True,
        ).exclude(status="cancelled")
        active_ids = {int(o.id) for o in active_orders}
        return {
            (str(s.source_type), int(s.source_id))
            for s in sources
            if int(s.freight_order_id) in active_ids
        }

    async def _assert_sources_pullable(
        self,
        tenant_id: int,
        sources: List[Any],
    ) -> None:
        linked = await self._active_linked_source_keys(tenant_id)
        for src in sources:
            key = (str(src.source_type), int(src.source_id))
            if key in linked:
                code = getattr(src, "source_code", None) or key[1]
                raise BusinessLogicError(f"来源单据 {code} {FREIGHT_SOURCE_BLOCKED_REASON}")

    async def _apply_order_address_geocode(self, order: FreightOrder) -> None:
        changed = False
        if order.origin_address:
            coords = await geocode_address(order.origin_address, tenant_id=int(order.tenant_id))
            if coords:
                order.origin_lng, order.origin_lat = coords
                changed = True
            else:
                order.origin_lng = None
                order.origin_lat = None
                changed = True
        if order.destination_address:
            coords = await geocode_address(order.destination_address, tenant_id=int(order.tenant_id))
            if coords:
                order.destination_lng, order.destination_lat = coords
                changed = True
            else:
                order.destination_lng = None
                order.destination_lat = None
                changed = True
        if changed:
            await order.save()

    async def find_order_by_source(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
    ) -> Optional[Dict[str, Any]]:
        src = await FreightOrderSource.get_or_none(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=int(source_id),
        )
        if not src:
            return None
        order = await FreightOrder.get_or_none(
            tenant_id=tenant_id,
            id=src.freight_order_id,
            deleted_at__isnull=True,
        )
        if not order or order.status == "cancelled":
            return None
        return await self._build_order_response(order, include_query_phone=True)

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
        linked = await self._active_linked_source_keys(tenant_id)

        def _candidate(**kwargs: Any) -> FreightPullCandidate:
            key = (str(kwargs["source_type"]), int(kwargs["source_id"]))
            blocked = key in linked
            return FreightPullCandidate(
                **kwargs,
                pullable=not blocked,
                blocked_reason=FREIGHT_SOURCE_BLOCKED_REASON if blocked else None,
            )

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
                    _candidate(
                        source_type="sales_delivery",
                        source_id=int(row.id),
                        source_code=str(row.delivery_code or ""),
                        partner_name=str(row.customer_name or ""),
                        business_direction="sales_outbound",
                        address=row.shipping_address if hasattr(row, "shipping_address") else None,
                        tracking_number=getattr(row, "tracking_number", None),
                        recipient_phone=None,
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
                    _candidate(
                        source_type="delivery_notice",
                        source_id=int(row.id),
                        source_code=str(row.notice_code or ""),
                        partner_name=str(row.customer_name or ""),
                        business_direction="sales_outbound",
                        address=row.shipping_address,
                        tracking_number=row.tracking_number,
                        recipient_phone=row.customer_phone,
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
                    _candidate(
                        source_type="receipt_notice",
                        source_id=int(row.id),
                        source_code=str(row.notice_code or ""),
                        partner_name=str(row.supplier_name or ""),
                        business_direction="purchase_inbound",
                        address=row.warehouse_name,
                        sender_phone=row.supplier_phone,
                    )
                )

        return {"items": items[skip : skip + limit], "total": len(items)}

    async def _resolve_source_phone(
        self,
        tenant_id: int,
        sources: List[Any],
    ) -> Optional[str]:
        """从来源发货单据取完整手机号，没有再看销售订单/客户主数据。"""
        delivery_ids: List[int] = []
        delivery_notice_ids: List[int] = []
        shipment_notice_ids: List[int] = []
        receipt_notice_ids: List[int] = []
        sales_order_ids: List[int] = []
        customer_ids: List[int] = []

        for src in sources:
            source_type = str(src.source_type)
            source_id = int(src.source_id)
            if source_type == "sales_delivery":
                delivery_ids.append(source_id)
            elif source_type == "delivery_notice":
                delivery_notice_ids.append(source_id)
            elif source_type == "shipment_notice":
                shipment_notice_ids.append(source_id)
            elif source_type == "receipt_notice":
                receipt_notice_ids.append(source_id)

        if delivery_notice_ids:
            notices = await DeliveryNotice.filter(
                tenant_id=tenant_id,
                id__in=delivery_notice_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(*(row.customer_phone for row in notices))
            if phone:
                return phone
            for row in notices:
                if row.sales_delivery_id:
                    delivery_ids.append(int(row.sales_delivery_id))
                if row.sales_order_id:
                    sales_order_ids.append(int(row.sales_order_id))
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

        if shipment_notice_ids:
            notices = await ShipmentNotice.filter(
                tenant_id=tenant_id,
                id__in=shipment_notice_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(*(row.customer_phone for row in notices))
            if phone:
                return phone
            for row in notices:
                if row.sales_delivery_id:
                    delivery_ids.append(int(row.sales_delivery_id))
                if row.sales_order_id:
                    sales_order_ids.append(int(row.sales_order_id))
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

        if receipt_notice_ids:
            notices = await ReceiptNotice.filter(
                tenant_id=tenant_id,
                id__in=receipt_notice_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(*(row.supplier_phone for row in notices))
            if phone:
                return phone

        unique_delivery_ids = sorted({item for item in delivery_ids if item > 0})
        if unique_delivery_ids:
            deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                id__in=unique_delivery_ids,
                deleted_at__isnull=True,
            )
            for row in deliveries:
                if row.sales_order_id:
                    sales_order_ids.append(int(row.sales_order_id))
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

            linked_delivery_notices = await DeliveryNotice.filter(
                tenant_id=tenant_id,
                sales_delivery_id__in=unique_delivery_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(*(row.customer_phone for row in linked_delivery_notices))
            if phone:
                return phone
            for row in linked_delivery_notices:
                if row.sales_order_id:
                    sales_order_ids.append(int(row.sales_order_id))
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

            unique_order_ids = sorted({item for item in sales_order_ids if item > 0})
            shipment_q = ShipmentNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if unique_order_ids:
                shipment_q = shipment_q.filter(
                    Q(sales_delivery_id__in=unique_delivery_ids) | Q(sales_order_id__in=unique_order_ids)
                )
            else:
                shipment_q = shipment_q.filter(sales_delivery_id__in=unique_delivery_ids)
            linked_shipment_notices = await shipment_q
            phone = _first_phone(
                *(
                    row.customer_phone
                    for row in linked_shipment_notices
                    if _shipment_notice_links_delivery(row, unique_delivery_ids)
                    or (row.sales_order_id and int(row.sales_order_id) in set(unique_order_ids))
                )
            )
            if phone:
                return phone
            for row in linked_shipment_notices:
                if row.sales_order_id:
                    sales_order_ids.append(int(row.sales_order_id))
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

        unique_order_ids = sorted({item for item in sales_order_ids if item > 0})
        if unique_order_ids:
            orders = await SalesOrder.filter(
                tenant_id=tenant_id,
                id__in=unique_order_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(*(row.customer_phone for row in orders))
            if phone:
                return phone
            for row in orders:
                if row.customer_id:
                    customer_ids.append(int(row.customer_id))

        unique_customer_ids = sorted({item for item in customer_ids if item > 0})
        if unique_customer_ids:
            customers = await Customer.filter(
                tenant_id=tenant_id,
                id__in=unique_customer_ids,
                deleted_at__isnull=True,
            )
            phone = _first_phone(
                *(row.delivery_contact_phone for row in customers),
                *(row.phone for row in customers),
            )
            if phone:
                return phone
        return None

    async def _build_order_response(
        self,
        order: FreightOrder,
        *,
        include_query_phone: bool = False,
    ) -> Dict[str, Any]:
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
        if include_query_phone:
            last4 = _first_phone_last4(order.recipient_phone, order.sender_phone)
            if not last4:
                last4 = extract_phone_last4(
                    await self._resolve_source_phone(int(order.tenant_id), list(sources))
                )
            data["query_phone"] = last4
        return data

    async def list_orders(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        status_in: Optional[str] = None,
        business_direction: Optional[str] = None,
        uuid: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = FreightOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if uuid:
            query = query.filter(uuid=uuid.strip())
        if status:
            query = query.filter(status=status)
        elif status_in:
            statuses = [s.strip() for s in status_in.split(",") if s.strip()]
            if statuses:
                query = query.filter(status__in=statuses)
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
        return await self._build_order_response(order, include_query_phone=True)

    async def create_order(
        self,
        tenant_id: int,
        data: FreightOrderCreate,
        *,
        created_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not data.sources:
            raise BusinessLogicError("请至少关联一条来源单据")
        await self._assert_sources_pullable(tenant_id, data.sources)
        refs = await self._resolve_transport_refs(
            tenant_id,
            carrier_id=data.carrier_id,
            vehicle_id=data.vehicle_id,
            driver_id=data.driver_id,
        )
        order_code = await self.generate_code(tenant_id, "FREIGHT_ORDER_CODE", prefix=f"FR{today_site_str()}")
        sender_phone = _clean_phone(data.sender_phone)
        recipient_phone = _clean_phone(data.recipient_phone)
        if not recipient_phone:
            recipient_phone = await self._resolve_source_phone(tenant_id, list(data.sources))
        async with in_transaction():
            order = await FreightOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                business_direction=data.business_direction,
                transport_mode=data.transport_mode,
                tracking_number=data.tracking_number,
                sender_phone=sender_phone,
                recipient_phone=recipient_phone,
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
            await self._apply_order_address_geocode(order)
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
        if "sender_phone" in payload:
            payload["sender_phone"] = _clean_phone(payload.get("sender_phone"))
        if "recipient_phone" in payload:
            payload["recipient_phone"] = _clean_phone(payload.get("recipient_phone"))
        payload.update(refs)
        payload["updated_by"] = updated_by
        address_changed = (
            "origin_address" in payload or "destination_address" in payload
        )
        await order.update_from_dict(payload)
        await order.save()
        if address_changed:
            await self._apply_order_address_geocode(order)
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
        if not (data.location or "").strip():
            raise BusinessLogicError("请填写节点地点")
        coords = await geocode_address(data.location, tenant_id=tenant_id)
        event_kwargs: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "freight_order_id": order.id,
            "event_type": data.event_type,
            "event_time": data.event_time or resolve_business_datetime(),
            "location": data.location,
            "remark": data.remark,
            "operator_id": operator_id,
            "operator_name": operator_name,
        }
        if coords:
            event_kwargs["lng"], event_kwargs["lat"] = coords
        await FreightTrackingEvent.create(**event_kwargs)
        return await self.get_order(tenant_id, order_id)

    async def delete_tracking_event(
        self,
        tenant_id: int,
        order_id: int,
        event_id: int,
    ) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        event = await FreightTrackingEvent.get_or_none(
            id=event_id,
            tenant_id=tenant_id,
            freight_order_id=order.id,
        )
        if not event:
            raise NotFoundError("跟踪节点不存在")
        await event.delete()
        return await self.get_order(tenant_id, order_id)

    async def cancel_order(self, tenant_id: int, order_id: int) -> Dict[str, Any]:
        order = await FreightOrder.get_or_none(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("货运单不存在")
        if order.status == "signed":
            raise BusinessLogicError("已签收货运单不可取消")
        await self._transition(order, "cancelled")
        return await self.get_order(tenant_id, order_id)
