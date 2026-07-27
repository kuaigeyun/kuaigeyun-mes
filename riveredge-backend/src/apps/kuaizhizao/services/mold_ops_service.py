"""
模具运营业务服务：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from __future__ import annotations

import math
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Type, TypeVar

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.constants.mold_status import (
    MOLD_STATUS_IDLE,
    MOLD_STATUS_SCRAPPED,
    OPEN_MAINTENANCE_STATUSES,
    OPEN_REPAIR_STATUSES,
    OUTSTANDING_BORROW_STATUS,
)
from apps.kuaizhizao.models.mold import Mold
from apps.kuaizhizao.models.mold_ops import (
    MoldMaintenanceItem,
    MoldMaintenanceScheme,
    MoldMaintenanceSchemeLine,
    MoldRepairItem,
    MoldRepairScheme,
    MoldRepairSchemeLine,
    MoldSchemeBinding,
    MoldTrial,
    MoldBorrow,
    MoldReturn,
    MoldMaintenance,
    MoldMaintenanceLine,
    MoldRepair,
    MoldRepairLine,
    MoldScrapApplication,
)
from apps.kuaizhizao.schemas.mold_ops import (
    MoldMaintenanceItemCreate,
    MoldMaintenanceItemUpdate,
    MoldMaintenanceSchemeCreate,
    MoldMaintenanceSchemeUpdate,
    MoldMaintenanceSchemeLineCreate,
    MoldRepairItemCreate,
    MoldRepairItemUpdate,
    MoldRepairSchemeCreate,
    MoldRepairSchemeUpdate,
    MoldRepairSchemeLineCreate,
    MoldSchemeBindingCreate,
    MoldSchemeBindingBulkReplace,
    MoldTrialCreate,
    MoldTrialUpdate,
    MoldBorrowCreate,
    MoldBorrowUpdate,
    MoldReturnCreate,
    MoldReturnUpdate,
    MoldMaintenanceCreate,
    MoldMaintenanceUpdate,
    MoldMaintenanceLineInput,
    MoldMaintenancePreviewResponse,
    MoldMaintenancePreviewLine,
    MoldRepairCreate,
    MoldRepairUpdate,
    MoldRepairLineInput,
    MoldRepairPreviewResponse,
    MoldRepairPreviewLine,
    MoldScrapApplicationCreate,
    MoldScrapApplicationUpdate,
)
from apps.kuaizhizao.services.mold_status_service import MoldStatusService
from core.services.business.code_generation_service import CodeGenerationService
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

T = TypeVar("T")


def _now_doc_no(prefix: str) -> str:
    return f"{prefix}{resolve_business_datetime().strftime('%Y%m%d%H%M%S')}"


async def _generate_code(tenant_id: int, rule_code: str, prefix: str) -> str:
    try:
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context=None,
        )
    except ValidationError:
        return _now_doc_no(prefix)


async def _get_mold_or_raise(tenant_id: int, mold_id: int) -> Mold:
    mold = await Mold.filter(
        tenant_id=tenant_id,
        id=mold_id,
        deleted_at__isnull=True,
    ).first()
    if not mold:
        raise NotFoundError(f"模具不存在: {mold_id}")
    return mold


def _reject_scrapped_mold(mold: Mold) -> None:
    if mold.status == MOLD_STATUS_SCRAPPED:
        raise ValidationError("模具已报废，不能执行该操作")


async def _snapshot_maintenance_item(tenant_id: int, item_id: int) -> Dict[str, Any]:
    item = await MoldMaintenanceItem.filter(
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
    item = await MoldRepairItem.filter(
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
        row.deleted_at = resolve_business_datetime()
        await row.save()


class MoldMaintenanceItemService(_MasterCRUDMixin):
    model = MoldMaintenanceItem

    async def create(self, tenant_id: int, data: MoldMaintenanceItemCreate, current_user: Optional[User] = None) -> MoldMaintenanceItem:
        dup = await MoldMaintenanceItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"保养项编码已存在: {data.code}")
        payload = data.model_dump()
        apply_create_audit(payload, current_user)
        return await MoldMaintenanceItem.create(tenant_id=tenant_id, **payload)

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MoldMaintenanceItemUpdate,
        current_user: Optional[User] = None,
    ) -> MoldMaintenanceItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await MoldMaintenanceItem.filter(
                tenant_id=tenant_id,
                code=update_data["code"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"保养项编码已存在: {update_data['code']}")
        for k, v in update_data.items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        await row.save()
        return row


class MoldMaintenanceSchemeService(_MasterCRUDMixin):
    model = MoldMaintenanceScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[MoldMaintenanceSchemeLine]:
        return await MoldMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[MoldMaintenanceSchemeLineCreate],
    ) -> None:
        await MoldMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=resolve_business_datetime())
        for idx, line in enumerate(lines):
            snap = await _snapshot_maintenance_item(tenant_id, line.item_id)
            await MoldMaintenanceSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                standard_hours=line.standard_hours or snap["standard_hours"],
            )

    async def create(self, tenant_id: int, data: MoldMaintenanceSchemeCreate, current_user: Optional[User] = None) -> MoldMaintenanceScheme:
        async with in_transaction():
            dup = await MoldMaintenanceScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"保养方案编码已存在: {data.code}")
            payload = dict(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                description=data.description,
                trigger_type=data.trigger_type,
                trigger_interval_days=data.trigger_interval_days,
                trigger_interval_usage=data.trigger_interval_usage,
                is_active=data.is_active,
            )
            apply_create_audit(payload, current_user)
            scheme = await MoldMaintenanceScheme.create(**payload)
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MoldMaintenanceSchemeUpdate,
        current_user: Optional[User] = None,
    ) -> MoldMaintenanceScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await MoldMaintenanceScheme.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"保养方案编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(scheme, k, v)
            apply_update_audit(scheme, current_user)
            await scheme.save()
            if data.lines is not None:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def get_with_lines(
        self,
        tenant_id: int,
        row_id: int,
    ) -> tuple[MoldMaintenanceScheme, List[MoldMaintenanceSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class MoldRepairItemService(_MasterCRUDMixin):
    model = MoldRepairItem

    async def create(self, tenant_id: int, data: MoldRepairItemCreate, current_user: Optional[User] = None) -> MoldRepairItem:
        dup = await MoldRepairItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"维修项编码已存在: {data.code}")
        payload = data.model_dump()
        apply_create_audit(payload, current_user)
        return await MoldRepairItem.create(tenant_id=tenant_id, **payload)

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MoldRepairItemUpdate,
        current_user: Optional[User] = None,
    ) -> MoldRepairItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await MoldRepairItem.filter(
                tenant_id=tenant_id,
                code=update_data["code"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"维修项编码已存在: {update_data['code']}")
        for k, v in update_data.items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        await row.save()
        return row


class MoldRepairSchemeService(_MasterCRUDMixin):
    model = MoldRepairScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[MoldRepairSchemeLine]:
        return await MoldRepairSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[MoldRepairSchemeLineCreate],
    ) -> None:
        await MoldRepairSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=resolve_business_datetime())
        for idx, line in enumerate(lines):
            snap = await _snapshot_repair_item(tenant_id, line.item_id)
            await MoldRepairSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                standard_hours=line.standard_hours or snap["standard_hours"],
            )

    async def create(self, tenant_id: int, data: MoldRepairSchemeCreate, current_user: Optional[User] = None) -> MoldRepairScheme:
        async with in_transaction():
            dup = await MoldRepairScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"维修方案编码已存在: {data.code}")
            payload = dict(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                description=data.description,
                is_active=data.is_active,
            )
            apply_create_audit(payload, current_user)
            scheme = await MoldRepairScheme.create(**payload)
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MoldRepairSchemeUpdate,
        current_user: Optional[User] = None,
    ) -> MoldRepairScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await MoldRepairScheme.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"维修方案编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(scheme, k, v)
            apply_update_audit(scheme, current_user)
            await scheme.save()
            if data.lines is not None:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def get_with_lines(
        self,
        tenant_id: int,
        row_id: int,
    ) -> tuple[MoldRepairScheme, List[MoldRepairSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class MoldSchemeBindingService:
    async def list_by_mold(
        self,
        tenant_id: int,
        mold_id: int,
        scheme_type: Optional[str] = None,
    ) -> List[MoldSchemeBinding]:
        qs = MoldSchemeBinding.filter(
            tenant_id=tenant_id,
            mold_id=mold_id,
            deleted_at__isnull=True,
        )
        if scheme_type:
            qs = qs.filter(scheme_type=scheme_type)
        return await qs.order_by("id").all()

    async def create(self, tenant_id: int, data: MoldSchemeBindingCreate, current_user: Optional[User] = None) -> MoldSchemeBinding:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        payload = dict(
            tenant_id=tenant_id,
            mold_id=mold.id,
            mold_uuid=mold.uuid,
            scheme_id=data.scheme_id,
            scheme_type=data.scheme_type,
        )
        apply_create_audit(payload, current_user)
        return await MoldSchemeBinding.create(**payload)

    async def bulk_replace(
        self,
        tenant_id: int,
        data: MoldSchemeBindingBulkReplace,
        current_user: Optional[User] = None,
    ) -> List[MoldSchemeBinding]:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        async with in_transaction():
            await MoldSchemeBinding.filter(
                tenant_id=tenant_id,
                mold_id=mold.id,
                scheme_type=data.scheme_type,
                deleted_at__isnull=True,
            ).update(deleted_at=resolve_business_datetime())
            bindings = []
            for scheme_id in data.scheme_ids:
                payload = dict(
                    tenant_id=tenant_id,
                    mold_id=mold.id,
                    mold_uuid=mold.uuid,
                    scheme_id=scheme_id,
                    scheme_type=data.scheme_type,
                )
                apply_create_audit(payload, current_user)
                binding = await MoldSchemeBinding.create(**payload)
                bindings.append(binding)
            return bindings

    async def delete(self, tenant_id: int, binding_id: int) -> None:
        binding = await MoldSchemeBinding.filter(
            tenant_id=tenant_id,
            id=binding_id,
            deleted_at__isnull=True,
        ).first()
        if not binding:
            raise NotFoundError(f"绑定记录不存在: {binding_id}")
        binding.deleted_at = resolve_business_datetime()
        await binding.save()


class MoldTrialService:
    async def create(
        self,
        tenant_id: int,
        data: MoldTrialCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldTrial:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        _reject_scrapped_mold(mold)
        document_no = await _generate_code(tenant_id, "mold_trial_code", "MT")
        async with in_transaction():
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_code=mold.code,
                mold_name=mold.name,
                trial_date=data.trial_date or date.today(),
                trial_result=data.trial_result,
                operator_id=data.operator_id or operator_id,
                operator_name=data.operator_name or operator_name,
                remark=data.remark,
                status="进行中",
            )
            apply_create_audit(payload, current_user)
            trial = await MoldTrial.create(**payload)
            await MoldStatusService.resolve(tenant_id, mold.id)
            return trial

    async def get(self, tenant_id: int, row_id: int) -> MoldTrial:
        row = await MoldTrial.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"试模单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        mold_id: Optional[int] = None,
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
    ) -> tuple[List[MoldTrial], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            MOLD_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldTrial.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=MOLD_WORKFLOW_KEYWORD_FIELDS,
            date_field="trial_date",
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
        data: MoldTrialUpdate,
        current_user: Optional[User] = None,
    ) -> MoldTrial:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            for k, v in data.model_dump(exclude_unset=True).items():
                setattr(row, k, v)
            apply_update_audit(row, current_user)
            await row.save()
            if row.status != "进行中":
                await MoldStatusService.resolve(tenant_id, row.mold_id)
            return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            mold_id = row.mold_id
            row.deleted_at = resolve_business_datetime()
            await row.save()
            await MoldStatusService.resolve(tenant_id, mold_id)


class MoldBorrowService:
    async def _has_outstanding(self, tenant_id: int, mold_id: int) -> bool:
        return await MoldBorrow.filter(
            tenant_id=tenant_id,
            mold_id=mold_id,
            status=OUTSTANDING_BORROW_STATUS,
            deleted_at__isnull=True,
        ).exists()

    async def create(
        self,
        tenant_id: int,
        data: MoldBorrowCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldBorrow:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        _reject_scrapped_mold(mold)
        if mold.status != MOLD_STATUS_IDLE:
            raise ValidationError(f"模具当前状态为「{mold.status}」，仅「待用」状态可领用")
        if not mold.allow_repeated_borrow and await self._has_outstanding(tenant_id, mold.id):
            raise ValidationError("该模具存在未归还领用单，且不允许重复领用")

        document_no = await _generate_code(tenant_id, "mold_borrow_code", "MB")
        async with in_transaction():
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_code=mold.code,
                mold_name=mold.name,
                borrow_date=data.borrow_date or resolve_business_datetime(),
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
            apply_create_audit(payload, current_user)
            borrow = await MoldBorrow.create(**payload)
            await MoldStatusService.resolve(tenant_id, mold.id)
            return borrow

    async def get(self, tenant_id: int, row_id: int) -> MoldBorrow:
        row = await MoldBorrow.filter(
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
        mold_id: Optional[int] = None,
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
    ) -> tuple[List[MoldBorrow], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            MOLD_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=MOLD_WORKFLOW_KEYWORD_FIELDS,
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
        mold_id: Optional[int] = None,
    ) -> tuple[List[MoldBorrow], int]:
        return await self.list(
            tenant_id,
            skip,
            limit,
            mold_id=mold_id,
            status=OUTSTANDING_BORROW_STATUS,
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MoldBorrowUpdate,
        current_user: Optional[User] = None,
    ) -> MoldBorrow:
        row = await self.get(tenant_id, row_id)
        if row.status != OUTSTANDING_BORROW_STATUS:
            raise ValidationError("仅领用中状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status != OUTSTANDING_BORROW_STATUS:
                raise ValidationError("仅领用中状态可删除")
            mold_id = row.mold_id
            row.deleted_at = resolve_business_datetime()
            await row.save()
            await MoldStatusService.resolve(tenant_id, mold_id)


class MoldReturnService:
    async def create(
        self,
        tenant_id: int,
        data: MoldReturnCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldReturn:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        _reject_scrapped_mold(mold)

        if data.reporting_record_id is not None:
            existing = await MoldReturn.filter(
                tenant_id=tenant_id,
                reporting_record_id=data.reporting_record_id,
                deleted_at__isnull=True,
            ).first()
            if existing:
                return existing

        borrow: Optional[MoldBorrow] = None
        if data.borrow_id is not None:
            borrow = await MoldBorrow.filter(
                tenant_id=tenant_id,
                id=data.borrow_id,
                deleted_at__isnull=True,
            ).first()
            if not borrow:
                raise ValidationError(f"领用单不存在: {data.borrow_id}")
            if borrow.status != OUTSTANDING_BORROW_STATUS:
                raise ValidationError("关联领用单已归还")
        else:
            borrow = await MoldBorrow.filter(
                tenant_id=tenant_id,
                mold_id=mold.id,
                status=OUTSTANDING_BORROW_STATUS,
                deleted_at__isnull=True,
            ).order_by("-id").first()

        document_no = await _generate_code(tenant_id, "mold_return_code", "MR")
        async with in_transaction():
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_code=mold.code,
                mold_name=mold.name,
                borrow_id=borrow.id if borrow else None,
                return_date=data.return_date or resolve_business_datetime(),
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
            apply_create_audit(payload, current_user)
            ret = await MoldReturn.create(**payload)
            mold.total_usage_count = (mold.total_usage_count or 0) + data.usage_count
            await mold.save()
            if borrow:
                borrow.status = "已归还"
                await borrow.save()
            await MoldStatusService.resolve(tenant_id, mold.id)
            return ret

    async def get(self, tenant_id: int, row_id: int) -> MoldReturn:
        row = await MoldReturn.filter(
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
        mold_id: Optional[int] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        doc_start_date: Optional[str] = None,
        doc_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[MoldReturn], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            MOLD_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=MOLD_WORKFLOW_KEYWORD_FIELDS,
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
        data: MoldReturnUpdate,
        current_user: Optional[User] = None,
    ) -> MoldReturn:
        row = await self.get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "usage_count" in update_data and update_data["usage_count"] != row.usage_count:
            mold = await _get_mold_or_raise(tenant_id, row.mold_id)
            mold.total_usage_count = max(
                0,
                (mold.total_usage_count or 0) - row.usage_count + update_data["usage_count"],
            )
            await mold.save()
        for k, v in update_data.items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            mold = await _get_mold_or_raise(tenant_id, row.mold_id)
            mold.total_usage_count = max(0, (mold.total_usage_count or 0) - row.usage_count)
            await mold.save()
            if row.borrow_id:
                borrow = await MoldBorrow.filter(
                    tenant_id=tenant_id,
                    id=row.borrow_id,
                    deleted_at__isnull=True,
                ).first()
                if borrow:
                    borrow.status = OUTSTANDING_BORROW_STATUS
                    await borrow.save()
            row.deleted_at = resolve_business_datetime()
            await row.save()
            await MoldStatusService.resolve(tenant_id, mold.id)


class MoldMaintenanceService:
    scheme_service = MoldMaintenanceSchemeService()

    async def _resolve_scheme_id(
        self,
        tenant_id: int,
        mold: Mold,
        scheme_id: Optional[int],
    ) -> int:
        if scheme_id:
            return scheme_id
        if mold.maintenance_scheme_id:
            return mold.maintenance_scheme_id
        binding = await MoldSchemeBinding.filter(
            tenant_id=tenant_id,
            mold_id=mold.id,
            scheme_type="maintenance",
            deleted_at__isnull=True,
        ).order_by("id").first()
        if binding:
            return binding.scheme_id
        raise ValidationError("未指定保养方案，且模具未绑定默认保养方案")

    async def preview_lines(
        self,
        tenant_id: int,
        mold_id: int,
        scheme_id: Optional[int] = None,
    ) -> MoldMaintenancePreviewResponse:
        mold = await _get_mold_or_raise(tenant_id, mold_id)
        resolved_scheme_id = await self._resolve_scheme_id(tenant_id, mold, scheme_id)
        scheme, lines = await self.scheme_service.get_with_lines(tenant_id, resolved_scheme_id)
        preview_lines = [
            MoldMaintenancePreviewLine(
                line_no=idx + 1,
                item_id=sl.item_id,
                item_code=sl.item_code,
                item_name=sl.item_name,
                requirement=sl.requirement,
                standard_hours=sl.standard_hours,
            )
            for idx, sl in enumerate(lines)
        ]
        return MoldMaintenancePreviewResponse(
            mold_id=mold.id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, maintenance_id: int) -> List[MoldMaintenanceLine]:
        return await MoldMaintenanceLine.filter(
            tenant_id=tenant_id,
            maintenance_id=maintenance_id,
            deleted_at__isnull=True,
        ).order_by("line_no", "id").all()

    async def _create_lines(
        self,
        tenant_id: int,
        maintenance_id: int,
        lines: List[MoldMaintenanceLineInput],
    ) -> None:
        for line in lines:
            await MoldMaintenanceLine.create(
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
        data: MoldMaintenanceCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldMaintenance:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        _reject_scrapped_mold(mold)
        scheme_id = await self._resolve_scheme_id(tenant_id, mold, data.scheme_id)
        document_no = await _generate_code(tenant_id, "mold_maintenance_code", "MM")
        async with in_transaction():
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_code=mold.code,
                mold_name=mold.name,
                scheme_id=scheme_id,
                planned_date=data.planned_date,
                maintenance_date=data.maintenance_date,
                applicant_id=data.applicant_id or operator_id,
                applicant_name=data.applicant_name or operator_name,
                remark=data.remark,
                status="草稿",
            )
            apply_create_audit(payload, current_user)
            header = await MoldMaintenance.create(**payload)
            if data.lines:
                await self._create_lines(tenant_id, header.id, data.lines)
            else:
                preview = await self.preview_lines(tenant_id, mold.id, scheme_id)
                await self._create_lines(
                    tenant_id,
                    header.id,
                    [
                        MoldMaintenanceLineInput(
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

    async def get(self, tenant_id: int, row_id: int) -> MoldMaintenance:
        row = await MoldMaintenance.filter(
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
        mold_id: Optional[int] = None,
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
    ) -> tuple[List[MoldMaintenance], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            MOLD_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldMaintenance.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=MOLD_WORKFLOW_KEYWORD_FIELDS,
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
        data: MoldMaintenanceUpdate,
        current_user: Optional[User] = None,
    ) -> MoldMaintenance:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            if header.status != "草稿":
                raise ValidationError("仅草稿状态可编辑")
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            apply_update_audit(header, current_user)
            await header.save()
            if data.lines is not None:
                await MoldMaintenanceLine.filter(
                    tenant_id=tenant_id,
                    maintenance_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=resolve_business_datetime())
                await self._create_lines(tenant_id, header.id, data.lines)
            return header

    async def submit(
        self,
        tenant_id: int,
        row_id: int,
        current_user: Optional[User] = None,
    ) -> MoldMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        async with in_transaction():
            row.status = "进行中"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = resolve_business_datetime()
            if not row.maintenance_date:
                row.maintenance_date = date.today()
            apply_update_audit(row, current_user)
            await row.save()
            await MoldStatusService.resolve(tenant_id, row.mold_id)
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可驳回")
        row.status = "已驳回"
        row.reject_reason = reject_reason
        row.approver_id = approver_id
        row.approver_name = approver_name
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def complete(self, tenant_id: int, row_id: int) -> MoldMaintenance:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("进行中", "已审核"):
            raise ValidationError("仅进行中状态可完修")
        async with in_transaction():
            row.status = "已完成"
            row.completed_at = resolve_business_datetime()
            if not row.maintenance_date:
                row.maintenance_date = date.today()
            await row.save()
            mold = await _get_mold_or_raise(tenant_id, row.mold_id)
            mold.last_maintenance_date = row.maintenance_date
            await mold.save()
            await MoldStatusService.resolve(tenant_id, row.mold_id)
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status not in ("草稿", "已驳回"):
                raise ValidationError("仅草稿或已驳回状态可删除")
            mold_id = row.mold_id
            row.deleted_at = resolve_business_datetime()
            await row.save()
            if row.status in OPEN_MAINTENANCE_STATUSES:
                await MoldStatusService.resolve(tenant_id, mold_id)


class MoldRepairService:
    scheme_service = MoldRepairSchemeService()

    async def _resolve_scheme_id(
        self,
        tenant_id: int,
        mold: Mold,
        scheme_id: Optional[int],
    ) -> int:
        if scheme_id:
            return scheme_id
        if mold.repair_scheme_id:
            return mold.repair_scheme_id
        binding = await MoldSchemeBinding.filter(
            tenant_id=tenant_id,
            mold_id=mold.id,
            scheme_type="repair",
            deleted_at__isnull=True,
        ).order_by("id").first()
        if binding:
            return binding.scheme_id
        raise ValidationError("未指定维修方案，且模具未绑定默认维修方案")

    async def preview_lines(
        self,
        tenant_id: int,
        mold_id: int,
        scheme_id: Optional[int] = None,
    ) -> MoldRepairPreviewResponse:
        mold = await _get_mold_or_raise(tenant_id, mold_id)
        resolved_scheme_id = await self._resolve_scheme_id(tenant_id, mold, scheme_id)
        scheme, lines = await self.scheme_service.get_with_lines(tenant_id, resolved_scheme_id)
        preview_lines = [
            MoldRepairPreviewLine(
                line_no=idx + 1,
                item_id=sl.item_id,
                item_code=sl.item_code,
                item_name=sl.item_name,
                requirement=sl.requirement,
                standard_hours=sl.standard_hours,
            )
            for idx, sl in enumerate(lines)
        ]
        return MoldRepairPreviewResponse(
            mold_id=mold.id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, repair_id: int) -> List[MoldRepairLine]:
        return await MoldRepairLine.filter(
            tenant_id=tenant_id,
            repair_id=repair_id,
            deleted_at__isnull=True,
        ).order_by("line_no", "id").all()

    async def _create_lines(
        self,
        tenant_id: int,
        repair_id: int,
        lines: List[MoldRepairLineInput],
    ) -> None:
        for line in lines:
            await MoldRepairLine.create(
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
        data: MoldRepairCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldRepair:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        _reject_scrapped_mold(mold)
        scheme_id = await self._resolve_scheme_id(tenant_id, mold, data.scheme_id)
        document_no = await _generate_code(tenant_id, "mold_repair_code", "MRP")
        async with in_transaction():
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_code=mold.code,
                mold_name=mold.name,
                scheme_id=scheme_id,
                fault_description=data.fault_description,
                planned_date=data.planned_date,
                repair_date=data.repair_date,
                applicant_id=data.applicant_id or operator_id,
                applicant_name=data.applicant_name or operator_name,
                remark=data.remark,
                status="草稿",
            )
            apply_create_audit(payload, current_user)
            header = await MoldRepair.create(**payload)
            if data.lines:
                await self._create_lines(tenant_id, header.id, data.lines)
            else:
                preview = await self.preview_lines(tenant_id, mold.id, scheme_id)
                await self._create_lines(
                    tenant_id,
                    header.id,
                    [
                        MoldRepairLineInput(
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

    async def get(self, tenant_id: int, row_id: int) -> MoldRepair:
        row = await MoldRepair.filter(
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
        mold_id: Optional[int] = None,
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
    ) -> tuple[List[MoldRepair], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            MOLD_WORKFLOW_KEYWORD_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_WORKFLOW_DOC_SORTABLE_FIELDS,
            keyword_fields=MOLD_WORKFLOW_KEYWORD_FIELDS,
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
        data: MoldRepairUpdate,
        current_user: Optional[User] = None,
    ) -> MoldRepair:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            if header.status != "草稿":
                raise ValidationError("仅草稿状态可编辑")
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            apply_update_audit(header, current_user)
            await header.save()
            if data.lines is not None:
                await MoldRepairLine.filter(
                    tenant_id=tenant_id,
                    repair_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=resolve_business_datetime())
                await self._create_lines(tenant_id, header.id, data.lines)
            return header

    async def submit(
        self,
        tenant_id: int,
        row_id: int,
        current_user: Optional[User] = None,
    ) -> MoldRepair:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldRepair:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        async with in_transaction():
            row.status = "进行中"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = resolve_business_datetime()
            if not row.repair_date:
                row.repair_date = date.today()
            apply_update_audit(row, current_user)
            await row.save()
            await MoldStatusService.resolve(tenant_id, row.mold_id)
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldRepair:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可驳回")
        row.status = "已驳回"
        row.reject_reason = reject_reason
        row.approver_id = approver_id
        row.approver_name = approver_name
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def complete(self, tenant_id: int, row_id: int) -> MoldRepair:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("进行中", "已审核"):
            raise ValidationError("仅进行中状态可完修")
        async with in_transaction():
            row.status = "已完成"
            row.completed_at = resolve_business_datetime()
            if not row.repair_date:
                row.repair_date = date.today()
            await row.save()
            await MoldStatusService.resolve(tenant_id, row.mold_id)
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        async with in_transaction():
            row = await self.get(tenant_id, row_id)
            if row.status not in ("草稿", "已驳回"):
                raise ValidationError("仅草稿或已驳回状态可删除")
            mold_id = row.mold_id
            row.deleted_at = resolve_business_datetime()
            await row.save()
            if row.status in OPEN_REPAIR_STATUSES:
                await MoldStatusService.resolve(tenant_id, mold_id)


class MoldScrapApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: MoldScrapApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldScrapApplication:
        mold = await _get_mold_or_raise(tenant_id, data.mold_id)
        if mold.status == MOLD_STATUS_SCRAPPED:
            raise ValidationError("模具已报废，不能重复申请")
        application_no = await _generate_code(tenant_id, "mold_scrap_application_code", "MSA")
        payload = dict(
            tenant_id=tenant_id,
            application_no=application_no,
            mold_id=mold.id,
            mold_uuid=mold.uuid,
            mold_code=mold.code,
            mold_name=mold.name,
            reason=data.reason,
            scrap_date=data.scrap_date,
            applicant_id=data.applicant_id or operator_id,
            applicant_name=data.applicant_name or operator_name,
            remark=data.remark,
            attachments=data.attachments,
            status="草稿",
        )
        apply_create_audit(payload, current_user)
        return await MoldScrapApplication.create(**payload)

    async def get(self, tenant_id: int, row_id: int) -> MoldScrapApplication:
        row = await MoldScrapApplication.filter(
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
        mold_id: Optional[int] = None,
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
    ) -> tuple[List[MoldScrapApplication], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_SCRAP_SORTABLE_FIELDS,
            apply_asset_workflow_list_filters,
        )

        qs = MoldScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if status:
            qs = qs.filter(status=status)
        qs, order_clause = apply_asset_workflow_list_filters(
            qs,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=MOLD_SCRAP_SORTABLE_FIELDS,
            keyword_fields=["application_no", "mold_code", "mold_name", "reason"],
            date_field="scrap_date",
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
        data: MoldScrapApplicationUpdate,
        current_user: Optional[User] = None,
    ) -> MoldScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def submit(
        self,
        tenant_id: int,
        row_id: int,
        current_user: Optional[User] = None,
    ) -> MoldScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可提交")
        row.status = "已提交"
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        mold = await _get_mold_or_raise(tenant_id, row.mold_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = resolve_business_datetime()
            if not row.scrap_date:
                row.scrap_date = date.today()
            apply_update_audit(row, current_user)
            await row.save()
            mold.status = MOLD_STATUS_SCRAPPED
            await mold.save()
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> MoldScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可驳回")
        row.status = "已驳回"
        row.reject_reason = reject_reason
        row.approver_id = approver_id
        row.approver_name = approver_name
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def delete(self, tenant_id: int, row_id: int) -> None:
        row = await self.get(tenant_id, row_id)
        if row.status not in ("草稿", "已驳回"):
            raise ValidationError("仅草稿或已驳回状态可删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()


class MoldOpsReportService:
    async def trial_records(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        mold_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        qs = MoldTrial.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            qs = qs.filter(mold_id=mold_id)
        if date_from:
            qs = qs.filter(trial_date__gte=date_from)
        if date_to:
            qs = qs.filter(trial_date__lte=date_to)
        total = await qs.count()
        rows = await qs.order_by("-trial_date", "-id").offset(skip).limit(limit)
        items = [
            {
                "document_no": r.document_no,
                "mold_code": r.mold_code,
                "mold_name": r.mold_name,
                "trial_date": r.trial_date,
                "trial_result": r.trial_result,
                "operator_name": r.operator_name,
                "status": r.status,
            }
            for r in rows
        ]
        return items, total

    async def maintenance_alerts(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        reminder_type: Optional[str] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        from apps.kuaizhizao.services.mold_service import MoldMaintenanceReminderService

        items, total = await MoldMaintenanceReminderService.list_reminders(
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
        mold_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        borrow_qs = MoldBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        return_qs = MoldReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if mold_id is not None:
            borrow_qs = borrow_qs.filter(mold_id=mold_id)
            return_qs = return_qs.filter(mold_id=mold_id)
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
                "mold_code": b.mold_code,
                "mold_name": b.mold_name,
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
                "mold_code": r.mold_code,
                "mold_name": r.mold_name,
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
        qs = MoldRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if date_from:
            qs = qs.filter(repair_date__gte=date_from)
        if date_to:
            qs = qs.filter(repair_date__lte=date_to)
        repairs = await qs.all()
        stats: Dict[int, Dict[str, Any]] = {}
        for r in repairs:
            bucket = stats.setdefault(
                r.mold_id,
                {
                    "mold_code": r.mold_code,
                    "mold_name": r.mold_name,
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
                "mold_code": bucket["mold_code"],
                "mold_name": bucket["mold_name"],
                "repair_count": bucket["repair_count"],
                "completed_count": bucket["completed_count"],
                "avg_completion_days": avg_days,
            })
        items.sort(key=lambda x: x["repair_count"], reverse=True)
        total = len(items)
        return items[skip : skip + limit], total


class MoldOpsService:
    """模具运营服务聚合入口。"""

    maintenance_item_service = MoldMaintenanceItemService()
    maintenance_scheme_service = MoldMaintenanceSchemeService()
    repair_item_service = MoldRepairItemService()
    repair_scheme_service = MoldRepairSchemeService()
    scheme_binding_service = MoldSchemeBindingService()
    trial_service = MoldTrialService()
    borrow_service = MoldBorrowService()
    return_service = MoldReturnService()
    maintenance_service = MoldMaintenanceService()
    repair_service = MoldRepairService()
    scrap_application_service = MoldScrapApplicationService()
    report_service = MoldOpsReportService()
