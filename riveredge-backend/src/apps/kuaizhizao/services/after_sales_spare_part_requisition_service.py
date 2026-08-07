"""售后备件申领单服务"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import (
    AfterSalesSparePartRequisition,
    AfterSalesSparePartRequisitionItem,
    RepairOrder,
)
from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob
from apps.kuaizhizao.schemas.after_sales_service import (
    REQUISITION_SOURCE_TYPES,
    AfterSalesSparePartRequisitionAudit,
    AfterSalesSparePartRequisitionCreate,
    AfterSalesSparePartRequisitionItemCreate,
    AfterSalesSparePartRequisitionItemResponse,
    AfterSalesSparePartRequisitionListEnvelope,
    AfterSalesSparePartRequisitionReject,
    AfterSalesSparePartRequisitionResponse,
    AfterSalesSparePartRequisitionUpdate,
)
from apps.kuaizhizao.schemas.warehouse import OtherOutboundCreate, OtherOutboundItemCreate
from apps.kuaizhizao.services.warehouse_service import OtherOutboundService
from apps.master_data.models.material import Material
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class AfterSalesSparePartRequisitionService:
    @staticmethod
    def _gen_requisition_code() -> str:
        return f"SHBJ{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    async def _resolve_source(
        cls,
        tenant_id: int,
        source_type: str,
        source_id: int,
    ) -> tuple[str, str]:
        st = (source_type or "").strip()
        if st not in REQUISITION_SOURCE_TYPES:
            raise ValidationError(f"无效的来源类型: {source_type}")
        if st == "repair_order":
            row = await RepairOrder.filter(
                id=source_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not row:
                raise ValidationError(f"维修单不存在: {source_id}")
            return st, row.order_code
        row = await InstallExecutionJob.filter(
            id=source_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"安装执行单不存在: {source_id}")
        return st, row.job_code

    @classmethod
    async def _normalize_items(
        cls,
        tenant_id: int,
        items: Sequence[AfterSalesSparePartRequisitionItemCreate],
    ) -> List[dict]:
        if not items:
            raise ValidationError("请至少添加一条申领明细")
        normalized: List[dict] = []
        for idx, item in enumerate(items, start=1):
            material_id = item.material_id
            material_code = (item.material_code or "").strip() or None
            material_name = (item.material_name or "").strip() or None
            material_spec = (item.material_spec or "").strip() or None
            material_unit = (item.material_unit or "").strip() or None
            if material_id is None:
                raise ValidationError(f"第 {idx} 行请选择物料")
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
            if qty <= 0:
                raise ValidationError(f"第 {idx} 行数量必须大于 0")
            normalized.append({
                "material_id": material_id,
                "material_code": material_code,
                "material_name": material_name,
                "material_spec": material_spec,
                "material_unit": material_unit,
                "quantity": qty,
                "notes": (item.notes or "").strip() or None,
                "line_no": idx,
            })
        return normalized

    @classmethod
    async def _replace_items(
        cls,
        tenant_id: int,
        requisition_id: int,
        items: Sequence[AfterSalesSparePartRequisitionItemCreate],
        current_user: User,
    ) -> List[AfterSalesSparePartRequisitionItem]:
        normalized = await cls._normalize_items(tenant_id, items)
        await AfterSalesSparePartRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
        ).delete()
        created: List[AfterSalesSparePartRequisitionItem] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "requisition_id": requisition_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await AfterSalesSparePartRequisitionItem.create(**payload))
        return created

    @classmethod
    async def _load_items(cls, tenant_id: int, requisition_id: int) -> List[AfterSalesSparePartRequisitionItem]:
        return await AfterSalesSparePartRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
        ).order_by("line_no", "id")

    @classmethod
    async def _to_response(
        cls,
        row: AfterSalesSparePartRequisition,
        items: Optional[List[AfterSalesSparePartRequisitionItem]] = None,
    ) -> AfterSalesSparePartRequisitionResponse:
        if items is None:
            items = await cls._load_items(row.tenant_id, row.id)
        base = AfterSalesSparePartRequisitionResponse.model_validate(row)
        return base.model_copy(
            update={
                "items": [
                    AfterSalesSparePartRequisitionItemResponse.model_validate(i) for i in items
                ],
            }
        )

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: AfterSalesSparePartRequisitionCreate,
        current_user: User,
    ) -> AfterSalesSparePartRequisitionResponse:
        source_type, source_code = await cls._resolve_source(
            tenant_id, data.source_type, data.source_id
        )
        if not data.warehouse_id:
            raise ValidationError("请选择出库仓库")

        async with in_transaction():
            payload = {
                "tenant_id": tenant_id,
                "requisition_code": cls._gen_requisition_code(),
                "source_type": source_type,
                "source_id": data.source_id,
                "source_code": source_code,
                "warehouse_id": data.warehouse_id,
                "warehouse_name": (data.warehouse_name or "").strip() or None,
                "status": "草稿",
                "notes": (data.notes or "").strip() or None,
            }
            apply_create_audit(payload, current_user)
            row = await AfterSalesSparePartRequisition.create(**payload)
            items = await cls._replace_items(tenant_id, row.id, data.items, current_user)
        return await cls._to_response(row, items)

    @classmethod
    async def get(cls, tenant_id: int, requisition_id: int) -> AfterSalesSparePartRequisitionResponse:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_requisitions(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> AfterSalesSparePartRequisitionListEnvelope:
        query = AfterSalesSparePartRequisition.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status.strip())
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(requisition_code__icontains=kw)
                    | Q(source_code__icontains=kw)
                    | Q(warehouse_name__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-created_at", "-id").offset(skip).limit(limit)
        return AfterSalesSparePartRequisitionListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        requisition_id: int,
        data: AfterSalesSparePartRequisitionUpdate,
        current_user: User,
    ) -> AfterSalesSparePartRequisitionResponse:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        if row.status not in {"草稿", "已驳回"}:
            raise ValidationError("仅草稿或已驳回状态可编辑")

        dump = data.model_dump(exclude_unset=True)
        items_payload = dump.pop("items", None)
        if "warehouse_name" in dump:
            dump["warehouse_name"] = (dump.get("warehouse_name") or "").strip() or None
        if "notes" in dump:
            dump["notes"] = (dump.get("notes") or "").strip() or None

        async with in_transaction():
            if dump:
                apply_update_audit(dump, current_user)
                await AfterSalesSparePartRequisition.filter(
                    id=requisition_id, tenant_id=tenant_id
                ).update(**dump)
            items: Optional[List[AfterSalesSparePartRequisitionItem]] = None
            if items_payload is not None:
                items = await cls._replace_items(
                    tenant_id,
                    requisition_id,
                    [AfterSalesSparePartRequisitionItemCreate.model_validate(x) for x in items_payload],
                    current_user,
                )
            row = await AfterSalesSparePartRequisition.get(id=requisition_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def submit(
        cls,
        tenant_id: int,
        requisition_id: int,
        current_user: User,
    ) -> AfterSalesSparePartRequisitionResponse:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        if row.status not in {"草稿", "已驳回"}:
            raise BusinessLogicError("仅草稿或已驳回状态可提交审核")
        items = await cls._load_items(tenant_id, requisition_id)
        if not items:
            raise ValidationError("请至少添加一条申领明细")
        if not row.warehouse_id:
            raise ValidationError("请选择出库仓库")

        dump = {"status": "待审核"}
        apply_update_audit(dump, current_user)
        await AfterSalesSparePartRequisition.filter(id=requisition_id, tenant_id=tenant_id).update(**dump)
        row = await AfterSalesSparePartRequisition.get(id=requisition_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def audit(
        cls,
        tenant_id: int,
        requisition_id: int,
        data: AfterSalesSparePartRequisitionAudit,
        current_user: User,
    ) -> AfterSalesSparePartRequisitionResponse:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        if row.status != "待审核":
            raise BusinessLogicError("仅待审核状态可审核通过")

        items = await cls._load_items(tenant_id, requisition_id)
        if not items:
            raise ValidationError("申领单无明细，无法审核")

        outbound_items = [
            OtherOutboundItemCreate(
                material_id=int(item.material_id),
                material_code=str(item.material_code or ""),
                material_name=str(item.material_name or ""),
                material_spec=item.material_spec,
                material_unit=str(item.material_unit or ""),
                outbound_quantity=float(item.quantity or 0),
                unit_price=0,
                total_amount=0,
            )
            for item in items
            if item.material_id is not None
        ]

        async with in_transaction():
            outbound = await OtherOutboundService().create_other_outbound(
                tenant_id=tenant_id,
                outbound_data=OtherOutboundCreate(
                    reason_type="其他",
                    reason_desc=f"售后备件申领 {row.requisition_code}",
                    warehouse_id=int(row.warehouse_id),
                    warehouse_name=str(row.warehouse_name or ""),
                    items=outbound_items,
                ),
                created_by=current_user.id,
            )
            dump = {
                "status": "已审核",
                "reviewer_id": current_user.id,
                "reviewer_name": current_user.full_name or current_user.username,
                "reviewed_at": resolve_business_datetime(),
                "review_remarks": (data.review_remarks or "").strip() or None,
                "other_outbound_id": outbound.id,
                "other_outbound_code": outbound.outbound_code,
            }
            apply_update_audit(dump, current_user)
            await AfterSalesSparePartRequisition.filter(
                id=requisition_id, tenant_id=tenant_id
            ).update(**dump)

        row = await AfterSalesSparePartRequisition.get(id=requisition_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def reject(
        cls,
        tenant_id: int,
        requisition_id: int,
        data: AfterSalesSparePartRequisitionReject,
        current_user: User,
    ) -> AfterSalesSparePartRequisitionResponse:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        if row.status != "待审核":
            raise BusinessLogicError("仅待审核状态可驳回")

        dump = {
            "status": "已驳回",
            "reviewer_id": current_user.id,
            "reviewer_name": current_user.full_name or current_user.username,
            "reviewed_at": resolve_business_datetime(),
            "review_remarks": data.review_remarks.strip(),
        }
        apply_update_audit(dump, current_user)
        await AfterSalesSparePartRequisition.filter(id=requisition_id, tenant_id=tenant_id).update(**dump)
        row = await AfterSalesSparePartRequisition.get(id=requisition_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, requisition_id: int, current_user: User) -> None:
        row = await AfterSalesSparePartRequisition.filter(
            id=requisition_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件申领单不存在: {requisition_id}")
        if row.status not in {"草稿", "已驳回"}:
            raise BusinessLogicError("仅草稿或已驳回状态可删除")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await AfterSalesSparePartRequisition.filter(id=requisition_id, tenant_id=tenant_id).update(**dump)
