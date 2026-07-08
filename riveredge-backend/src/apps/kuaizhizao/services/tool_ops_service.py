"""
工装运营业务服务：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from __future__ import annotations

import math
from datetime import datetime, date, timedelta, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Type, TypeVar

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.constants.tool_status import (
    TOOL_STATUS_IDLE,
    TOOL_STATUS_DISABLED,
    TOOL_STATUS_SCRAPPED,
    OPEN_MAINTENANCE_STATUSES,
    OPEN_REPAIR_STATUSES,
    OUTSTANDING_BORROW_STATUS,
)
from apps.kuaizhizao.models.tool import Tool
from apps.kuaizhizao.models.tool_ops import (
    ToolMaintenanceItem,
    ToolMaintenanceScheme,
    ToolMaintenanceSchemeLine,
    ToolRepairItem,
    ToolRepairScheme,
    ToolRepairSchemeLine,
    ToolSchemeBinding,
    ToolOpsCalibration,
    ToolScrapApplication,
    ToolBorrow,
    ToolReturn,
    ToolMaintenance,
    ToolMaintenanceLine,
    ToolRepair,
    ToolRepairLine,
)
from apps.kuaizhizao.schemas.tool_ops import (
    ToolMaintenanceItemCreate,
    ToolMaintenanceItemUpdate,
    ToolMaintenanceSchemeCreate,
    ToolMaintenanceSchemeUpdate,
    ToolMaintenanceSchemeLineCreate,
    ToolRepairItemCreate,
    ToolRepairItemUpdate,
    ToolRepairSchemeCreate,
    ToolRepairSchemeUpdate,
    ToolRepairSchemeLineCreate,
    ToolSchemeBindingCreate,
    ToolSchemeBindingBulkReplace,
    ToolBorrowCreate,
    ToolBorrowUpdate,
    ToolReturnCreate,
    ToolReturnUpdate,
    ToolMaintenanceCreate,
    ToolMaintenanceUpdate,
    ToolMaintenanceLineInput,
    ToolMaintenancePreviewResponse,
    ToolMaintenancePreviewLine,
    ToolRepairCreate,
    ToolRepairUpdate,
    ToolRepairLineInput,
    ToolRepairPreviewResponse,
    ToolRepairPreviewLine,
    ToolOpsCalibrationCreate,
    ToolOpsCalibrationUpdate,
    ToolScrapApplicationCreate,
    ToolScrapApplicationUpdate,
)
from apps.kuaizhizao.services.tool_status_service import ToolStatusService
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError

T = TypeVar("T")


def _now_doc_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}"


async def _generate_code(tenant_id: int, rule_code: str, prefix: str) -> str:
    try:
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context=None,
        )
    except ValidationError:
        return _now_doc_no(prefix)


async def _get_tool_or_raise(tenant_id: int, tool_id: int) -> Tool:
    tool = await Tool.filter(
        tenant_id=tenant_id,
        id=tool_id,
        deleted_at__isnull=True,
    ).first()
    if not tool:
        raise NotFoundError(f"工装不存在: {tool_id}")
    return tool


def _reject_scrapped_tool(tool: Tool) -> None:
    if tool.status == TOOL_STATUS_SCRAPPED:
        raise ValidationError("工装已报废，不能执行该操作")


async def _snapshot_maintenance_item(tenant_id: int, item_id: int) -> Dict[str, Any]:
    item = await ToolMaintenanceItem.filter(
        tenant_id=tenant_id,
        id=item_id,
        deleted_at__isnull=True,
    ).first()
    if not item:
        raise ValidationError(f"保养项不存在: {item_id}")
    return {
        "item_code": item.code,
        "item_name": item.name,
        "requirement": item.requirement,
        "standard_hours": item.standard_hours,
    }


async def _snapshot_repair_item(tenant_id: int, item_id: int) -> Dict[str, Any]:
    item = await ToolRepairItem.filter(
        tenant_id=tenant_id,
        id=item_id,
        deleted_at__isnull=True,
    ).first()
    if not item:
        raise ValidationError(f"维修项不存在: {item_id}")
    return {
        "item_code": item.code,
        "item_name": item.name,
        "requirement": item.requirement,
        "standard_hours": item.standard_hours,
    }


class _MasterCRUDMixin:
    model: Type[T]

    async def _list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[T], int]:
        from apps.kuaizhizao.services.equipment_list_core import apply_master_crud_list_filters

        qs = self.model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        qs, order_clause = apply_master_crud_list_filters(
            qs,
            keyword=keyword,
            search=search,
            is_active=is_active,
            order_by=order_by,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def _get(self, tenant_id: int, row_id: int) -> T:
        row = await self.model.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"记录不存在: {row_id}")
        return row

    async def _soft_delete(self, tenant_id: int, row_id: int) -> None:
        row = await self._get(tenant_id, row_id)
        row.deleted_at = datetime.now()
        await row.save()


class ToolMaintenanceItemService(_MasterCRUDMixin):
    model = ToolMaintenanceItem

    async def create(self, tenant_id: int, data: ToolMaintenanceItemCreate) -> ToolMaintenanceItem:
        dup = await ToolMaintenanceItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"保养项编码已存在: {data.code}")
        return await ToolMaintenanceItem.create(tenant_id=tenant_id, **data.model_dump())

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolMaintenanceItemUpdate,
    ) -> ToolMaintenanceItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await ToolMaintenanceItem.filter(
                tenant_id=tenant_id,
                code=update_data["code"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"保养项编码已存在: {update_data['code']}")
        for k, v in update_data.items():
            setattr(row, k, v)
        await row.save()
        return row


class ToolMaintenanceSchemeService(_MasterCRUDMixin):
    model = ToolMaintenanceScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[ToolMaintenanceSchemeLine]:
        return await ToolMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[ToolMaintenanceSchemeLineCreate],
    ) -> None:
        await ToolMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=datetime.now())
        for idx, line in enumerate(lines):
            snap = await _snapshot_maintenance_item(tenant_id, line.item_id)
            await ToolMaintenanceSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                standard_hours=line.standard_hours or snap["standard_hours"],
            )

    async def create(self, tenant_id: int, data: ToolMaintenanceSchemeCreate) -> ToolMaintenanceScheme:
        async with in_transaction():
            dup = await ToolMaintenanceScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"保养方案编码已存在: {data.code}")
            scheme = await ToolMaintenanceScheme.create(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                description=data.description,
                trigger_type=data.trigger_type,
                trigger_interval_days=data.trigger_interval_days,
                trigger_interval_usage=data.trigger_interval_usage,
                is_active=data.is_active,
            )
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolMaintenanceSchemeUpdate,
    ) -> ToolMaintenanceScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await ToolMaintenanceScheme.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"保养方案编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(scheme, k, v)
            await scheme.save()
            if data.lines is not None:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def get_with_lines(
        self,
        tenant_id: int,
        row_id: int,
    ) -> tuple[ToolMaintenanceScheme, List[ToolMaintenanceSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class ToolRepairItemService(_MasterCRUDMixin):
    model = ToolRepairItem

    async def create(self, tenant_id: int, data: ToolRepairItemCreate) -> ToolRepairItem:
        dup = await ToolRepairItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"维修项编码已存在: {data.code}")
        return await ToolRepairItem.create(tenant_id=tenant_id, **data.model_dump())

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolRepairItemUpdate,
    ) -> ToolRepairItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await ToolRepairItem.filter(
                tenant_id=tenant_id,
                code=update_data["code"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"维修项编码已存在: {update_data['code']}")
        for k, v in update_data.items():
            setattr(row, k, v)
        await row.save()
        return row


class ToolRepairSchemeService(_MasterCRUDMixin):
    model = ToolRepairScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[ToolRepairSchemeLine]:
        return await ToolRepairSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[ToolRepairSchemeLineCreate],
    ) -> None:
        await ToolRepairSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=datetime.now())
        for idx, line in enumerate(lines):
            snap = await _snapshot_repair_item(tenant_id, line.item_id)
            await ToolRepairSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                standard_hours=line.standard_hours or snap["standard_hours"],
            )

    async def create(self, tenant_id: int, data: ToolRepairSchemeCreate) -> ToolRepairScheme:
        async with in_transaction():
            dup = await ToolRepairScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"维修方案编码已存在: {data.code}")
            scheme = await ToolRepairScheme.create(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                description=data.description,
                is_active=data.is_active,
            )
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolRepairSchemeUpdate,
    ) -> ToolRepairScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await ToolRepairScheme.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"维修方案编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(scheme, k, v)
            await scheme.save()
            if data.lines is not None:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def get_with_lines(
        self,
        tenant_id: int,
        row_id: int,
    ) -> tuple[ToolRepairScheme, List[ToolRepairSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class ToolSchemeBindingService:
    async def list_by_tool(
        self,
        tenant_id: int,
        tool_id: int,
        scheme_type: Optional[str] = None,
    ) -> List[ToolSchemeBinding]:
        qs = ToolSchemeBinding.filter(
            tenant_id=tenant_id,
            tool_id=tool_id,
            deleted_at__isnull=True,
        )
        if scheme_type:
            qs = qs.filter(scheme_type=scheme_type)
        return await qs.order_by("id").all()

    async def create(self, tenant_id: int, data: ToolSchemeBindingCreate) -> ToolSchemeBinding:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        return await ToolSchemeBinding.create(
            tenant_id=tenant_id,
            tool_id=tool.id,
            tool_uuid=tool.uuid,
            scheme_id=data.scheme_id,
            scheme_type=data.scheme_type,
        )

    async def bulk_replace(
        self,
        tenant_id: int,
        data: ToolSchemeBindingBulkReplace,
    ) -> List[ToolSchemeBinding]:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        async with in_transaction():
            await ToolSchemeBinding.filter(
                tenant_id=tenant_id,
                tool_id=tool.id,
                scheme_type=data.scheme_type,
                deleted_at__isnull=True,
            ).update(deleted_at=datetime.now())
            bindings = []
            for scheme_id in data.scheme_ids:
                binding = await ToolSchemeBinding.create(
                    tenant_id=tenant_id,
                    tool_id=tool.id,
                    tool_uuid=tool.uuid,
                    scheme_id=scheme_id,
                    scheme_type=data.scheme_type,
                )
                bindings.append(binding)
            return bindings

    async def delete(self, tenant_id: int, binding_id: int) -> None:
        binding = await ToolSchemeBinding.filter(
            tenant_id=tenant_id,
            id=binding_id,
            deleted_at__isnull=True,
        ).first()
        if not binding:
            raise NotFoundError(f"绑定记录不存在: {binding_id}")
        binding.deleted_at = datetime.now()
        await binding.save()


class ToolBorrowService:
    async def _has_outstanding(self, tenant_id: int, tool_id: int) -> bool:
        return await ToolBorrow.filter(
            tenant_id=tenant_id,
            tool_id=tool_id,
            status=OUTSTANDING_BORROW_STATUS,
            deleted_at__isnull=True,
        ).exists()

    async def create(
        self,
        tenant_id: int,
        data: ToolBorrowCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolBorrow:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)
        if tool.status != TOOL_STATUS_IDLE:
            raise ValidationError(f"工装当前状态为「{tool.status}」，仅「待用」状态可领用")
        if not tool.allow_repeated_borrow and await self._has_outstanding(tenant_id, tool.id):
            raise ValidationError("该工装存在未归还领用单，且不允许重复领用")

        document_no = await _generate_code(tenant_id, "tool_borrow_code", "MB")
        async with in_transaction():
            borrow = await ToolBorrow.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                borrow_date=data.borrow_date or datetime.now(),
                borrower_id=data.borrower_id or operator_id,
                borrower_name=data.borrower_name or operator_name,
                department_name=data.department_name,
                expected_return_date=data.expected_return_date,
                source_type=data.source_type,
                source_id=data.source_id,
                source_no=data.source_no,
                remark=data.remark,
                status=OUTSTANDING_BORROW_STATUS,
            )
            await ToolStatusService.resolve(tenant_id, tool.id)
            return borrow

    async def get(self, tenant_id: int, row_id: int) -> ToolBorrow:
        row = await ToolBorrow.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"领用单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolBorrow], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            TOOL_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=TOOL_WORKFLOW_KEYWORD_FIELDS,
            date_field="borrow_date",
            date_start=doc_start_date,
            date_end=doc_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def list_outstanding(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
    ) -> tuple[List[ToolBorrow], int]:
        return await self.list(
            tenant_id,
            skip,
            limit,
            tool_id=tool_id,
            status=OUTSTANDING_BORROW_STATUS,
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolBorrowUpdate,
    ) -> ToolBorrow:
        row = await self.get(tenant_id, row_id)
        if row.status != OUTSTANDING_BORROW_STATUS:
            raise ValidationError("仅领用中状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status != OUTSTANDING_BORROW_STATUS:
                raise ValidationError("仅领用中状态可删除")
            tool_id = row.tool_id
            row.deleted_at = datetime.now()
            await row.save()
            await ToolStatusService.resolve(tenant_id, tool_id)


class ToolReturnService:
    async def create(
        self,
        tenant_id: int,
        data: ToolReturnCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolReturn:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)

        if data.reporting_record_id is not None:
            existing = await ToolReturn.filter(
                tenant_id=tenant_id,
                reporting_record_id=data.reporting_record_id,
                deleted_at__isnull=True,
            ).first()
            if existing:
                return existing

        borrow: Optional[ToolBorrow] = None
        if data.borrow_id is not None:
            borrow = await ToolBorrow.filter(
                tenant_id=tenant_id,
                id=data.borrow_id,
                deleted_at__isnull=True,
            ).first()
            if not borrow:
                raise ValidationError(f"领用单不存在: {data.borrow_id}")
            if borrow.status != OUTSTANDING_BORROW_STATUS:
                raise ValidationError("关联领用单已归还")
        else:
            borrow = await ToolBorrow.filter(
                tenant_id=tenant_id,
                tool_id=tool.id,
                status=OUTSTANDING_BORROW_STATUS,
                deleted_at__isnull=True,
            ).order_by("-id").first()

        document_no = await _generate_code(tenant_id, "tool_return_code", "MR")
        async with in_transaction():
            ret = await ToolReturn.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                borrow_id=borrow.id if borrow else None,
                return_date=data.return_date or datetime.now(),
                usage_count=data.usage_count,
                operator_id=data.operator_id or operator_id,
                operator_name=data.operator_name or operator_name,
                source_type=data.source_type,
                source_id=data.source_id,
                source_no=data.source_no,
                reporting_record_id=data.reporting_record_id,
                remark=data.remark,
                status="已完成",
            )
            tool.total_usage_count = (tool.total_usage_count or 0) + data.usage_count
            await tool.save()
            if borrow:
                borrow.status = "已归还"
                await borrow.save()
            await ToolStatusService.resolve(tenant_id, tool.id)
            return ret

    async def get(self, tenant_id: int, row_id: int) -> ToolReturn:
        row = await ToolReturn.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"归还单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolReturn], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            TOOL_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=TOOL_WORKFLOW_KEYWORD_FIELDS,
            date_field="return_date",
            date_start=doc_start_date,
            date_end=doc_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolReturnUpdate,
    ) -> ToolReturn:
        row = await self.get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "usage_count" in update_data and update_data["usage_count"] != row.usage_count:
            tool = await _get_tool_or_raise(tenant_id, row.tool_id)
            tool.total_usage_count = max(
                0,
                (tool.total_usage_count or 0) - row.usage_count + update_data["usage_count"],
            )
            await tool.save()
        for k, v in update_data.items():
            setattr(row, k, v)
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            tool = await _get_tool_or_raise(tenant_id, row.tool_id)
            tool.total_usage_count = max(0, (tool.total_usage_count or 0) - row.usage_count)
            await tool.save()
            if row.borrow_id:
                borrow = await ToolBorrow.filter(
                    tenant_id=tenant_id,
                    id=row.borrow_id,
                    deleted_at__isnull=True,
                ).first()
                if borrow:
                    borrow.status = OUTSTANDING_BORROW_STATUS
                    await borrow.save()
            row.deleted_at = datetime.now()
            await row.save()
            await ToolStatusService.resolve(tenant_id, tool.id)


class ToolMaintenanceService:
    scheme_service = ToolMaintenanceSchemeService()

    async def _resolve_scheme_id(
        self,
        tenant_id: int,
        tool: Tool,
        scheme_id: Optional[int],
    ) -> int:
        if scheme_id:
            return scheme_id
        if tool.maintenance_scheme_id:
            return tool.maintenance_scheme_id
        binding = await ToolSchemeBinding.filter(
            tenant_id=tenant_id,
            tool_id=tool.id,
            scheme_type="maintenance",
            deleted_at__isnull=True,
        ).order_by("id").first()
        if binding:
            return binding.scheme_id
        raise ValidationError("未指定保养方案，且工装未绑定默认保养方案")

    async def preview_lines(
        self,
        tenant_id: int,
        tool_id: int,
        scheme_id: Optional[int] = None,
    ) -> ToolMaintenancePreviewResponse:
        tool = await _get_tool_or_raise(tenant_id, tool_id)
        resolved_scheme_id = await self._resolve_scheme_id(tenant_id, tool, scheme_id)
        scheme, lines = await self.scheme_service.get_with_lines(tenant_id, resolved_scheme_id)
        preview_lines = [
            ToolMaintenancePreviewLine(
                line_no=idx + 1,
                item_id=sl.item_id,
                item_code=sl.item_code,
                item_name=sl.item_name,
                requirement=sl.requirement,
                standard_hours=sl.standard_hours,
            )
            for idx, sl in enumerate(lines)
        ]
        return ToolMaintenancePreviewResponse(
            tool_id=tool.id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, maintenance_id: int) -> List[ToolMaintenanceLine]:
        return await ToolMaintenanceLine.filter(
            tenant_id=tenant_id,
            maintenance_id=maintenance_id,
            deleted_at__isnull=True,
        ).order_by("line_no", "id").all()

    async def _create_lines(
        self,
        tenant_id: int,
        maintenance_id: int,
        lines: List[ToolMaintenanceLineInput],
    ) -> None:
        for line in lines:
            await ToolMaintenanceLine.create(
                tenant_id=tenant_id,
                maintenance_id=maintenance_id,
                line_no=line.line_no,
                item_id=line.item_id,
                item_code=line.item_code,
                item_name=line.item_name,
                requirement=line.requirement,
                standard_hours=line.standard_hours,
                is_done=line.is_done,
                result_value=line.result_value,
                remark=line.remark,
            )

    async def create(
        self,
        tenant_id: int,
        data: ToolMaintenanceCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolMaintenance:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)
        scheme_id = await self._resolve_scheme_id(tenant_id, tool, data.scheme_id)
        document_no = await _generate_code(tenant_id, "tool_maintenance_code", "MM")
        async with in_transaction():
            header = await ToolMaintenance.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                scheme_id=scheme_id,
                planned_date=data.planned_date,
                maintenance_date=data.maintenance_date,
                applicant_id=data.applicant_id or operator_id,
                applicant_name=data.applicant_name or operator_name,
                remark=data.remark,
                status="草稿",
            )
            if data.lines:
                await self._create_lines(tenant_id, header.id, data.lines)
            else:
                preview = await self.preview_lines(tenant_id, tool.id, scheme_id)
                await self._create_lines(
                    tenant_id,
                    header.id,
                    [
                        ToolMaintenanceLineInput(
                            line_no=pl.line_no,
                            item_id=pl.item_id,
                            item_code=pl.item_code,
                            item_name=pl.item_name,
                            requirement=pl.requirement,
                            standard_hours=pl.standard_hours,
                        )
                        for pl in preview.lines
                    ],
                )
            return header

    async def get(self, tenant_id: int, row_id: int) -> ToolMaintenance:
        row = await ToolMaintenance.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"保养单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolMaintenance], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            TOOL_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolMaintenance.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=TOOL_WORKFLOW_KEYWORD_FIELDS,
            date_field="maintenance_date",
            date_start=doc_start_date,
            date_end=doc_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolMaintenanceUpdate,
    ) -> ToolMaintenance:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            if header.status != "草稿":
                raise ValidationError("仅草稿状态可编辑")
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            await header.save()
            if data.lines is not None:
                await ToolMaintenanceLine.filter(
                    tenant_id=tenant_id,
                    maintenance_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=datetime.now())
                await self._create_lines(tenant_id, header.id, data.lines)
            return header

    async def submit(self, tenant_id: int, row_id: int) -> ToolMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        async with in_transaction():
            row.status = "进行中"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            if not row.maintenance_date:
                row.maintenance_date = date.today()
            await row.save()
            await ToolStatusService.resolve(tenant_id, row.tool_id)
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolMaintenance:
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

    async def complete(self, tenant_id: int, row_id: int) -> ToolMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("进行中", "已审核"):
            raise ValidationError("仅进行中状态可完修")
        async with in_transaction():
            row.status = "已完成"
            row.completed_at = datetime.now()
            if not row.maintenance_date:
                row.maintenance_date = date.today()
            await row.save()
            tool = await _get_tool_or_raise(tenant_id, row.tool_id)
            tool.last_maintenance_date = row.maintenance_date
            await tool.save()
            await ToolStatusService.resolve(tenant_id, row.tool_id)
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status not in ("草稿", "已驳回"):
                raise ValidationError("仅草稿或已驳回状态可删除")
            tool_id = row.tool_id
            row.deleted_at = datetime.now()
            await row.save()
            if row.status in OPEN_MAINTENANCE_STATUSES:
                await ToolStatusService.resolve(tenant_id, tool_id)


class ToolRepairService:
    scheme_service = ToolRepairSchemeService()

    async def _resolve_scheme_id(
        self,
        tenant_id: int,
        tool: Tool,
        scheme_id: Optional[int],
    ) -> int:
        if scheme_id:
            return scheme_id
        if tool.repair_scheme_id:
            return tool.repair_scheme_id
        binding = await ToolSchemeBinding.filter(
            tenant_id=tenant_id,
            tool_id=tool.id,
            scheme_type="repair",
            deleted_at__isnull=True,
        ).order_by("id").first()
        if binding:
            return binding.scheme_id
        raise ValidationError("未指定维修方案，且工装未绑定默认维修方案")

    async def preview_lines(
        self,
        tenant_id: int,
        tool_id: int,
        scheme_id: Optional[int] = None,
    ) -> ToolRepairPreviewResponse:
        tool = await _get_tool_or_raise(tenant_id, tool_id)
        resolved_scheme_id = await self._resolve_scheme_id(tenant_id, tool, scheme_id)
        scheme, lines = await self.scheme_service.get_with_lines(tenant_id, resolved_scheme_id)
        preview_lines = [
            ToolRepairPreviewLine(
                line_no=idx + 1,
                item_id=sl.item_id,
                item_code=sl.item_code,
                item_name=sl.item_name,
                requirement=sl.requirement,
                standard_hours=sl.standard_hours,
            )
            for idx, sl in enumerate(lines)
        ]
        return ToolRepairPreviewResponse(
            tool_id=tool.id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, repair_id: int) -> List[ToolRepairLine]:
        return await ToolRepairLine.filter(
            tenant_id=tenant_id,
            repair_id=repair_id,
            deleted_at__isnull=True,
        ).order_by("line_no", "id").all()

    async def _create_lines(
        self,
        tenant_id: int,
        repair_id: int,
        lines: List[ToolRepairLineInput],
    ) -> None:
        for line in lines:
            await ToolRepairLine.create(
                tenant_id=tenant_id,
                repair_id=repair_id,
                line_no=line.line_no,
                item_id=line.item_id,
                item_code=line.item_code,
                item_name=line.item_name,
                requirement=line.requirement,
                standard_hours=line.standard_hours,
                is_done=line.is_done,
                result_value=line.result_value,
                remark=line.remark,
            )

    async def create(
        self,
        tenant_id: int,
        data: ToolRepairCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolRepair:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)
        scheme_id = await self._resolve_scheme_id(tenant_id, tool, data.scheme_id)
        document_no = await _generate_code(tenant_id, "tool_repair_code", "MRP")
        async with in_transaction():
            header = await ToolRepair.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                scheme_id=scheme_id,
                fault_description=data.fault_description,
                planned_date=data.planned_date,
                repair_date=data.repair_date,
                applicant_id=data.applicant_id or operator_id,
                applicant_name=data.applicant_name or operator_name,
                remark=data.remark,
                status="草稿",
            )
            if data.lines:
                await self._create_lines(tenant_id, header.id, data.lines)
            else:
                preview = await self.preview_lines(tenant_id, tool.id, scheme_id)
                await self._create_lines(
                    tenant_id,
                    header.id,
                    [
                        ToolRepairLineInput(
                            line_no=pl.line_no,
                            item_id=pl.item_id,
                            item_code=pl.item_code,
                            item_name=pl.item_name,
                            requirement=pl.requirement,
                            standard_hours=pl.standard_hours,
                        )
                        for pl in preview.lines
                    ],
                )
            return header

    async def get(self, tenant_id: int, row_id: int) -> ToolRepair:
        row = await ToolRepair.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"维修单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolRepair], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            TOOL_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=TOOL_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=TOOL_WORKFLOW_KEYWORD_FIELDS,
            date_field="repair_date",
            date_start=doc_start_date,
            date_end=doc_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolRepairUpdate,
    ) -> ToolRepair:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            if header.status != "草稿":
                raise ValidationError("仅草稿状态可编辑")
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            await header.save()
            if data.lines is not None:
                await ToolRepairLine.filter(
                    tenant_id=tenant_id,
                    repair_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=datetime.now())
                await self._create_lines(tenant_id, header.id, data.lines)
            return header

    async def submit(self, tenant_id: int, row_id: int) -> ToolRepair:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolRepair:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        async with in_transaction():
            row.status = "进行中"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            if not row.repair_date:
                row.repair_date = date.today()
            await row.save()
            await ToolStatusService.resolve(tenant_id, row.tool_id)
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolRepair:
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

    async def complete(self, tenant_id: int, row_id: int) -> ToolRepair:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("进行中", "已审核"):
            raise ValidationError("仅进行中状态可完修")
        async with in_transaction():
            row.status = "已完成"
            row.completed_at = datetime.now()
            if not row.repair_date:
                row.repair_date = date.today()
            await row.save()
            await ToolStatusService.resolve(tenant_id, row.tool_id)
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status not in ("草稿", "已驳回"):
                raise ValidationError("仅草稿或已驳回状态可删除")
            tool_id = row.tool_id
            row.deleted_at = datetime.now()
            await row.save()
            if row.status in OPEN_REPAIR_STATUSES:
                await ToolStatusService.resolve(tenant_id, tool_id)




class ToolOpsCalibrationService:
    async def create(
        self,
        tenant_id: int,
        data: ToolOpsCalibrationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolOpsCalibration:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)
        document_no = await _generate_code(tenant_id, "tool_calibration_code", "TC")
        async with in_transaction():
            row = await ToolOpsCalibration.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                calibration_date=data.calibration_date or date.today(),
                calibration_org=data.calibration_org,
                certificate_no=data.certificate_no,
                result=data.result,
                expiry_date=data.expiry_date,
                operator_id=data.operator_id or operator_id,
                operator_name=data.operator_name or operator_name,
                attachment_uuid=data.attachment_uuid,
                remark=data.remark,
                status="进行中",
            )
            await ToolStatusService.resolve(tenant_id, tool.id)
            return row

    async def create_effective(
        self,
        tenant_id: int,
        data: ToolOpsCalibrationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolOpsCalibration:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        _reject_scrapped_tool(tool)
        document_no = await _generate_code(tenant_id, "tool_calibration_code", "TC")
        cal_date = data.calibration_date or date.today()
        async with in_transaction():
            row = await ToolOpsCalibration.create(
                tenant_id=tenant_id,
                document_no=document_no,
                tool_id=tool.id,
                tool_uuid=tool.uuid,
                tool_code=tool.code,
                tool_name=tool.name,
                calibration_date=cal_date,
                calibration_org=data.calibration_org,
                certificate_no=data.certificate_no,
                result=data.result,
                expiry_date=data.expiry_date,
                operator_id=data.operator_id or operator_id,
                operator_name=data.operator_name or operator_name,
                attachment_uuid=data.attachment_uuid,
                remark=data.remark,
                status="已完成",
            )
            tool.last_calibration_date = cal_date
            if data.expiry_date:
                tool.next_calibration_date = data.expiry_date
            elif tool.calibration_period:
                tool.next_calibration_date = cal_date + timedelta(days=tool.calibration_period)
            if data.result == "不合格":
                tool.status = TOOL_STATUS_DISABLED
            else:
                await ToolStatusService.resolve(tenant_id, tool.id, persist=False)
            await tool.save()
            return row

    async def get(self, tenant_id: int, row_id: int) -> ToolOpsCalibration:
        row = await ToolOpsCalibration.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"校验单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolOpsCalibration], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            TOOL_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolOpsCalibration.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            keyword_fields=TOOL_WORKFLOW_KEYWORD_FIELDS,
            date_field="calibration_date",
            date_start=doc_start_date,
            date_end=doc_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolOpsCalibrationUpdate,
    ) -> ToolOpsCalibration:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            for k, v in data.model_dump(exclude_unset=True).items():
                setattr(row, k, v)
            await row.save()
            if row.status != "进行中":
                await ToolStatusService.resolve(tenant_id, row.tool_id)
            return row

    async def complete(self, tenant_id: int, row_id: int) -> ToolOpsCalibration:
        row = await self.get(tenant_id, row_id)
        if row.status != "进行中":
            raise ValidationError("仅进行中状态可完成")
        tool = await _get_tool_or_raise(tenant_id, row.tool_id)
        async with in_transaction():
            row.status = "已完成"
            await row.save()
            tool.last_calibration_date = row.calibration_date
            if row.expiry_date:
                tool.next_calibration_date = row.expiry_date
            elif tool.calibration_period:
                tool.next_calibration_date = row.calibration_date + timedelta(days=tool.calibration_period)
            if row.result == "不合格":
                tool.status = TOOL_STATUS_DISABLED
            else:
                await ToolStatusService.resolve(tenant_id, tool.id, persist=False)
            await tool.save()
            return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            tool_id = row.tool_id
            row.deleted_at = datetime.now()
            await row.save()
            await ToolStatusService.resolve(tenant_id, tool_id)


class ToolScrapApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: ToolScrapApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> ToolScrapApplication:
        tool = await _get_tool_or_raise(tenant_id, data.tool_id)
        if tool.status == TOOL_STATUS_SCRAPPED:
            raise ValidationError("工装已报废，不能重复申请")
        application_no = await _generate_code(tenant_id, "tool_scrap_application_code", "TSA")
        return await ToolScrapApplication.create(
            tenant_id=tenant_id,
            application_no=application_no,
            tool_id=tool.id,
            tool_uuid=tool.uuid,
            tool_code=tool.code,
            tool_name=tool.name,
            reason=data.reason,
            scrap_date=data.scrap_date,
            applicant_id=data.applicant_id or operator_id,
            applicant_name=data.applicant_name or operator_name,
            remark=data.remark,
            attachments=data.attachments,
            status="草稿",
        )

    async def get(self, tenant_id: int, row_id: int) -> ToolScrapApplication:
        row = await ToolScrapApplication.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"报废申请不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[ToolScrapApplication], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_SCRAP_SORTABLE_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = ToolScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            qs = qs.filter(tool_id=tool_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=TOOL_SCRAP_SORTABLE_FIELDS,
            keyword_fields=["application_no", "tool_code", "tool_name", "reason"],
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await qs.count()
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ToolScrapApplicationUpdate,
    ) -> ToolScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await row.save()
        return row

    async def submit(self, tenant_id: int, row_id: int) -> ToolScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        tool = await _get_tool_or_raise(tenant_id, row.tool_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            if not row.scrap_date:
                row.scrap_date = date.today()
            await row.save()
            tool.status = TOOL_STATUS_SCRAPPED
            await tool.save()
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> ToolScrapApplication:
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

class ToolOpsReportService:
    async def calibration_alerts(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        reminder_type: Optional[str] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        from apps.kuaizhizao.services.tool_service import ToolMaintenanceReminderService

        items, total = await ToolMaintenanceReminderService.list_calibration_alerts(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            due_type=reminder_type,
        )
        return items, total

    async def maintenance_alerts(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        reminder_type: Optional[str] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        from apps.kuaizhizao.services.tool_service import ToolMaintenanceReminderService

        items, total = await ToolMaintenanceReminderService.list_reminders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            reminder_type=reminder_type,
        )
        return items, total

    async def borrow_return_log(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        tool_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        borrow_qs = ToolBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        return_qs = ToolReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if tool_id is not None:
            borrow_qs = borrow_qs.filter(tool_id=tool_id)
            return_qs = return_qs.filter(tool_id=tool_id)
        if date_from:
            borrow_qs = borrow_qs.filter(borrow_date__gte=date_from)
            return_qs = return_qs.filter(return_date__gte=date_from)
        if date_to:
            borrow_qs = borrow_qs.filter(borrow_date__lte=date_to)
            return_qs = return_qs.filter(return_date__lte=date_to)

        borrows = await borrow_qs.all()
        returns = await return_qs.all()
        borrow_map = {b.id: b.document_no for b in borrows}

        logs: List[Dict[str, Any]] = []
        for b in borrows:
            logs.append({
                "log_type": "borrow",
                "document_no": b.document_no,
                "tool_code": b.tool_code,
                "tool_name": b.tool_name,
                "event_date": b.borrow_date,
                "operator_name": b.borrower_name,
                "usage_count": None,
                "status": b.status,
                "related_document_no": None,
            })
        for r in returns:
            logs.append({
                "log_type": "return",
                "document_no": r.document_no,
                "tool_code": r.tool_code,
                "tool_name": r.tool_name,
                "event_date": r.return_date,
                "operator_name": r.operator_name,
                "usage_count": r.usage_count,
                "status": r.status,
                "related_document_no": borrow_map.get(r.borrow_id) if r.borrow_id else None,
            })
        logs.sort(key=lambda x: x["event_date"], reverse=True)
        total = len(logs)
        return logs[skip : skip + limit], total

    async def repair_analysis(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        qs = ToolRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if date_from:
            qs = qs.filter(repair_date__gte=date_from)
        if date_to:
            qs = qs.filter(repair_date__lte=date_to)
        repairs = await qs.all()
        stats: Dict[int, Dict[str, Any]] = {}
        for r in repairs:
            bucket = stats.setdefault(
                r.tool_id,
                {
                    "tool_code": r.tool_code,
                    "tool_name": r.tool_name,
                    "repair_count": 0,
                    "completed_count": 0,
                    "completion_days": [],
                },
            )
            bucket["repair_count"] += 1
            if r.status == "已完成":
                bucket["completed_count"] += 1
                if r.approved_at and r.completed_at:
                    days = (r.completed_at.date() - r.approved_at.date()).days
                    bucket["completion_days"].append(max(0, days))

        items = []
        for bucket in stats.values():
            avg_days = None
            if bucket["completion_days"]:
                avg_days = sum(bucket["completion_days"]) / len(bucket["completion_days"])
            items.append({
                "tool_code": bucket["tool_code"],
                "tool_name": bucket["tool_name"],
                "repair_count": bucket["repair_count"],
                "completed_count": bucket["completed_count"],
                "avg_completion_days": avg_days,
            })
        items.sort(key=lambda x: x["repair_count"], reverse=True)
        total = len(items)
        return items[skip : skip + limit], total


class ToolOpsService:
    """工装运营服务聚合入口。"""

    maintenance_item_service = ToolMaintenanceItemService()
    maintenance_scheme_service = ToolMaintenanceSchemeService()
    repair_item_service = ToolRepairItemService()
    repair_scheme_service = ToolRepairSchemeService()
    scheme_binding_service = ToolSchemeBindingService()
    borrow_service = ToolBorrowService()
    return_service = ToolReturnService()
    maintenance_service = ToolMaintenanceService()
    repair_service = ToolRepairService()
    calibration_service = ToolOpsCalibrationService()
    scrap_application_service = ToolScrapApplicationService()
    report_service = ToolOpsReportService()
