"""服务派工单服务"""

from __future__ import annotations

import uuid
from typing import Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import RepairOrder, ServiceDispatchOrder
from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob
from apps.kuaizhizao.schemas.after_sales_service import (
    DISPATCH_SOURCE_TYPES,
    DISPATCH_STATUSES,
    ServiceDispatchAssign,
    ServiceDispatchCancel,
    ServiceDispatchCheckin,
    ServiceDispatchComplete,
    ServiceDispatchCreate,
    ServiceDispatchListEnvelope,
    ServiceDispatchResponse,
    ServiceDispatchUpdate,
)
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

DISPATCH_STATUS_FLOW = {
    "待接单": {"已接单", "已取消"},
    "已接单": {"到场", "已取消"},
    "到场": {"完工", "已取消"},
    "完工": set(),
    "已取消": set(),
}


class ServiceDispatchService:
    @staticmethod
    def _gen_dispatch_code() -> str:
        return f"FWPG{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    async def _transition(cls, row: ServiceDispatchOrder, target: str) -> None:
        allowed = DISPATCH_STATUS_FLOW.get(row.status or "待接单", set())
        if target not in allowed:
            raise BusinessLogicError(f"当前状态 {row.status} 不能变更为 {target}")
        row.status = target
        await row.save()

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
    async def _resolve_source(
        cls,
        tenant_id: int,
        source_type: str,
        source_id: int,
    ) -> tuple[str, str, Optional[str]]:
        st = (source_type or "").strip()
        if st not in DISPATCH_SOURCE_TYPES:
            raise ValidationError(f"无效的来源类型: {source_type}")
        if st == "repair_order":
            row = await RepairOrder.filter(
                id=source_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not row:
                raise ValidationError(f"维修单不存在: {source_id}")
            return st, row.order_code, row.site_address
        row = await InstallExecutionJob.filter(
            id=source_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"安装执行单不存在: {source_id}")
        return st, row.job_code, row.site_address

    @classmethod
    async def _to_response(cls, row: ServiceDispatchOrder) -> ServiceDispatchResponse:
        return ServiceDispatchResponse.model_validate(row)

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: ServiceDispatchCreate,
        current_user: User,
    ) -> ServiceDispatchResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id)
        source_type, source_code, default_address = await cls._resolve_source(
            tenant_id, data.source_type, data.source_id
        )
        existing = await ServiceDispatchOrder.filter(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=data.source_id,
            deleted_at__isnull=True,
        ).exclude(status="已取消").first()
        if existing:
            raise BusinessLogicError(f"该来源已有未取消派工: {existing.dispatch_code}")
        payload = {
            "tenant_id": tenant_id,
            "dispatch_code": cls._gen_dispatch_code(),
            "customer_id": customer.id,
            "customer_name": customer.name,
            "source_type": source_type,
            "source_id": data.source_id,
            "source_code": source_code,
            "engineer_id": data.engineer_id,
            "engineer_name": (data.engineer_name or "").strip() or None,
            "planned_start_at": data.planned_start_at,
            "planned_end_at": data.planned_end_at,
            "site_address": (data.site_address or "").strip() or default_address,
            "status": "待接单",
            "notes": (data.notes or "").strip() or None,
        }
        apply_create_audit(payload, current_user)
        row = await ServiceDispatchOrder.create(**payload)
        return await cls._to_response(row)

    @classmethod
    async def get(cls, tenant_id: int, dispatch_id: int) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_dispatches(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        engineer_id: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> ServiceDispatchListEnvelope:
        query = ServiceDispatchOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status.strip())
        if engineer_id is not None:
            query = query.filter(engineer_id=engineer_id)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(dispatch_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(engineer_name__icontains=kw)
                    | Q(source_code__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-created_at", "-id").offset(skip).limit(limit)
        return ServiceDispatchListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        dispatch_id: int,
        data: ServiceDispatchUpdate,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        if row.status in {"完工", "已取消"}:
            raise ValidationError("已完工或已取消的派工单不可编辑")

        dump = data.model_dump(exclude_unset=True)
        for field in ("engineer_name", "site_address", "notes"):
            if field in dump and dump[field] is not None:
                dump[field] = str(dump[field]).strip() or None
        if dump:
            apply_update_audit(dump, current_user)
            await ServiceDispatchOrder.filter(id=dispatch_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceDispatchOrder.get(id=dispatch_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def assign(
        cls,
        tenant_id: int,
        dispatch_id: int,
        data: ServiceDispatchAssign,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        if row.status != "待接单":
            raise BusinessLogicError("仅待接单状态可指派工程师")

        dump = {
            "engineer_id": data.engineer_id,
            "engineer_name": (data.engineer_name or "").strip() or None,
            "planned_start_at": data.planned_start_at,
            "planned_end_at": data.planned_end_at,
            "status": "已接单",
            "actual_start_at": resolve_business_datetime(),
        }
        apply_update_audit(dump, current_user)
        await ServiceDispatchOrder.filter(id=dispatch_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceDispatchOrder.get(id=dispatch_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def accept(
        cls,
        tenant_id: int,
        dispatch_id: int,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        async with in_transaction():
            await cls._transition(row, "已接单")
            if not row.actual_start_at:
                row.actual_start_at = resolve_business_datetime()
                apply_update_audit(row, current_user)
                await row.save()
        return await cls.get(tenant_id, dispatch_id)

    @classmethod
    async def checkin(
        cls,
        tenant_id: int,
        dispatch_id: int,
        data: ServiceDispatchCheckin,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        checkin_at = resolve_business_datetime(data.checkin_at)
        async with in_transaction():
            await cls._transition(row, "到场")
            row.checkin_at = checkin_at
            row.checkin_location = (data.checkin_location or "").strip() or None
            apply_update_audit(row, current_user)
            await row.save()
        return await cls.get(tenant_id, dispatch_id)

    @classmethod
    async def complete(
        cls,
        tenant_id: int,
        dispatch_id: int,
        data: ServiceDispatchComplete,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        end_at = resolve_business_datetime(data.actual_end_at)
        async with in_transaction():
            await cls._transition(row, "完工")
            row.actual_end_at = end_at
            row.completion_notes = (data.completion_notes or "").strip() or None
            row.attachments = data.attachments
            apply_update_audit(row, current_user)
            await row.save()
        return await cls.get(tenant_id, dispatch_id)

    @classmethod
    async def cancel(
        cls,
        tenant_id: int,
        dispatch_id: int,
        data: ServiceDispatchCancel,
        current_user: User,
    ) -> ServiceDispatchResponse:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        if row.status in {"完工", "已取消"}:
            raise BusinessLogicError("已完工或已取消的派工单不可再次取消")
        async with in_transaction():
            await cls._transition(row, "已取消")
            if data.notes:
                prev = (row.notes or "").strip()
                extra = data.notes.strip()
                row.notes = f"{prev}\n{extra}".strip() if prev else extra
                apply_update_audit(row, current_user)
                await row.save()
        return await cls.get(tenant_id, dispatch_id)

    @classmethod
    async def delete(cls, tenant_id: int, dispatch_id: int, current_user: User) -> None:
        row = await ServiceDispatchOrder.filter(
            id=dispatch_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务派工单不存在: {dispatch_id}")
        if row.status not in {"待接单", "已取消"}:
            raise BusinessLogicError("仅待接单或已取消状态的派工单可删除")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await ServiceDispatchOrder.filter(id=dispatch_id, tenant_id=tenant_id).update(**dump)
