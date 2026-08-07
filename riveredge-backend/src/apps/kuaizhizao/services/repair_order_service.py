"""维修单服务"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import RepairOrder, RepairOrderItem, ServiceAsset
from apps.kuaizhizao.schemas.after_sales_service import (
    REPAIR_MODES,
    REPAIR_ORDER_STATUSES,
    WARRANTY_STATUSES,
    RepairOrderClose,
    RepairOrderCreate,
    RepairOrderItemCreate,
    RepairOrderItemResponse,
    RepairOrderListEnvelope,
    RepairOrderResponse,
    RepairOrderUpdate,
)
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class RepairOrderService:
    @staticmethod
    def _gen_order_code() -> str:
        return f"WXD{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def _validate_repair_mode(value: str) -> str:
        v = (value or "").strip()
        if v not in REPAIR_MODES:
            raise ValidationError(f"无效的维修方式: {value}")
        return v

    @staticmethod
    def determine_warranty_status(
        service_asset: Optional[ServiceAsset],
        reported_at,
    ) -> str:
        if not service_asset or not service_asset.warranty_end_at:
            return "待判定"
        if reported_at <= service_asset.warranty_end_at:
            return "保内"
        return "保外"

    @classmethod
    async def _load_customer(cls, tenant_id: int, customer_id: int) -> Customer:
        customer = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise NotFoundError(f"客户不存在: {customer_id}")
        return customer

    @classmethod
    async def _resolve_service_asset(
        cls,
        tenant_id: int,
        service_asset_id: Optional[int],
    ) -> tuple[Optional[int], Optional[str], Optional[ServiceAsset]]:
        if service_asset_id is None:
            return None, None, None
        asset = await ServiceAsset.filter(
            id=service_asset_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not asset:
            raise ValidationError(f"装机档案不存在: {service_asset_id}")
        return asset.id, asset.asset_code, asset

    @classmethod
    async def _normalize_items(
        cls,
        tenant_id: int,
        items: Sequence[RepairOrderItemCreate],
    ) -> List[dict]:
        normalized: List[dict] = []
        for idx, item in enumerate(items, start=1):
            material_id = item.material_id
            material_code = (item.material_code or "").strip() or None
            material_name = (item.material_name or "").strip() or None
            material_spec = (item.material_spec or "").strip() or None
            material_unit = (item.material_unit or "").strip() or None
            if material_id is not None:
                mat = await Material.filter(
                    id=material_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if not mat:
                    raise ValidationError(f"物料不存在: {material_id}")
                material_code = material_code or mat.main_code or mat.code
                material_name = material_name or mat.name
                material_spec = material_spec or mat.specification
                material_unit = material_unit or mat.base_unit
            qty = item.quantity or Decimal("0")
            unit_price = item.unit_price
            amount = item.amount
            if amount is None and unit_price is not None:
                amount = qty * Decimal(str(unit_price))
            normalized.append({
                "material_id": material_id,
                "material_code": material_code,
                "material_name": material_name,
                "material_spec": material_spec,
                "material_unit": material_unit,
                "quantity": qty,
                "unit_price": unit_price,
                "amount": amount,
                "notes": (item.notes or "").strip() or None,
                "line_no": idx,
            })
        return normalized

    @classmethod
    async def _replace_items(
        cls,
        tenant_id: int,
        order_id: int,
        items: Sequence[RepairOrderItemCreate],
        current_user: User,
    ) -> List[RepairOrderItem]:
        normalized = await cls._normalize_items(tenant_id, items)
        await RepairOrderItem.filter(tenant_id=tenant_id, repair_order_id=order_id).delete()
        created: List[RepairOrderItem] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "repair_order_id": order_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await RepairOrderItem.create(**payload))
        return created

    @classmethod
    async def _load_items(cls, tenant_id: int, order_id: int) -> List[RepairOrderItem]:
        return await RepairOrderItem.filter(
            tenant_id=tenant_id,
            repair_order_id=order_id,
        ).order_by("line_no", "id")

    @staticmethod
    def _sum_costs(
        labor: Optional[Decimal],
        travel: Optional[Decimal],
        spare: Optional[Decimal],
        outsource: Optional[Decimal],
    ) -> Optional[Decimal]:
        parts = [labor, travel, spare, outsource]
        if not any(p is not None for p in parts):
            return None
        total = Decimal("0")
        for p in parts:
            if p is not None:
                total += Decimal(str(p))
        return total

    @classmethod
    async def _to_response(
        cls,
        row: RepairOrder,
        items: Optional[List[RepairOrderItem]] = None,
    ) -> RepairOrderResponse:
        if items is None:
            items = await cls._load_items(row.tenant_id, row.id)
        base = RepairOrderResponse.model_validate(row)
        return base.model_copy(
            update={
                "items": [RepairOrderItemResponse.model_validate(i) for i in items],
            }
        )

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: RepairOrderCreate,
        current_user: User,
    ) -> RepairOrderResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id)
        repair_mode = cls._validate_repair_mode(data.repair_mode or "现场")
        fault_description = (data.fault_description or "").strip()
        if not fault_description:
            raise ValidationError("请填写故障描述")

        reported_at = resolve_business_datetime(data.reported_at)
        asset_id, asset_code, asset = await cls._resolve_service_asset(
            tenant_id, data.service_asset_id
        )
        warranty_status = cls.determine_warranty_status(asset, reported_at)

        ticket_id, ticket_code = None, None
        if data.after_sales_ticket_id:
            from apps.kuaizhizao.models.after_sales_ticket import AfterSalesTicket

            ticket = await AfterSalesTicket.filter(
                id=data.after_sales_ticket_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not ticket:
                raise ValidationError(f"售后工单不存在: {data.after_sales_ticket_id}")
            ticket_id, ticket_code = ticket.id, ticket.ticket_code

        async with in_transaction():
            payload = {
                "tenant_id": tenant_id,
                "order_code": cls._gen_order_code(),
                "customer_id": customer.id,
                "customer_name": customer.name,
                "after_sales_ticket_id": ticket_id,
                "after_sales_ticket_code": ticket_code,
                "service_asset_id": asset_id,
                "service_asset_code": asset_code,
                "repair_mode": repair_mode,
                "fault_category": (data.fault_category or "").strip() or None,
                "fault_description": fault_description,
                "warranty_status": warranty_status,
                "status": "待派工",
                "site_address": (data.site_address or "").strip() or None,
                "reported_at": reported_at,
                "notes": (data.notes or "").strip() or None,
            }
            apply_create_audit(payload, current_user)
            row = await RepairOrder.create(**payload)
            items = await cls._replace_items(tenant_id, row.id, data.items or [], current_user)
            spare_cost = sum(
                (Decimal(str(i.amount)) for i in items if i.amount is not None),
                Decimal("0"),
            )
            if items:
                await RepairOrder.filter(id=row.id, tenant_id=tenant_id).update(
                    spare_part_cost=spare_cost,
                    total_cost=spare_cost,
                )
                row.spare_part_cost = spare_cost
                row.total_cost = spare_cost
        return await cls._to_response(row, items)

    @classmethod
    async def get(cls, tenant_id: int, order_id: int) -> RepairOrderResponse:
        row = await RepairOrder.filter(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"维修单不存在: {order_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_orders(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        warranty_status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> RepairOrderListEnvelope:
        query = RepairOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status.strip())
        if warranty_status:
            query = query.filter(warranty_status=warranty_status.strip())
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(order_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(fault_description__icontains=kw)
                    | Q(after_sales_ticket_code__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-reported_at", "-id").offset(skip).limit(limit)
        return RepairOrderListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        order_id: int,
        data: RepairOrderUpdate,
        current_user: User,
    ) -> RepairOrderResponse:
        row = await RepairOrder.filter(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"维修单不存在: {order_id}")
        if row.status == "已关闭":
            raise ValidationError("已关闭的维修单不可编辑")

        dump = data.model_dump(exclude_unset=True)
        items_payload = dump.pop("items", None)
        if "repair_mode" in dump and dump["repair_mode"] is not None:
            dump["repair_mode"] = cls._validate_repair_mode(dump["repair_mode"])
        if "warranty_status" in dump and dump["warranty_status"] is not None:
            ws = dump["warranty_status"].strip()
            if ws not in WARRANTY_STATUSES:
                raise ValidationError(f"无效的保内保外状态: {ws}")
            dump["warranty_status"] = ws
        for text_field in ("fault_description", "fault_category", "diagnosis_result", "resolution", "site_address", "notes", "warranty_override_reason"):
            if text_field in dump and dump[text_field] is not None:
                dump[text_field] = str(dump[text_field]).strip() or None

        async with in_transaction():
            if dump:
                apply_update_audit(dump, current_user)
                await RepairOrder.filter(id=order_id, tenant_id=tenant_id).update(**dump)
            items: Optional[List[RepairOrderItem]] = None
            if items_payload is not None:
                items = await cls._replace_items(
                    tenant_id,
                    order_id,
                    [RepairOrderItemCreate.model_validate(x) for x in items_payload],
                    current_user,
                )
                spare_cost = sum(
                    (Decimal(str(i.amount)) for i in items if i.amount is not None),
                    Decimal("0"),
                )
                row_after = await RepairOrder.get(id=order_id, tenant_id=tenant_id)
                total = cls._sum_costs(
                    row_after.labor_cost,
                    row_after.travel_cost,
                    spare_cost if items else row_after.spare_part_cost,
                    row_after.outsource_cost,
                )
                cost_update = {"spare_part_cost": spare_cost if items else row_after.spare_part_cost, "total_cost": total}
                apply_update_audit(cost_update, current_user)
                await RepairOrder.filter(id=order_id, tenant_id=tenant_id).update(**cost_update)
            row = await RepairOrder.get(id=order_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def close(
        cls,
        tenant_id: int,
        order_id: int,
        data: RepairOrderClose,
        current_user: User,
    ) -> RepairOrderResponse:
        row = await RepairOrder.filter(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"维修单不存在: {order_id}")
        if row.status == "已关闭":
            raise ValidationError("维修单已关闭")

        dump: dict = {
            "status": "已关闭",
            "closed_at": resolve_business_datetime(),
        }
        if data.resolution is not None:
            dump["resolution"] = (data.resolution or "").strip() or None
        if data.diagnosis_result is not None:
            dump["diagnosis_result"] = (data.diagnosis_result or "").strip() or None
        apply_update_audit(dump, current_user)
        await RepairOrder.filter(id=order_id, tenant_id=tenant_id).update(**dump)
        row = await RepairOrder.get(id=order_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, order_id: int, current_user: User) -> None:
        row = await RepairOrder.filter(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"维修单不存在: {order_id}")
        if row.status not in {"待派工"}:
            raise BusinessLogicError("仅待派工状态的维修单可删除")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await RepairOrder.filter(id=order_id, tenant_id=tenant_id).update(**dump)
