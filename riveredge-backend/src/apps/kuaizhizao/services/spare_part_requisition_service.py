"""备件领用单业务服务。"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.spare_part import SparePart, SparePartRequisition, SparePartRequisitionLine
from apps.kuaizhizao.schemas.spare_part_requisition import (
    SparePartRequisitionCreate,
    SparePartRequisitionLineInput,
    SparePartRequisitionUpdate,
)
from apps.kuaizhizao.services.spare_part_service import SparePartService
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


async def _generate_requisition_no(tenant_id: int) -> str:
    try:
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code="spare_part_requisition_code",
            prefix="SPR",
        )
    except Exception:
        return f"SPR{datetime.now().strftime('%Y%m%d%H%M%S')}"


class SparePartRequisitionService:
    async def _load_lines(self, tenant_id: int, requisition_id: int) -> List[SparePartRequisitionLine]:
        return await SparePartRequisitionLine.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            deleted_at__isnull=True,
        ).order_by("line_no")

    async def _replace_lines(
        self,
        tenant_id: int,
        requisition_id: int,
        lines: List[SparePartRequisitionLineInput],
    ) -> None:
        existing = await SparePartRequisitionLine.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            deleted_at__isnull=True,
        )
        for row in existing:
            row.deleted_at = datetime.now()
            await row.save()

        for idx, line in enumerate(lines, start=1):
            part = await SparePart.filter(
                tenant_id=tenant_id,
                id=line.spare_part_id,
                deleted_at__isnull=True,
            ).first()
            if not part:
                raise NotFoundError(f"备件不存在: {line.spare_part_id}")
            await SparePartRequisitionLine.create(
                tenant_id=tenant_id,
                requisition_id=requisition_id,
                line_no=idx,
                spare_part_id=part.id,
                spare_part_uuid=part.uuid,
                part_no=part.part_no,
                part_name=part.part_name,
                quantity=line.quantity,
                warehouse_location=line.warehouse_location or "默认库位",
                unit=part.unit,
                remark=line.remark,
            )

    async def create(
        self,
        tenant_id: int,
        data: SparePartRequisitionCreate,
        *,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> SparePartRequisition:
        if not data.lines:
            raise ValidationError("领用明细不能为空")
        equipment = None
        if data.equipment_id:
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                id=data.equipment_id,
                deleted_at__isnull=True,
            ).first()
            if not equipment:
                raise NotFoundError(f"设备不存在: {data.equipment_id}")

        requisition_no = await _generate_requisition_no(tenant_id)
        async with in_transaction():
            header = await SparePartRequisition.create(
                tenant_id=tenant_id,
                requisition_no=requisition_no,
                equipment_id=equipment.id if equipment else None,
                equipment_uuid=equipment.uuid if equipment else None,
                equipment_code=equipment.code if equipment else None,
                equipment_name=equipment.name if equipment else None,
                purpose=data.purpose,
                applicant_id=data.applicant_id or operator_id,
                applicant_name=data.applicant_name or operator_name,
                remark=data.remark,
                status="草稿",
            )
            await self._replace_lines(tenant_id, header.id, data.lines)
        return header

    async def get(self, tenant_id: int, row_id: int) -> SparePartRequisition:
        row = await SparePartRequisition.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"备件领用单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[SparePartRequisition], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            SPARE_PART_REQUISITION_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        qs = SparePartRequisition.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            qs = qs.filter(status=status)
        qs = apply_equipment_keyword_filter(
            qs,
            pick_search_keyword(keyword, search),
            ["requisition_no", "equipment_name", "purpose", "applicant_name"],
        )
        qs = apply_equipment_created_date_range(
            qs,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        qs = apply_equipment_updated_date_range(
            qs,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )
        total = await qs.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            SPARE_PART_REQUISITION_SORTABLE_FIELDS,
            "-updated_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: SparePartRequisitionUpdate,
    ) -> SparePartRequisition:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可编辑")
        payload = data.model_dump(exclude_unset=True)
        lines = payload.pop("lines", None)
        if "equipment_id" in payload:
            equipment_id = payload.get("equipment_id")
            if equipment_id:
                equipment = await Equipment.filter(
                    tenant_id=tenant_id,
                    id=equipment_id,
                    deleted_at__isnull=True,
                ).first()
                if not equipment:
                    raise NotFoundError(f"设备不存在: {equipment_id}")
                row.equipment_id = equipment.id
                row.equipment_uuid = equipment.uuid
                row.equipment_code = equipment.code
                row.equipment_name = equipment.name
            else:
                row.equipment_id = None
                row.equipment_uuid = None
                row.equipment_code = None
                row.equipment_name = None
            payload.pop("equipment_id", None)
        for k, v in payload.items():
            setattr(row, k, v)
        await row.save()
        if lines is not None:
            if not lines:
                raise ValidationError("领用明细不能为空")
            await self._replace_lines(tenant_id, row.id, lines)
        return row

    async def submit(self, tenant_id: int, row_id: int) -> SparePartRequisition:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        lines = await self._load_lines(tenant_id, row.id)
        if not lines:
            raise ValidationError("领用明细不能为空")
        row.status = "已提交"
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        *,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> SparePartRequisition:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        lines = await self._load_lines(tenant_id, row.id)
        parts_payload = [
            {
                "spare_part_id": line.spare_part_id,
                "quantity": line.quantity,
                "warehouse_location": line.warehouse_location,
                "remark": line.remark,
            }
            for line in lines
        ]
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            await row.save()
            await SparePartService().apply_parts_usage(
                tenant_id,
                parts_payload,
                rel_type="spare_part_requisition",
                rel_id=row.id,
                operator_id=approver_id,
                operator_name=approver_name,
            )
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        *,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> SparePartRequisition:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可驳回")
        row.status = "已驳回"
        row.reject_reason = reject_reason
        row.approver_id = approver_id
        row.approver_name = approver_name
        row.approved_at = datetime.now()
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("草稿", "已驳回"):
            raise ValidationError("仅草稿或已驳回状态可删除")
        row.deleted_at = datetime.now()
        await row.save()
