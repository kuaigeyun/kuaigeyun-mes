"""
设备运营业务服务：点检/巡检/保养主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Type, TypeVar

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_fault import EquipmentFault
from apps.kuaizhizao.models.equipment_ops import (
    EquipmentInspectionItem,
    EquipmentInspectionScheme,
    EquipmentInspectionSchemeLine,
    EquipmentSchemeBinding,
    EquipmentPatrolRoute,
    EquipmentPatrolRouteStep,
    EquipmentMaintenanceItem,
    EquipmentMaintenanceScheme,
    EquipmentMaintenanceSchemeLine,
    EquipmentSpotCheck,
    EquipmentSpotCheckLine,
    EquipmentRoutePatrol,
    EquipmentRoutePatrolLine,
    EquipmentScrapApplication,
    EquipmentTransferApplication,
)
from apps.kuaizhizao.schemas.equipment_fault import EquipmentFaultCreate
from apps.kuaizhizao.schemas.equipment_ops import (
    InspectionItemCreate,
    InspectionItemUpdate,
    InspectionSchemeCreate,
    InspectionSchemeUpdate,
    InspectionSchemeLineCreate,
    SchemeBindingCreate,
    SchemeBindingBulkReplace,
    PatrolRouteCreate,
    PatrolRouteUpdate,
    PatrolRouteStepCreate,
    MaintenanceItemCreate,
    MaintenanceItemUpdate,
    MaintenanceSchemeCreate,
    MaintenanceSchemeUpdate,
    MaintenanceSchemeLineCreate,
    SpotCheckCreate,
    SpotCheckUpdate,
    SpotCheckLineInput,
    SpotCheckPreviewResponse,
    SpotCheckPreviewLine,
    RoutePatrolCreate,
    RoutePatrolUpdate,
    RoutePatrolLineInput,
    RoutePatrolPreviewResponse,
    RoutePatrolPreviewLine,
    ScrapApplicationCreate,
    ScrapApplicationUpdate,
    TransferApplicationCreate,
    TransferApplicationUpdate,
)
from apps.kuaizhizao.services.equipment_fault_service import EquipmentFaultService
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


async def _get_equipment_or_raise(tenant_id: int, equipment_id: int) -> Equipment:
    equipment = await Equipment.filter(
        tenant_id=tenant_id,
        id=equipment_id,
        deleted_at__isnull=True,
    ).first()
    if not equipment:
        raise NotFoundError(f"设备不存在: {equipment_id}")
    return equipment


def _reject_scrapped_equipment(equipment: Equipment) -> None:
    if equipment.status == "报废":
        raise ValidationError("设备已报废，不能执行点检或巡检")


def _line_is_pass(
    value_type: Optional[str],
    measured_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
    explicit_is_pass: Optional[bool] = None,
) -> bool:
    if explicit_is_pass is not None:
        return explicit_is_pass
    vt = (value_type or "boolean").strip().lower()
    if vt == "boolean":
        mv = (measured_value or "").strip().lower()
        if mv in ("false", "0", "否", "不合格", "no"):
            return False
        return True
    if vt == "numeric":
        if not measured_value or not str(measured_value).strip():
            return True
        try:
            val = Decimal(str(measured_value).strip().replace(",", ""))
        except Exception:
            return False
        if numeric_min is not None and val < numeric_min:
            return False
        if numeric_max is not None and val > numeric_max:
            return False
        return True
    return True


async def _snapshot_inspection_item(tenant_id: int, item_id: int) -> Dict[str, Any]:
    item = await EquipmentInspectionItem.filter(
        tenant_id=tenant_id,
        id=item_id,
        deleted_at__isnull=True,
    ).first()
    if not item:
        raise ValidationError(f"点检项不存在: {item_id}")
    return {
        "item_code": item.code,
        "item_name": item.name,
        "requirement": item.requirement,
        "value_type": item.value_type,
        "unit": item.unit,
        "numeric_min": item.numeric_min,
        "numeric_max": item.numeric_max,
    }


async def _snapshot_maintenance_item(tenant_id: int, item_id: int) -> Dict[str, Any]:
    item = await EquipmentMaintenanceItem.filter(
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


async def _create_fault_from_ops(
    tenant_id: int,
    equipment: Equipment,
    source_type: str,
    source_uuid: str,
    description: str,
    reporter_id: Optional[int] = None,
    reporter_name: Optional[str] = None,
) -> EquipmentFault:
    fault_data = EquipmentFaultCreate(
        equipment_uuid=equipment.uuid,
        fault_date=datetime.now(),
        fault_type="其他",
        fault_description=description,
        fault_level="一般",
        reporter_id=reporter_id,
        reporter_name=reporter_name,
        status="待处理",
        repair_required=True,
        source_type=source_type,
        source_uuid=source_uuid,
    )
    return await EquipmentFaultService.create_equipment_fault(
        tenant_id=tenant_id,
        data=fault_data,
        created_by=reporter_id,
    )


class _MasterCRUDMixin:
    """主数据 CRUD 通用逻辑。"""

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


class EquipmentInspectionItemService(_MasterCRUDMixin):
    model = EquipmentInspectionItem

    async def create(self, tenant_id: int, data: InspectionItemCreate) -> EquipmentInspectionItem:
        existing = await EquipmentInspectionItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"点检项编码已存在: {data.code}")
        return await EquipmentInspectionItem.create(
            tenant_id=tenant_id,
            **data.model_dump(),
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: InspectionItemUpdate,
    ) -> EquipmentInspectionItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await EquipmentInspectionItem.filter(
                tenant_id=tenant_id,
                code=update_data["code"],
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"点检项编码已存在: {update_data['code']}")
        for k, v in update_data.items():
            setattr(row, k, v)
        await row.save()
        return row


class EquipmentInspectionSchemeService(_MasterCRUDMixin):
    model = EquipmentInspectionScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[EquipmentInspectionSchemeLine]:
        return await EquipmentInspectionSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[InspectionSchemeLineCreate],
    ) -> None:
        await EquipmentInspectionSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=datetime.now())
        for idx, line in enumerate(lines):
            snap = await _snapshot_inspection_item(tenant_id, line.item_id)
            await EquipmentInspectionSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                value_type=line.value_type or snap["value_type"],
                unit=line.unit or snap["unit"],
                numeric_min=line.numeric_min or snap["numeric_min"],
                numeric_max=line.numeric_max or snap["numeric_max"],
            )

    async def create(self, tenant_id: int, data: InspectionSchemeCreate) -> EquipmentInspectionScheme:
        async with in_transaction():
            dup = await EquipmentInspectionScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"点检方案编码已存在: {data.code}")
            scheme = await EquipmentInspectionScheme.create(
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
        data: InspectionSchemeUpdate,
    ) -> EquipmentInspectionScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await EquipmentInspectionScheme.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"点检方案编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(scheme, k, v)
            await scheme.save()
            if data.lines is not None:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def get_with_lines(self, tenant_id: int, row_id: int) -> tuple[EquipmentInspectionScheme, List[EquipmentInspectionSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class EquipmentPatrolRouteService(_MasterCRUDMixin):
    model = EquipmentPatrolRoute

    async def _load_steps(self, tenant_id: int, route_id: int) -> List[EquipmentPatrolRouteStep]:
        return await EquipmentPatrolRouteStep.filter(
            tenant_id=tenant_id,
            route_id=route_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_steps(
        self,
        tenant_id: int,
        route_id: int,
        steps: List[PatrolRouteStepCreate],
    ) -> None:
        await EquipmentPatrolRouteStep.filter(
            tenant_id=tenant_id,
            route_id=route_id,
            deleted_at__isnull=True,
        ).update(deleted_at=datetime.now())
        for idx, step in enumerate(steps):
            equipment = await _get_equipment_or_raise(tenant_id, step.equipment_id)
            await EquipmentPatrolRouteStep.create(
                tenant_id=tenant_id,
                route_id=route_id,
                sort_order=step.sort_order if step.sort_order else idx,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_code=step.equipment_code or equipment.code,
                equipment_name=step.equipment_name or equipment.name,
                scheme_id=step.scheme_id,
            )

    async def create(self, tenant_id: int, data: PatrolRouteCreate) -> EquipmentPatrolRoute:
        async with in_transaction():
            dup = await EquipmentPatrolRoute.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"巡检路线编码已存在: {data.code}")
            route = await EquipmentPatrolRoute.create(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                workshop_id=data.workshop_id,
                workshop_name=data.workshop_name,
                description=data.description,
                is_active=data.is_active,
            )
            if data.steps:
                await self._replace_steps(tenant_id, route.id, data.steps)
            return route

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: PatrolRouteUpdate,
    ) -> EquipmentPatrolRoute:
        async with in_transaction():
            route = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"steps"})
            if "code" in update_data and update_data["code"] != route.code:
                dup = await EquipmentPatrolRoute.filter(
                    tenant_id=tenant_id,
                    code=update_data["code"],
                    deleted_at__isnull=True,
                ).first()
                if dup:
                    raise ValidationError(f"巡检路线编码已存在: {update_data['code']}")
            for k, v in update_data.items():
                setattr(route, k, v)
            await route.save()
            if data.steps is not None:
                await self._replace_steps(tenant_id, route.id, data.steps)
            return route

    async def get_with_steps(
        self,
        tenant_id: int,
        row_id: int,
    ) -> tuple[EquipmentPatrolRoute, List[EquipmentPatrolRouteStep]]:
        route = await self._get(tenant_id, row_id)
        steps = await self._load_steps(tenant_id, route.id)
        return route, steps


class EquipmentMaintenanceItemService(_MasterCRUDMixin):
    model = EquipmentMaintenanceItem

    async def create(self, tenant_id: int, data: MaintenanceItemCreate) -> EquipmentMaintenanceItem:
        dup = await EquipmentMaintenanceItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"保养项编码已存在: {data.code}")
        return await EquipmentMaintenanceItem.create(
            tenant_id=tenant_id,
            **data.model_dump(),
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MaintenanceItemUpdate,
    ) -> EquipmentMaintenanceItem:
        row = await self._get(tenant_id, row_id)
        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] != row.code:
            dup = await EquipmentMaintenanceItem.filter(
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


class EquipmentMaintenanceSchemeService(_MasterCRUDMixin):
    model = EquipmentMaintenanceScheme

    async def _load_lines(self, tenant_id: int, scheme_id: int) -> List[EquipmentMaintenanceSchemeLine]:
        return await EquipmentMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "id").all()

    async def _replace_lines(
        self,
        tenant_id: int,
        scheme_id: int,
        lines: List[MaintenanceSchemeLineCreate],
    ) -> None:
        await EquipmentMaintenanceSchemeLine.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            deleted_at__isnull=True,
        ).update(deleted_at=datetime.now())
        for idx, line in enumerate(lines):
            snap = await _snapshot_maintenance_item(tenant_id, line.item_id)
            await EquipmentMaintenanceSchemeLine.create(
                tenant_id=tenant_id,
                scheme_id=scheme_id,
                sort_order=line.sort_order if line.sort_order else idx,
                item_id=line.item_id,
                item_code=line.item_code or snap["item_code"],
                item_name=line.item_name or snap["item_name"],
                requirement=line.requirement or snap["requirement"],
                standard_hours=line.standard_hours or snap["standard_hours"],
            )

    async def create(self, tenant_id: int, data: MaintenanceSchemeCreate) -> EquipmentMaintenanceScheme:
        async with in_transaction():
            dup = await EquipmentMaintenanceScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"保养方案编码已存在: {data.code}")
            scheme = await EquipmentMaintenanceScheme.create(
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
        data: MaintenanceSchemeUpdate,
    ) -> EquipmentMaintenanceScheme:
        async with in_transaction():
            scheme = await self._get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if "code" in update_data and update_data["code"] != scheme.code:
                dup = await EquipmentMaintenanceScheme.filter(
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
    ) -> tuple[EquipmentMaintenanceScheme, List[EquipmentMaintenanceSchemeLine]]:
        scheme = await self._get(tenant_id, row_id)
        lines = await self._load_lines(tenant_id, scheme.id)
        return scheme, lines


class EquipmentSchemeBindingService:
    async def list_by_equipment(
        self,
        tenant_id: int,
        equipment_id: int,
        scheme_type: Optional[str] = None,
    ) -> List[EquipmentSchemeBinding]:
        qs = EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            deleted_at__isnull=True,
        )
        if scheme_type:
            qs = qs.filter(scheme_type=scheme_type)
        return await qs.order_by("id").all()

    async def create(self, tenant_id: int, data: SchemeBindingCreate) -> EquipmentSchemeBinding:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        return await EquipmentSchemeBinding.create(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            scheme_id=data.scheme_id,
            scheme_type=data.scheme_type,
        )

    async def bulk_replace(self, tenant_id: int, data: SchemeBindingBulkReplace) -> List[EquipmentSchemeBinding]:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        async with in_transaction():
            await EquipmentSchemeBinding.filter(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                scheme_type=data.scheme_type,
                deleted_at__isnull=True,
            ).update(deleted_at=datetime.now())
            bindings = []
            for scheme_id in data.scheme_ids:
                binding = await EquipmentSchemeBinding.create(
                    tenant_id=tenant_id,
                    equipment_id=equipment.id,
                    equipment_uuid=equipment.uuid,
                    scheme_id=scheme_id,
                    scheme_type=data.scheme_type,
                )
                bindings.append(binding)
            return bindings

    async def delete(self, tenant_id: int, binding_id: int) -> None:
        binding = await EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            id=binding_id,
            deleted_at__isnull=True,
        ).first()
        if not binding:
            raise NotFoundError(f"绑定记录不存在: {binding_id}")
        binding.deleted_at = datetime.now()
        await binding.save()


class EquipmentSpotCheckService:
    scheme_service = EquipmentInspectionSchemeService()

    async def _resolve_scheme_id(
        self,
        tenant_id: int,
        equipment_id: int,
        scheme_id: Optional[int],
    ) -> int:
        if scheme_id:
            scheme = await EquipmentInspectionScheme.filter(
                tenant_id=tenant_id,
                id=scheme_id,
                deleted_at__isnull=True,
            ).first()
            if not scheme:
                raise ValidationError(f"点检方案不存在: {scheme_id}")
            return scheme.id
        bindings = await EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            scheme_type="spot_check",
            deleted_at__isnull=True,
        ).all()
        if not bindings:
            raise ValidationError("设备未绑定点检方案，请指定 scheme_id")
        if len(bindings) > 1:
            raise ValidationError("设备绑定了多个点检方案，请指定 scheme_id")
        return bindings[0].scheme_id

    async def preview_lines(
        self,
        tenant_id: int,
        equipment_id: int,
        scheme_id: Optional[int] = None,
    ) -> SpotCheckPreviewResponse:
        equipment = await _get_equipment_or_raise(tenant_id, equipment_id)
        _reject_scrapped_equipment(equipment)
        resolved_scheme_id = await self._resolve_scheme_id(tenant_id, equipment_id, scheme_id)
        scheme, lines = await self.scheme_service.get_with_lines(tenant_id, resolved_scheme_id)
        preview_lines: List[SpotCheckPreviewLine] = []
        for idx, line in enumerate(lines):
            preview_lines.append(
                SpotCheckPreviewLine(
                    line_no=idx + 1,
                    item_id=line.item_id,
                    item_code=line.item_code,
                    item_name=line.item_name,
                    requirement=line.requirement,
                    value_type=line.value_type,
                    unit=line.unit,
                    numeric_min=line.numeric_min,
                    numeric_max=line.numeric_max,
                    is_pass=True,
                )
            )
        return SpotCheckPreviewResponse(
            equipment_id=equipment_id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, spot_check_id: int) -> List[EquipmentSpotCheckLine]:
        return await EquipmentSpotCheckLine.filter(
            tenant_id=tenant_id,
            spot_check_id=spot_check_id,
            deleted_at__isnull=True,
        ).order_by("line_no", "id").all()

    async def create(
        self,
        tenant_id: int,
        data: SpotCheckCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> EquipmentSpotCheck:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        _reject_scrapped_equipment(equipment)
        scheme_id = await self._resolve_scheme_id(tenant_id, data.equipment_id, data.scheme_id)
        scheme = await EquipmentInspectionScheme.filter(
            tenant_id=tenant_id,
            id=scheme_id,
            deleted_at__isnull=True,
        ).first()
        if not scheme:
            raise ValidationError(f"点检方案不存在: {scheme_id}")

        async with in_transaction():
            document_no = await _generate_code(tenant_id, "equipment_spot_check_code", "SC")
            header = await EquipmentSpotCheck.create(
                tenant_id=tenant_id,
                document_no=document_no,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_code=equipment.code,
                equipment_name=equipment.name,
                scheme_id=scheme.id,
                check_date=data.check_date or date.today(),
                inspector_id=data.inspector_id or operator_id,
                inspector_name=data.inspector_name or operator_name,
                remark=data.remark,
            )

            if data.lines:
                line_inputs = data.lines
            else:
                _, scheme_lines = await self.scheme_service.get_with_lines(tenant_id, scheme.id)
                if not scheme_lines:
                    raise ValidationError("点检方案下没有点检项，无法生成点检行")
                line_inputs = [
                    SpotCheckLineInput(
                        line_no=idx + 1,
                        item_id=sl.item_id,
                        item_code=sl.item_code,
                        item_name=sl.item_name,
                        requirement=sl.requirement,
                        value_type=sl.value_type,
                        unit=sl.unit,
                    )
                    for idx, sl in enumerate(scheme_lines)
                ]

            failed_descriptions: List[str] = []
            for line_input in line_inputs:
                is_pass = _line_is_pass(
                    line_input.value_type,
                    line_input.measured_value,
                    None,
                    None,
                    line_input.is_pass,
                )
                await EquipmentSpotCheckLine.create(
                    tenant_id=tenant_id,
                    spot_check_id=header.id,
                    line_no=line_input.line_no,
                    item_id=line_input.item_id,
                    item_code=line_input.item_code,
                    item_name=line_input.item_name,
                    requirement=line_input.requirement,
                    value_type=line_input.value_type,
                    unit=line_input.unit,
                    measured_value=line_input.measured_value,
                    is_pass=is_pass,
                    remark=line_input.remark,
                )
                if not is_pass:
                    label = line_input.item_name or line_input.item_code or str(line_input.item_id)
                    failed_descriptions.append(f"{label}: {line_input.measured_value or '不合格'}")

            has_abnormality = len(failed_descriptions) > 0
            header.has_abnormality = has_abnormality
            if has_abnormality:
                header.abnormality_description = "；".join(failed_descriptions)
                fault = await _create_fault_from_ops(
                    tenant_id=tenant_id,
                    equipment=equipment,
                    source_type="spot_check",
                    source_uuid=header.uuid,
                    description=f"点检单 {header.document_no} 不合格项: {header.abnormality_description}",
                    reporter_id=header.inspector_id,
                    reporter_name=header.inspector_name,
                )
                header.fault_report_uuid = fault.uuid
            header.status = "已完成"
            await header.save()
            return header

    async def get(self, tenant_id: int, row_id: int) -> EquipmentSpotCheck:
        row = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"点检单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        equipment_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        check_start_date: Optional[str] = None,
        check_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        has_abnormality: Optional[bool] = None,
    ) -> tuple[List[EquipmentSpotCheck], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            SPOT_CHECK_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            resolve_equipment_list_order_by,
        )

        qs = EquipmentSpotCheck.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if equipment_id is not None:
            qs = qs.filter(equipment_id=equipment_id)
        if status:
            qs = qs.filter(status=status)
        if has_abnormality is not None:
            qs = qs.filter(has_abnormality=has_abnormality)
        qs = apply_equipment_keyword_filter(
            qs,
            keyword,
            ["document_no", "equipment_code", "equipment_name", "inspector_name"],
        )
        qs = apply_equipment_document_date_range(
            qs,
            date_field="check_date",
            start_date=check_start_date,
            end_date=check_end_date,
        )
        qs = apply_equipment_created_date_range(
            qs,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        total = await qs.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            SPOT_CHECK_SORTABLE_FIELDS,
            "-created_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(self, tenant_id: int, row_id: int, data: SpotCheckUpdate) -> EquipmentSpotCheck:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            await header.save()
            if data.lines is not None:
                await EquipmentSpotCheckLine.filter(
                    tenant_id=tenant_id,
                    spot_check_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=datetime.now())
                for line_input in data.lines:
                    is_pass = _line_is_pass(
                        line_input.value_type,
                        line_input.measured_value,
                        None,
                        None,
                        line_input.is_pass,
                    )
                    await EquipmentSpotCheckLine.create(
                        tenant_id=tenant_id,
                        spot_check_id=header.id,
                        line_no=line_input.line_no,
                        item_id=line_input.item_id,
                        item_code=line_input.item_code,
                        item_name=line_input.item_name,
                        requirement=line_input.requirement,
                        value_type=line_input.value_type,
                        unit=line_input.unit,
                        measured_value=line_input.measured_value,
                        is_pass=is_pass,
                        remark=line_input.remark,
                    )
            return header

    async def delete(self, tenant_id: int, row_id: int) -> None:
        header = await self.get(tenant_id, row_id)
        header.deleted_at = datetime.now()
        await header.save()


class EquipmentRoutePatrolService:
    route_service = EquipmentPatrolRouteService()
    scheme_service = EquipmentInspectionSchemeService()

    async def preview_lines(self, tenant_id: int, route_id: int) -> RoutePatrolPreviewResponse:
        route, steps = await self.route_service.get_with_steps(tenant_id, route_id)
        preview_lines: List[RoutePatrolPreviewLine] = []
        line_counter = 0
        for step in steps:
            equipment = await _get_equipment_or_raise(tenant_id, step.equipment_id)
            if step.scheme_id:
                _, scheme_lines = await self.scheme_service.get_with_lines(tenant_id, step.scheme_id)
                for sl in scheme_lines:
                    line_counter += 1
                    preview_lines.append(
                        RoutePatrolPreviewLine(
                            step_no=line_counter,
                            equipment_id=equipment.id,
                            equipment_uuid=equipment.uuid,
                            equipment_code=step.equipment_code or equipment.code,
                            equipment_name=step.equipment_name or equipment.name,
                            item_id=sl.item_id,
                            item_code=sl.item_code,
                            item_name=sl.item_name,
                            is_pass=True,
                        )
                    )
            else:
                line_counter += 1
                preview_lines.append(
                    RoutePatrolPreviewLine(
                        step_no=line_counter,
                        equipment_id=equipment.id,
                        equipment_uuid=equipment.uuid,
                        equipment_code=step.equipment_code or equipment.code,
                        equipment_name=step.equipment_name or equipment.name,
                        is_pass=True,
                    )
                )
        return RoutePatrolPreviewResponse(
            route_id=route.id,
            route_code=route.code,
            route_name=route.name,
            lines=preview_lines,
        )

    async def _load_lines(self, tenant_id: int, route_patrol_id: int) -> List[EquipmentRoutePatrolLine]:
        return await EquipmentRoutePatrolLine.filter(
            tenant_id=tenant_id,
            route_patrol_id=route_patrol_id,
            deleted_at__isnull=True,
        ).order_by("step_no", "id").all()

    async def create(
        self,
        tenant_id: int,
        data: RoutePatrolCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> EquipmentRoutePatrol:
        route, steps = await self.route_service.get_with_steps(tenant_id, data.route_id)
        if not steps:
            raise ValidationError("巡检路线没有步骤，无法创建巡检单")

        async with in_transaction():
            document_no = await _generate_code(tenant_id, "equipment_route_patrol_code", "RP")
            header = await EquipmentRoutePatrol.create(
                tenant_id=tenant_id,
                document_no=document_no,
                route_id=route.id,
                route_code=route.code,
                route_name=route.name,
                patrol_date=data.patrol_date or date.today(),
                inspector_id=data.inspector_id or operator_id,
                inspector_name=data.inspector_name or operator_name,
                remark=data.remark,
            )

            if data.lines:
                line_inputs = data.lines
            else:
                preview = await self.preview_lines(tenant_id, route.id)
                line_inputs = [
                    RoutePatrolLineInput(
                        step_no=pl.step_no,
                        equipment_id=pl.equipment_id,
                        item_id=pl.item_id,
                        item_code=pl.item_code,
                        item_name=pl.item_name,
                    )
                    for pl in preview.lines
                ]

            has_abnormality = False
            for line_input in line_inputs:
                equipment = await _get_equipment_or_raise(tenant_id, line_input.equipment_id)
                _reject_scrapped_equipment(equipment)
                is_pass = line_input.is_pass
                fault_uuid: Optional[str] = None
                if not is_pass:
                    has_abnormality = True
                    fault = await _create_fault_from_ops(
                        tenant_id=tenant_id,
                        equipment=equipment,
                        source_type="route_patrol",
                        source_uuid=header.uuid,
                        description=(
                            f"巡检单 {header.document_no} 设备 {equipment.name} "
                            f"不合格: {line_input.measured_value or line_input.item_name or ''}"
                        ),
                        reporter_id=header.inspector_id,
                        reporter_name=header.inspector_name,
                    )
                    fault_uuid = fault.uuid
                await EquipmentRoutePatrolLine.create(
                    tenant_id=tenant_id,
                    route_patrol_id=header.id,
                    step_no=line_input.step_no,
                    equipment_id=equipment.id,
                    equipment_uuid=equipment.uuid,
                    equipment_code=equipment.code,
                    equipment_name=equipment.name,
                    item_id=line_input.item_id,
                    item_code=line_input.item_code,
                    item_name=line_input.item_name,
                    measured_value=line_input.measured_value,
                    is_pass=is_pass,
                    fault_report_uuid=fault_uuid,
                    remark=line_input.remark,
                )

            header.has_abnormality = has_abnormality
            header.status = "已完成"
            await header.save()
            return header

    async def get(self, tenant_id: int, row_id: int) -> EquipmentRoutePatrol:
        row = await EquipmentRoutePatrol.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"巡检单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        route_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        patrol_start_date: Optional[str] = None,
        patrol_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        has_abnormality: Optional[bool] = None,
    ) -> tuple[List[EquipmentRoutePatrol], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            ROUTE_PATROL_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            resolve_equipment_list_order_by,
        )

        qs = EquipmentRoutePatrol.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if route_id is not None:
            qs = qs.filter(route_id=route_id)
        if status:
            qs = qs.filter(status=status)
        if has_abnormality is not None:
            qs = qs.filter(has_abnormality=has_abnormality)
        qs = apply_equipment_keyword_filter(
            qs,
            keyword,
            ["document_no", "route_code", "route_name", "inspector_name"],
        )
        qs = apply_equipment_document_date_range(
            qs,
            date_field="patrol_date",
            start_date=patrol_start_date,
            end_date=patrol_end_date,
        )
        qs = apply_equipment_created_date_range(
            qs,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        total = await qs.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            ROUTE_PATROL_SORTABLE_FIELDS,
            "-created_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(self, tenant_id: int, row_id: int, data: RoutePatrolUpdate) -> EquipmentRoutePatrol:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            await header.save()
            if data.lines is not None:
                await EquipmentRoutePatrolLine.filter(
                    tenant_id=tenant_id,
                    route_patrol_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=datetime.now())
                for line_input in data.lines:
                    equipment = await _get_equipment_or_raise(tenant_id, line_input.equipment_id)
                    is_pass = line_input.is_pass
                    fault_uuid: Optional[str] = None
                    if not is_pass:
                        fault = await _create_fault_from_ops(
                            tenant_id=tenant_id,
                            equipment=equipment,
                            source_type="route_patrol",
                            source_uuid=header.uuid,
                            description=f"巡检单 {header.document_no} 不合格项",
                            reporter_id=header.inspector_id,
                            reporter_name=header.inspector_name,
                        )
                        fault_uuid = fault.uuid
                    await EquipmentRoutePatrolLine.create(
                        tenant_id=tenant_id,
                        route_patrol_id=header.id,
                        step_no=line_input.step_no,
                        equipment_id=equipment.id,
                        equipment_uuid=equipment.uuid,
                        equipment_code=equipment.code,
                        equipment_name=equipment.name,
                        item_id=line_input.item_id,
                        item_code=line_input.item_code,
                        item_name=line_input.item_name,
                        measured_value=line_input.measured_value,
                        is_pass=is_pass,
                        fault_report_uuid=fault_uuid,
                        remark=line_input.remark,
                    )
            return header

    async def delete(self, tenant_id: int, row_id: int) -> None:
        header = await self.get(tenant_id, row_id)
        header.deleted_at = datetime.now()
        await header.save()


class EquipmentScrapApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: ScrapApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> EquipmentScrapApplication:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        if equipment.status == "报废":
            raise ValidationError("设备已报废，不能重复申请")
        application_no = await _generate_code(tenant_id, "equipment_scrap_application_code", "SA")
        return await EquipmentScrapApplication.create(
            tenant_id=tenant_id,
            application_no=application_no,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            equipment_code=equipment.code,
            equipment_name=equipment.name,
            reason=data.reason,
            scrap_date=data.scrap_date,
            applicant_id=data.applicant_id or operator_id,
            applicant_name=data.applicant_name or operator_name,
            remark=data.remark,
            attachments=data.attachments,
            status="草稿",
        )

    async def get(self, tenant_id: int, row_id: int) -> EquipmentScrapApplication:
        row = await EquipmentScrapApplication.filter(
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
        equipment_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        scrap_start_date: Optional[str] = None,
        scrap_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[EquipmentScrapApplication], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_SCRAP_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        qs = EquipmentScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if equipment_id is not None:
            qs = qs.filter(equipment_id=equipment_id)
        if status:
            qs = qs.filter(status=status)
        qs = apply_equipment_keyword_filter(
            qs,
            pick_search_keyword(keyword, search),
            ["application_no", "equipment_name", "equipment_code", "reason", "applicant_name"],
        )
        qs = apply_equipment_document_date_range(
            qs,
            date_field="scrap_date",
            start_date=scrap_start_date,
            end_date=scrap_end_date,
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
            EQUIPMENT_SCRAP_SORTABLE_FIELDS,
            "-updated_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ScrapApplicationUpdate,
    ) -> EquipmentScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await row.save()
        return row

    async def submit(self, tenant_id: int, row_id: int) -> EquipmentScrapApplication:
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
    ) -> EquipmentScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        equipment = await _get_equipment_or_raise(tenant_id, row.equipment_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            if not row.scrap_date:
                row.scrap_date = date.today()
            await row.save()
            equipment.status = "报废"
            await equipment.save()
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> EquipmentScrapApplication:
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


class EquipmentTransferApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: TransferApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> EquipmentTransferApplication:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        application_no = await _generate_code(tenant_id, "equipment_transfer_application_code", "TA")
        return await EquipmentTransferApplication.create(
            tenant_id=tenant_id,
            application_no=application_no,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            equipment_code=equipment.code,
            equipment_name=equipment.name,
            from_workshop_id=equipment.workshop_id,
            from_workshop_name=equipment.workshop_name,
            from_workstation_id=equipment.workstation_id,
            from_workstation_name=equipment.workstation_name,
            to_workshop_id=data.to_workshop_id,
            to_workshop_name=data.to_workshop_name,
            to_workstation_id=data.to_workstation_id,
            to_workstation_name=data.to_workstation_name,
            to_status=data.to_status,
            reason=data.reason,
            transfer_date=data.transfer_date,
            applicant_id=data.applicant_id or operator_id,
            applicant_name=data.applicant_name or operator_name,
            remark=data.remark,
            status="草稿",
        )

    async def get(self, tenant_id: int, row_id: int) -> EquipmentTransferApplication:
        row = await EquipmentTransferApplication.filter(
            tenant_id=tenant_id,
            id=row_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"调拨单不存在: {row_id}")
        return row

    async def list(
        self,
        tenant_id: int,
        skip: int,
        limit: int,
        equipment_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        transfer_start_date: Optional[str] = None,
        transfer_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[EquipmentTransferApplication], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_TRANSFER_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        qs = EquipmentTransferApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if equipment_id is not None:
            qs = qs.filter(equipment_id=equipment_id)
        if status:
            qs = qs.filter(status=status)
        qs = apply_equipment_keyword_filter(
            qs,
            pick_search_keyword(keyword, search),
            [
                "application_no",
                "equipment_name",
                "equipment_code",
                "from_workshop_name",
                "to_workshop_name",
                "applicant_name",
            ],
        )
        qs = apply_equipment_document_date_range(
            qs,
            date_field="transfer_date",
            start_date=transfer_start_date,
            end_date=transfer_end_date,
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
            EQUIPMENT_TRANSFER_SORTABLE_FIELDS,
            "-updated_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: TransferApplicationUpdate,
    ) -> EquipmentTransferApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "草稿":
            raise ValidationError("仅草稿状态可编辑")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await row.save()
        return row

    async def submit(self, tenant_id: int, row_id: int) -> EquipmentTransferApplication:
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
    ) -> EquipmentTransferApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        equipment = await _get_equipment_or_raise(tenant_id, row.equipment_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = datetime.now()
            if not row.transfer_date:
                row.transfer_date = date.today()
            await row.save()
            if row.to_workshop_id is not None:
                equipment.workshop_id = row.to_workshop_id
            if row.to_workshop_name is not None:
                equipment.workshop_name = row.to_workshop_name
            if row.to_workstation_id is not None:
                equipment.workstation_id = row.to_workstation_id
            if row.to_workstation_name is not None:
                equipment.workstation_name = row.to_workstation_name
            if row.to_status:
                equipment.status = row.to_status
            await equipment.save()
        return row

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        reject_reason: str,
        approver_id: Optional[int] = None,
        approver_name: Optional[str] = None,
    ) -> EquipmentTransferApplication:
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


class EquipmentOpsService:
    """设备运营服务聚合入口。"""

    inspection_item_service = EquipmentInspectionItemService()
    inspection_scheme_service = EquipmentInspectionSchemeService()
    patrol_route_service = EquipmentPatrolRouteService()
    maintenance_item_service = EquipmentMaintenanceItemService()
    maintenance_scheme_service = EquipmentMaintenanceSchemeService()
    scheme_binding_service = EquipmentSchemeBindingService()
    spot_check_service = EquipmentSpotCheckService()
    route_patrol_service = EquipmentRoutePatrolService()
    scrap_application_service = EquipmentScrapApplicationService()
    transfer_application_service = EquipmentTransferApplicationService()
