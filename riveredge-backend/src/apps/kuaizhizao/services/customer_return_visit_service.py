"""客户回访服务"""

from __future__ import annotations

import uuid
from typing import Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import CustomerReturnVisit, RepairOrder
from apps.kuaizhizao.models.after_sales_ticket import AfterSalesTicket
from apps.kuaizhizao.schemas.after_sales_service import (
    VISIT_METHODS,
    VISIT_SOURCE_TYPES,
    CustomerReturnVisitCreate,
    CustomerReturnVisitListEnvelope,
    CustomerReturnVisitResponse,
    CustomerReturnVisitUpdate,
)
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class CustomerReturnVisitService:
    @staticmethod
    def _gen_visit_code() -> str:
        return f"KHHF{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def _validate_visit_method(value: str) -> str:
        v = (value or "").strip()
        if v not in VISIT_METHODS:
            raise ValidationError(f"无效的回访方式: {value}")
        return v

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
    async def _resolve_source_code(
        cls,
        tenant_id: int,
        source_type: str,
        source_id: int,
    ) -> str:
        st = (source_type or "").strip()
        if st not in VISIT_SOURCE_TYPES:
            raise ValidationError(f"无效的来源类型: {source_type}")
        if st == "after_sales_ticket":
            row = await AfterSalesTicket.filter(
                id=source_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not row:
                raise ValidationError(f"售后工单不存在: {source_id}")
            return row.ticket_code
        row = await RepairOrder.filter(
            id=source_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"维修单不存在: {source_id}")
        return row.order_code

    @classmethod
    async def _to_response(cls, row: CustomerReturnVisit) -> CustomerReturnVisitResponse:
        return CustomerReturnVisitResponse.model_validate(row)

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: CustomerReturnVisitCreate,
        current_user: User,
    ) -> CustomerReturnVisitResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id)
        source_type = (data.source_type or "").strip()
        source_code = await cls._resolve_source_code(tenant_id, source_type, data.source_id)
        existing = await CustomerReturnVisit.filter(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=data.source_id,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise BusinessLogicError(f"该来源已有回访: {existing.visit_code}")
        visit_method = cls._validate_visit_method(data.visit_method or "电话")
        visited_at = resolve_business_datetime(data.visited_at)
        if data.satisfaction_score is not None and not (1 <= data.satisfaction_score <= 5):
            raise ValidationError("满意度评分须在 1 至 5 之间")

        payload = {
            "tenant_id": tenant_id,
            "visit_code": cls._gen_visit_code(),
            "customer_id": customer.id,
            "customer_name": customer.name,
            "source_type": source_type,
            "source_id": data.source_id,
            "source_code": source_code,
            "visit_method": visit_method,
            "satisfaction_score": data.satisfaction_score,
            "feedback": (data.feedback or "").strip() or None,
            "visitor_id": data.visitor_id or current_user.id,
            "visitor_name": (data.visitor_name or current_user.full_name or current_user.username),
            "visited_at": visited_at,
            "notes": (data.notes or "").strip() or None,
        }
        apply_create_audit(payload, current_user)
        row = await CustomerReturnVisit.create(**payload)
        return await cls._to_response(row)

    @classmethod
    async def get(cls, tenant_id: int, visit_id: int) -> CustomerReturnVisitResponse:
        row = await CustomerReturnVisit.filter(
            id=visit_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"客户回访不存在: {visit_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_visits(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> CustomerReturnVisitListEnvelope:
        query = CustomerReturnVisit.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(visit_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(source_code__icontains=kw)
                    | Q(feedback__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-visited_at", "-id").offset(skip).limit(limit)
        return CustomerReturnVisitListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        visit_id: int,
        data: CustomerReturnVisitUpdate,
        current_user: User,
    ) -> CustomerReturnVisitResponse:
        row = await CustomerReturnVisit.filter(
            id=visit_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"客户回访不存在: {visit_id}")

        dump = data.model_dump(exclude_unset=True)
        if "visit_method" in dump and dump["visit_method"] is not None:
            dump["visit_method"] = cls._validate_visit_method(dump["visit_method"])
        if "visited_at" in dump and dump["visited_at"] is not None:
            dump["visited_at"] = resolve_business_datetime(dump["visited_at"])
        if "satisfaction_score" in dump and dump["satisfaction_score"] is not None:
            if not (1 <= dump["satisfaction_score"] <= 5):
                raise ValidationError("满意度评分须在 1 至 5 之间")
        for field in ("feedback", "visitor_name", "notes"):
            if field in dump and dump[field] is not None:
                dump[field] = str(dump[field]).strip() or None

        if dump:
            apply_update_audit(dump, current_user)
            await CustomerReturnVisit.filter(id=visit_id, tenant_id=tenant_id).update(**dump)
        row = await CustomerReturnVisit.get(id=visit_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, visit_id: int, current_user: User) -> None:
        row = await CustomerReturnVisit.filter(
            id=visit_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"客户回访不存在: {visit_id}")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await CustomerReturnVisit.filter(id=visit_id, tenant_id=tenant_id).update(**dump)
