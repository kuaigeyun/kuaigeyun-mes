"""服务结算单服务"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import (
    RepairOrder,
    ServiceSettlement,
    ServiceSettlementItem,
)
from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob
from apps.kuaizhizao.schemas.after_sales_service import (
    SETTLEMENT_SOURCE_TYPES,
    ServiceSettlementAudit,
    ServiceSettlementCreate,
    ServiceSettlementItemCreate,
    ServiceSettlementItemResponse,
    ServiceSettlementListEnvelope,
    ServiceSettlementReject,
    ServiceSettlementResponse,
    ServiceSettlementUpdate,
)
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class ServiceSettlementService:
    @staticmethod
    def _gen_settlement_code() -> str:
        return f"FWJS{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

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
        if st not in SETTLEMENT_SOURCE_TYPES:
            raise ValidationError(f"无效的来源类型: {source_type}")
        if st == "repair_order":
            row = await RepairOrder.filter(
                id=source_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not row:
                raise ValidationError(f"维修单不存在: {source_id}")
            return row.order_code
        row = await InstallExecutionJob.filter(
            id=source_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"安装执行单不存在: {source_id}")
        return row.job_code

    @classmethod
    async def _normalize_items(
        cls,
        tenant_id: int,
        items: Sequence[ServiceSettlementItemCreate],
        *,
        exclude_settlement_id: Optional[int] = None,
    ) -> List[dict]:
        if not items:
            raise ValidationError("请至少添加一条结算明细")
        normalized: List[dict] = []
        seen: set[tuple[str, int]] = set()
        for idx, item in enumerate(items, start=1):
            st = (item.source_type or "").strip()
            if st not in SETTLEMENT_SOURCE_TYPES:
                raise ValidationError(f"无效的来源类型: {item.source_type}")
            source_id = int(item.source_id)
            key = (st, source_id)
            if key in seen:
                raise BusinessLogicError(f"结算明细来源重复: {item.source_code or source_id}")
            seen.add(key)
            source_code = item.source_code or await cls._resolve_source_code(
                tenant_id, st, source_id
            )
            amount = Decimal(str(item.amount or 0))
            normalized.append({
                "source_type": st,
                "source_id": source_id,
                "source_code": source_code,
                "warranty_status": (item.warranty_status or "").strip() or None,
                "amount": amount,
                "notes": (item.notes or "").strip() or None,
                "line_no": idx,
            })
        await cls._assert_sources_not_settled(
            tenant_id, normalized, exclude_settlement_id=exclude_settlement_id
        )
        return normalized

    @classmethod
    async def _assert_sources_not_settled(
        cls,
        tenant_id: int,
        items: Sequence[dict],
        *,
        exclude_settlement_id: Optional[int] = None,
    ) -> None:
        source_ids = [int(row["source_id"]) for row in items]
        if not source_ids:
            return
        existing_items = await ServiceSettlementItem.filter(
            tenant_id=tenant_id,
            source_id__in=source_ids,
            deleted_at__isnull=True,
        )
        wanted = {(str(row["source_type"]), int(row["source_id"])) for row in items}
        matched = [
            row
            for row in existing_items
            if (str(row.source_type), int(row.source_id)) in wanted
            and (exclude_settlement_id is None or row.settlement_id != exclude_settlement_id)
        ]
        if not matched:
            return
        settlement_ids = {row.settlement_id for row in matched}
        settlements = await ServiceSettlement.filter(
            tenant_id=tenant_id,
            id__in=list(settlement_ids),
            deleted_at__isnull=True,
        )
        settlement_by_id = {row.id: row for row in settlements}
        for row in matched:
            settlement = settlement_by_id.get(row.settlement_id)
            if not settlement:
                continue
            raise BusinessLogicError(
                f"来源 {row.source_code} 已在结算单 {settlement.settlement_code} 入账"
            )

    @classmethod
    def _calc_amounts(cls, items: Sequence[dict]) -> tuple[Decimal, Decimal, Decimal]:
        warranty_free = Decimal("0")
        chargeable = Decimal("0")
        for row in items:
            amount = Decimal(str(row.get("amount") or 0))
            ws = str(row.get("warranty_status") or "").strip()
            if ws == "保内":
                warranty_free += amount
            else:
                chargeable += amount
        total = warranty_free + chargeable
        return warranty_free, chargeable, total

    @classmethod
    async def _replace_items(
        cls,
        tenant_id: int,
        settlement_id: int,
        items: Sequence[ServiceSettlementItemCreate],
        current_user: User,
    ) -> List[ServiceSettlementItem]:
        normalized = await cls._normalize_items(
            tenant_id, items, exclude_settlement_id=settlement_id
        )
        await ServiceSettlementItem.filter(
            tenant_id=tenant_id,
            settlement_id=settlement_id,
        ).delete()
        created: List[ServiceSettlementItem] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "settlement_id": settlement_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await ServiceSettlementItem.create(**payload))
        return created

    @classmethod
    async def _load_items(cls, tenant_id: int, settlement_id: int) -> List[ServiceSettlementItem]:
        return await ServiceSettlementItem.filter(
            tenant_id=tenant_id,
            settlement_id=settlement_id,
        ).order_by("line_no", "id")

    @classmethod
    async def _to_response(
        cls,
        row: ServiceSettlement,
        items: Optional[List[ServiceSettlementItem]] = None,
    ) -> ServiceSettlementResponse:
        if items is None:
            items = await cls._load_items(row.tenant_id, row.id)
        base = ServiceSettlementResponse.model_validate(row)
        return base.model_copy(
            update={
                "items": [ServiceSettlementItemResponse.model_validate(i) for i in items],
            }
        )

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: ServiceSettlementCreate,
        current_user: User,
    ) -> ServiceSettlementResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id)
        normalized = await cls._normalize_items(tenant_id, data.items)
        warranty_free, chargeable, total = cls._calc_amounts(normalized)

        async with in_transaction():
            payload = {
                "tenant_id": tenant_id,
                "settlement_code": cls._gen_settlement_code(),
                "customer_id": customer.id,
                "customer_name": customer.name,
                "warranty_free_amount": warranty_free,
                "chargeable_amount": chargeable,
                "total_amount": total,
                "status": "草稿",
                "notes": (data.notes or "").strip() or None,
            }
            apply_create_audit(payload, current_user)
            row = await ServiceSettlement.create(**payload)
            items: List[ServiceSettlementItem] = []
            for item_row in normalized:
                item_payload = {"tenant_id": tenant_id, "settlement_id": row.id, **item_row}
                apply_create_audit(item_payload, current_user)
                items.append(await ServiceSettlementItem.create(**item_payload))
        return await cls._to_response(row, items)

    @classmethod
    async def get(cls, tenant_id: int, settlement_id: int) -> ServiceSettlementResponse:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_settlements(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> ServiceSettlementListEnvelope:
        query = ServiceSettlement.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status.strip())
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(settlement_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-created_at", "-id").offset(skip).limit(limit)
        return ServiceSettlementListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        settlement_id: int,
        data: ServiceSettlementUpdate,
        current_user: User,
    ) -> ServiceSettlementResponse:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        if row.status not in {"草稿"}:
            raise ValidationError("仅草稿状态可编辑")

        dump = data.model_dump(exclude_unset=True)
        items_payload = dump.pop("items", None)
        if "notes" in dump:
            dump["notes"] = (dump.get("notes") or "").strip() or None

        async with in_transaction():
            items: Optional[List[ServiceSettlementItem]] = None
            if items_payload is not None:
                items = await cls._replace_items(
                    tenant_id,
                    settlement_id,
                    [ServiceSettlementItemCreate.model_validate(x) for x in items_payload],
                    current_user,
                )
                normalized = await cls._normalize_items(
                    tenant_id,
                    [ServiceSettlementItemCreate.model_validate(x) for x in items_payload],
                )
                warranty_free, chargeable, total = cls._calc_amounts(normalized)
                dump.update({
                    "warranty_free_amount": warranty_free,
                    "chargeable_amount": chargeable,
                    "total_amount": total,
                })
            if dump:
                apply_update_audit(dump, current_user)
                await ServiceSettlement.filter(id=settlement_id, tenant_id=tenant_id).update(**dump)
            row = await ServiceSettlement.get(id=settlement_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def submit(
        cls,
        tenant_id: int,
        settlement_id: int,
        current_user: User,
    ) -> ServiceSettlementResponse:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        if row.status != "草稿":
            raise BusinessLogicError("仅草稿状态可提交审核")
        items = await cls._load_items(tenant_id, settlement_id)
        if not items:
            raise ValidationError("请至少添加一条结算明细")

        dump = {"status": "待审核"}
        apply_update_audit(dump, current_user)
        await ServiceSettlement.filter(id=settlement_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceSettlement.get(id=settlement_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def audit(
        cls,
        tenant_id: int,
        settlement_id: int,
        data: ServiceSettlementAudit,
        current_user: User,
    ) -> ServiceSettlementResponse:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        if row.status != "待审核":
            raise BusinessLogicError("仅待审核状态可审核通过")

        dump = {
            "status": "已审核",
            "reviewer_id": current_user.id,
            "reviewer_name": current_user.full_name or current_user.username,
            "reviewed_at": resolve_business_datetime(),
            "review_remarks": (data.review_remarks or "").strip() or None,
        }
        apply_update_audit(dump, current_user)
        await ServiceSettlement.filter(id=settlement_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceSettlement.get(id=settlement_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def reject(
        cls,
        tenant_id: int,
        settlement_id: int,
        data: ServiceSettlementReject,
        current_user: User,
    ) -> ServiceSettlementResponse:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        if row.status != "待审核":
            raise BusinessLogicError("仅待审核状态可驳回")

        dump = {
            "status": "草稿",
            "reviewer_id": current_user.id,
            "reviewer_name": current_user.full_name or current_user.username,
            "reviewed_at": resolve_business_datetime(),
            "review_remarks": data.review_remarks.strip(),
        }
        apply_update_audit(dump, current_user)
        await ServiceSettlement.filter(id=settlement_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceSettlement.get(id=settlement_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, settlement_id: int, current_user: User) -> None:
        row = await ServiceSettlement.filter(
            id=settlement_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"服务结算单不存在: {settlement_id}")
        if row.status != "草稿":
            raise BusinessLogicError("仅草稿状态可删除")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await ServiceSettlement.filter(id=settlement_id, tenant_id=tenant_id).update(**dump)
