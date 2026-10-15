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
    INSPECTION_CAPTURE_MODES,
    INSPECTION_SCHEME_CYCLE_TYPES,
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
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

T = TypeVar("T")


def _now_doc_no(prefix: str) -> str:
    """无编码规则时的兜底单号：须在并发连建时仍唯一（秒级不够）。"""
    import secrets

    now = resolve_business_datetime()
    return (
        f"{prefix}{now.strftime('%Y%m%d%H%M%S')}"
        f"{now.microsecond:06d}{secrets.token_hex(2)}"
    )


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


def _compute_numeric_is_pass(
    measured_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
) -> bool:
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


def _line_is_pass(
    value_type: Optional[str],
    measured_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
    explicit_is_pass: Optional[bool] = None,
) -> bool:
    vt = (value_type or "boolean").strip().lower()
    if vt == "numeric":
        has_limits = numeric_min is not None or numeric_max is not None
        measured = (measured_value or "").strip()
        if has_limits and measured:
            return _compute_numeric_is_pass(measured_value, numeric_min, numeric_max)
        if explicit_is_pass is not None:
            return explicit_is_pass
        return _compute_numeric_is_pass(measured_value, numeric_min, numeric_max)
    if explicit_is_pass is not None:
        return explicit_is_pass
    if vt == "boolean":
        mv = (measured_value or "").strip().lower()
        if mv in ("false", "0", "否", "不合格", "no"):
            return False
        return True
    return True


def _normalize_capture_mode(raw: Optional[str], *, required: bool = True) -> str:
    mode = (raw or "").strip().upper()
    if not mode:
        if required:
            raise ValidationError("请选择采集方式（A/B/C）")
        raise ValidationError("采集方式不能为空")
    if mode not in INSPECTION_CAPTURE_MODES:
        raise ValidationError(f"采集方式必须是 {list(INSPECTION_CAPTURE_MODES)} 之一")
    return mode


def _normalize_cycle_type(raw: Optional[str], *, required: bool = True) -> Optional[str]:
    cycle = (raw or "").strip()
    if not cycle:
        if required:
            raise ValidationError("请选择点检周期")
        return None
    if cycle not in INSPECTION_SCHEME_CYCLE_TYPES:
        raise ValidationError(f"点检周期必须是 {list(INSPECTION_SCHEME_CYCLE_TYPES)} 之一")
    return cycle


def _normalize_scheme_domain(raw: Optional[str]) -> str:
    domain = (raw or "equipment").strip().lower() or "equipment"
    if domain not in ("equipment", "esd"):
        raise ValidationError("点检方案业务域必须是 equipment 或 esd")
    return domain


def _attachment_count(attachments: Optional[List[dict]]) -> int:
    if not attachments:
        return 0
    return len([a for a in attachments if isinstance(a, dict)])


def _assert_scheme_capture_config(
    capture_mode: str,
    lines: Optional[List[InspectionSchemeLineCreate]],
) -> None:
    line_list = list(lines or [])
    if capture_mode == "B":
        if line_list:
            raise ValidationError("采集方式 B（仅拍照）不配置点检项行，请清空方案行")
        return
    if not line_list:
        raise ValidationError("采集方式 A/C 至少配置一个点检项")
    if capture_mode == "C" and not any(bool(l.photo_required) for l in line_list):
        raise ValidationError("采集方式 C 至少指定一项必须拍照")


def _assert_spot_check_capture_payload(
    capture_mode: str,
    *,
    attachments: Optional[List[dict]],
    lines: List[SpotCheckLineInput],
) -> None:
    if capture_mode == "B":
        if _attachment_count(attachments) < 1:
            raise ValidationError("采集方式 B 须至少上传一张点检照片")
        return
    if not lines:
        raise ValidationError("采集方式 A/C 须提交点检行结果")
    if capture_mode == "C":
        for line in lines:
            if not bool(line.photo_required):
                continue
            label = line.item_name or line.item_code or str(line.item_id or line.line_no)
            if _attachment_count(line.attachments) < 1:
                raise ValidationError(f"点检项「{label}」须上传照片")


def _assert_route_patrol_capture_payload(lines: List[RoutePatrolLineInput]) -> None:
    """巡检逐步绑定方案：按行上的 capture_mode 校验 A/B/C（与点检同源）。"""
    if not lines:
        raise ValidationError("须提交巡检行结果")
    for line in lines:
        mode = _normalize_capture_mode(getattr(line, "capture_mode", None) or "A")
        label = (
            line.item_name
            or line.item_code
            or f"步骤{line.step_no}"
        )
        if mode == "B":
            if _attachment_count(line.attachments) < 1:
                raise ValidationError(f"采集方式 B：步骤「{label}」须至少上传一张巡检照片")
            continue
        if mode == "C" and bool(line.photo_required):
            if _attachment_count(line.attachments) < 1:
                raise ValidationError(f"巡检项「{label}」须上传照片")


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
        "method": item.method,
        "judgment_standard": item.judgment_standard,
        "value_type": item.value_type,
        "unit": item.unit,
        "numeric_min": item.numeric_min,
        "numeric_max": item.numeric_max,
    }


async def _load_inspection_item_map(
    tenant_id: int,
    item_ids: List[Optional[int]],
) -> Dict[int, EquipmentInspectionItem]:
    ids = sorted({int(i) for i in item_ids if i})
    if not ids:
        return {}
    rows = await EquipmentInspectionItem.filter(
        tenant_id=tenant_id,
        id__in=ids,
        deleted_at__isnull=True,
    ).all()
    return {int(row.id): row for row in rows}


def _resolve_inspection_item_value_spec(
    item: Optional[EquipmentInspectionItem],
    *,
    fallback_value_type: Optional[str] = None,
    fallback_unit: Optional[str] = None,
    fallback_numeric_min: Optional[Decimal] = None,
    fallback_numeric_max: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """点检项主数据为 value_type / 单位 / 上下限真源；方案行快照可能过期。"""
    if item is not None:
        return {
            "value_type": (item.value_type or "boolean").strip().lower(),
            "unit": item.unit or fallback_unit,
            "numeric_min": item.numeric_min if item.numeric_min is not None else fallback_numeric_min,
            "numeric_max": item.numeric_max if item.numeric_max is not None else fallback_numeric_max,
        }
    return {
        "value_type": (fallback_value_type or "boolean").strip().lower(),
        "unit": fallback_unit,
        "numeric_min": fallback_numeric_min,
        "numeric_max": fallback_numeric_max,
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
        fault_date=resolve_business_datetime(),
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
        row.deleted_at = resolve_business_datetime()
        await row.save()


class EquipmentInspectionItemService(_MasterCRUDMixin):
    model = EquipmentInspectionItem

    async def create(self, tenant_id: int, data: InspectionItemCreate, current_user: Optional[User] = None) -> EquipmentInspectionItem:
        existing = await EquipmentInspectionItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"点检项编码已存在: {data.code}")
        payload = data.model_dump()
        apply_create_audit(payload, current_user)
        return await EquipmentInspectionItem.create(
            tenant_id=tenant_id,
            **payload,
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: InspectionItemUpdate,
        current_user: Optional[User] = None,
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
        apply_update_audit(row, current_user)
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
        ).update(deleted_at=resolve_business_datetime())
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
                method=line.method or snap["method"],
                judgment_standard=line.judgment_standard or snap["judgment_standard"],
                value_type=line.value_type or snap["value_type"],
                unit=line.unit or snap["unit"],
                numeric_min=line.numeric_min if line.numeric_min is not None else snap["numeric_min"],
                numeric_max=line.numeric_max if line.numeric_max is not None else snap["numeric_max"],
                is_critical=bool(line.is_critical),
                photo_required=bool(line.photo_required),
            )

    async def create(self, tenant_id: int, data: InspectionSchemeCreate, current_user: Optional[User] = None) -> EquipmentInspectionScheme:
        capture_mode = _normalize_capture_mode(data.capture_mode)
        cycle_type = _normalize_cycle_type(data.cycle_type, required=True)
        _assert_scheme_capture_config(capture_mode, data.lines)
        async with in_transaction():
            dup = await EquipmentInspectionScheme.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"点检方案编码已存在: {data.code}")
            payload = dict(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                description=data.description,
                domain=_normalize_scheme_domain(getattr(data, "domain", None)),
                cycle_type=cycle_type,
                capture_mode=capture_mode,
                reviewer_user_id=data.reviewer_user_id,
                reviewer_user_name=(data.reviewer_user_name or "").strip() or None,
                overdue_hours=int(data.overdue_hours or 8),
                review_overdue_hours=int(data.review_overdue_hours or 4),
                is_active=data.is_active,
            )
            apply_create_audit(payload, current_user)
            scheme = await EquipmentInspectionScheme.create(**payload)
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: InspectionSchemeUpdate,
        current_user: Optional[User] = None,
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
            if "capture_mode" in update_data:
                update_data["capture_mode"] = _normalize_capture_mode(update_data.get("capture_mode"))
            if "domain" in update_data:
                update_data["domain"] = _normalize_scheme_domain(update_data.get("domain"))
            if "cycle_type" in update_data:
                update_data["cycle_type"] = _normalize_cycle_type(
                    update_data.get("cycle_type"),
                    required=True,
                )
            for k, v in update_data.items():
                setattr(scheme, k, v)
            apply_update_audit(scheme, current_user)
            await scheme.save()
            if data.lines is not None:
                capture_mode = _normalize_capture_mode(
                    getattr(scheme, "capture_mode", None) or data.capture_mode
                )
                _assert_scheme_capture_config(capture_mode, data.lines)
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            elif "capture_mode" in data.model_fields_set:
                existing_lines = await self._load_lines(tenant_id, scheme.id)
                capture_mode = _normalize_capture_mode(scheme.capture_mode)
                _assert_scheme_capture_config(
                    capture_mode,
                    [
                        InspectionSchemeLineCreate(
                            item_id=l.item_id,
                            sort_order=l.sort_order,
                            photo_required=bool(getattr(l, "photo_required", False)),
                        )
                        for l in existing_lines
                    ],
                )
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
        ).update(deleted_at=resolve_business_datetime())
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

    async def create(self, tenant_id: int, data: PatrolRouteCreate, current_user: Optional[User] = None) -> EquipmentPatrolRoute:
        async with in_transaction():
            dup = await EquipmentPatrolRoute.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if dup:
                raise ValidationError(f"巡检路线编码已存在: {data.code}")
            payload = dict(
                tenant_id=tenant_id,
                code=data.code,
                name=data.name,
                workshop_id=data.workshop_id,
                workshop_name=data.workshop_name,
                description=data.description,
                is_active=data.is_active,
            )
            apply_create_audit(payload, current_user)
            route = await EquipmentPatrolRoute.create(**payload)
            if data.steps:
                await self._replace_steps(tenant_id, route.id, data.steps)
            return route

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: PatrolRouteUpdate,
        current_user: Optional[User] = None,
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
            apply_update_audit(route, current_user)
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

    async def create(self, tenant_id: int, data: MaintenanceItemCreate, current_user: Optional[User] = None) -> EquipmentMaintenanceItem:
        dup = await EquipmentMaintenanceItem.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if dup:
            raise ValidationError(f"保养项编码已存在: {data.code}")
        payload = data.model_dump()
        apply_create_audit(payload, current_user)
        return await EquipmentMaintenanceItem.create(
            tenant_id=tenant_id,
            **payload,
        )

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MaintenanceItemUpdate,
        current_user: Optional[User] = None,
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
        apply_update_audit(row, current_user)
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
        ).update(deleted_at=resolve_business_datetime())
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

    async def create(self, tenant_id: int, data: MaintenanceSchemeCreate, current_user: Optional[User] = None) -> EquipmentMaintenanceScheme:
        async with in_transaction():
            dup = await EquipmentMaintenanceScheme.filter(
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
                maintenance_type=data.maintenance_type,
                cycle_type=data.cycle_type,
                cycle_value=data.cycle_value,
                cycle_unit=data.cycle_unit,
                is_active=data.is_active,
            )
            apply_create_audit(payload, current_user)
            scheme = await EquipmentMaintenanceScheme.create(**payload)
            if data.lines:
                await self._replace_lines(tenant_id, scheme.id, data.lines)
            return scheme

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: MaintenanceSchemeUpdate,
        current_user: Optional[User] = None,
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
            apply_update_audit(scheme, current_user)
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

    async def create(self, tenant_id: int, data: SchemeBindingCreate, current_user: Optional[User] = None) -> EquipmentSchemeBinding:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        payload = dict(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            scheme_id=data.scheme_id,
            scheme_type=data.scheme_type,
        )
        apply_create_audit(payload, current_user)
        return await EquipmentSchemeBinding.create(**payload)

    async def bulk_replace(self, tenant_id: int, data: SchemeBindingBulkReplace, current_user: Optional[User] = None) -> List[EquipmentSchemeBinding]:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        async with in_transaction():
            await EquipmentSchemeBinding.filter(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                scheme_type=data.scheme_type,
                deleted_at__isnull=True,
            ).update(deleted_at=resolve_business_datetime())
            bindings = []
            for scheme_id in data.scheme_ids:
                payload = dict(
                    tenant_id=tenant_id,
                    equipment_id=equipment.id,
                    equipment_uuid=equipment.uuid,
                    scheme_id=scheme_id,
                    scheme_type=data.scheme_type,
                )
                apply_create_audit(payload, current_user)
                binding = await EquipmentSchemeBinding.create(**payload)
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
        binding.deleted_at = resolve_business_datetime()
        await binding.save()


class EquipmentSpotCheckService:
    scheme_service = EquipmentInspectionSchemeService()

    async def _locked_header(self, tenant_id: int, row_id: int) -> EquipmentSpotCheck:
        row = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id, id=row_id, deleted_at__isnull=True,
        ).select_for_update().first()
        if not row:
            raise NotFoundError(f"点检单不存在: {row_id}")
        return row

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
        scheme_ids = [b.scheme_id for b in bindings]
        esd_scheme_ids = set(
            await EquipmentInspectionScheme.filter(
                tenant_id=tenant_id,
                id__in=scheme_ids,
                domain="esd",
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )
        equipment_bindings = [b for b in bindings if b.scheme_id not in esd_scheme_ids]
        if not equipment_bindings:
            raise ValidationError("设备未绑定设备点检方案，请指定 scheme_id")
        if len(equipment_bindings) > 1:
            raise ValidationError("设备绑定了多个点检方案，请指定 scheme_id")
        return equipment_bindings[0].scheme_id

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
        capture_mode = _normalize_capture_mode(getattr(scheme, "capture_mode", None))
        item_map = await _load_inspection_item_map(tenant_id, [line.item_id for line in lines])
        preview_lines: List[SpotCheckPreviewLine] = []
        if capture_mode != "B":
            for idx, line in enumerate(lines):
                spec = _resolve_inspection_item_value_spec(
                    item_map.get(int(line.item_id)) if line.item_id else None,
                    fallback_value_type=line.value_type,
                    fallback_unit=line.unit,
                    fallback_numeric_min=line.numeric_min,
                    fallback_numeric_max=line.numeric_max,
                )
                preview_lines.append(
                    SpotCheckPreviewLine(
                        line_no=idx + 1,
                        item_id=line.item_id,
                        item_code=line.item_code,
                        item_name=line.item_name,
                        requirement=line.requirement,
                        method=getattr(line, "method", None),
                        judgment_standard=getattr(line, "judgment_standard", None),
                        value_type=spec["value_type"],
                        unit=spec["unit"],
                        numeric_min=spec["numeric_min"],
                        numeric_max=spec["numeric_max"],
                        is_critical=bool(getattr(line, "is_critical", False)),
                        photo_required=bool(getattr(line, "photo_required", False)),
                        is_pass=True,
                    )
                )
        return SpotCheckPreviewResponse(
            equipment_id=equipment_id,
            scheme_id=scheme.id,
            scheme_code=scheme.code,
            scheme_name=scheme.name,
            cycle_type=scheme.cycle_type,
            capture_mode=capture_mode,
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
        current_user: Optional[User] = None,
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
        capture_mode = _normalize_capture_mode(getattr(scheme, "capture_mode", None))

        async with in_transaction():
            document_no = await _generate_code(tenant_id, "equipment_spot_check_code", "SC")
            payload = dict(
                tenant_id=tenant_id,
                document_no=document_no,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_code=equipment.code,
                equipment_name=equipment.name,
                scheme_id=scheme.id,
                capture_mode=capture_mode,
                check_date=data.check_date or date.today(),
                inspector_id=(
                    data.inspector_id
                    or getattr(equipment, "spot_check_person_id", None)
                    or operator_id
                ),
                inspector_name=(
                    data.inspector_name
                    or getattr(equipment, "spot_check_person_name", None)
                    or operator_name
                ),
                reviewer_user_id=getattr(scheme, "reviewer_user_id", None),
                reviewer_user_name=getattr(scheme, "reviewer_user_name", None),
                attachments=data.attachments,
                remark=data.remark,
                status="待审核",
            )
            apply_create_audit(payload, current_user)
            header = await EquipmentSpotCheck.create(**payload)

            if capture_mode == "B":
                line_inputs: List[SpotCheckLineInput] = []
            elif data.lines:
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
                        method=getattr(sl, "method", None),
                        judgment_standard=getattr(sl, "judgment_standard", None),
                        value_type=sl.value_type,
                        unit=sl.unit,
                        numeric_min=sl.numeric_min,
                        numeric_max=sl.numeric_max,
                        photo_required=bool(getattr(sl, "photo_required", False)),
                    )
                    for idx, sl in enumerate(scheme_lines)
                ]

            _assert_spot_check_capture_payload(
                capture_mode,
                attachments=data.attachments,
                lines=line_inputs,
            )

            item_map = await _load_inspection_item_map(
                tenant_id,
                [line_input.item_id for line_input in line_inputs],
            )
            failed_descriptions: List[str] = []
            for line_input in line_inputs:
                spec = _resolve_inspection_item_value_spec(
                    item_map.get(int(line_input.item_id)) if line_input.item_id else None,
                    fallback_value_type=line_input.value_type,
                    fallback_unit=line_input.unit,
                    fallback_numeric_min=line_input.numeric_min,
                    fallback_numeric_max=line_input.numeric_max,
                )
                value_type = spec["value_type"]
                unit = spec["unit"]
                numeric_min = spec["numeric_min"]
                numeric_max = spec["numeric_max"]
                is_pass = _line_is_pass(
                    value_type,
                    line_input.measured_value,
                    numeric_min,
                    numeric_max,
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
                    method=line_input.method,
                    judgment_standard=line_input.judgment_standard,
                    value_type=value_type,
                    unit=unit,
                    measured_value=line_input.measured_value,
                    is_pass=is_pass,
                    photo_required=bool(line_input.photo_required),
                    remark=line_input.remark,
                    attachments=line_input.attachments,
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
            header.status = "待审核"
            await header.save()

            from apps.kuaizhizao.services.spot_check_reminder_service import (
                SpotCheckReminderService,
            )

            await SpotCheckReminderService.on_spot_check_created(tenant_id, header, scheme)
            if getattr(equipment, "force_spot_check_required", False):
                from apps.kuaizhizao.services.equipment_line_rebind_service import (
                    EquipmentLineRebindService,
                )

                await EquipmentLineRebindService.clear_force_spot_for_equipment(
                    tenant_id, equipment, current_user=current_user
                )
            return header

    async def approve(
        self,
        tenant_id: int,
        row_id: int,
        *,
        current_user: Optional[User] = None,
    ) -> EquipmentSpotCheck:
        from apps.common.audit_actor import operator_name_from_user
        from apps.kuaizhizao.services.spot_check_reminder_service import (
            SpotCheckReminderService,
        )

        async with in_transaction():
            header = await self._locked_header(tenant_id, row_id)
            if header.status != "待审核":
                raise ValidationError("仅待审核的点检单可审核通过")
            header.status = "已审核"
            header.reviewed_by = getattr(current_user, "id", None) if current_user else None
            header.reviewed_by_name = operator_name_from_user(current_user) or None
            header.reviewed_at = resolve_business_datetime()
            header.reject_reason = None
            apply_update_audit(header, current_user)
            await header.save()
            await SpotCheckReminderService.on_spot_check_reviewed(tenant_id, header)
            return header

    async def reject(
        self,
        tenant_id: int,
        row_id: int,
        *,
        reject_reason: str,
        current_user: Optional[User] = None,
    ) -> EquipmentSpotCheck:
        from apps.common.audit_actor import operator_name_from_user
        from apps.kuaizhizao.services.spot_check_reminder_service import (
            SpotCheckReminderService,
        )

        reason = (reject_reason or "").strip()
        if not reason:
            raise ValidationError("驳回原因不能为空")
        async with in_transaction():
            header = await self._locked_header(tenant_id, row_id)
            if header.status != "待审核":
                raise ValidationError("仅待审核的点检单可驳回")
            header.status = "已驳回"
            header.reject_reason = reason
            header.reviewed_by = getattr(current_user, "id", None) if current_user else None
            header.reviewed_by_name = operator_name_from_user(current_user) or None
            header.reviewed_at = resolve_business_datetime()
            apply_update_audit(header, current_user)
            await header.save()
            await SpotCheckReminderService.on_spot_check_reviewed(tenant_id, header)
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
        uuid: Optional[str] = None,
        scheme_domain: Optional[str] = None,
        scheme_id: Optional[int] = None,
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
        if uuid:
            qs = qs.filter(uuid=uuid.strip())
        if scheme_id is not None:
            qs = qs.filter(scheme_id=scheme_id)
        if scheme_domain:
            domain = _normalize_scheme_domain(scheme_domain)
            domain_scheme_ids = list(
                await EquipmentInspectionScheme.filter(
                    tenant_id=tenant_id,
                    domain=domain,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )
            if domain == "esd":
                if not domain_scheme_ids:
                    return [], 0
                qs = qs.filter(scheme_id__in=domain_scheme_ids)
            else:
                # 设备点检：含历史无方案单据，排除 esd 域方案
                esd_scheme_ids = list(
                    await EquipmentInspectionScheme.filter(
                        tenant_id=tenant_id,
                        domain="esd",
                        deleted_at__isnull=True,
                    ).values_list("id", flat=True)
                )
                if esd_scheme_ids:
                    qs = qs.exclude(scheme_id__in=esd_scheme_ids)
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

    async def update(self, tenant_id: int, row_id: int, data: SpotCheckUpdate, current_user: Optional[User] = None) -> EquipmentSpotCheck:
        async with in_transaction():
            header = await self._locked_header(tenant_id, row_id)
            if header.status not in ("待审核", "已驳回"):
                raise ValidationError("仅待审核或已驳回的点检单可编辑")
            prev_status = header.status
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            if data.status is not None and data.status != "待审核":
                raise ValidationError("请通过审核操作变更点检状态")
            for k, v in update_data.items():
                setattr(header, k, v)
            apply_update_audit(header, current_user)
            capture_mode = _normalize_capture_mode(getattr(header, "capture_mode", None))
            if data.lines is not None or "attachments" in data.model_fields_set:
                line_inputs = data.lines if data.lines is not None else [
                    SpotCheckLineInput(
                        line_no=l.line_no,
                        item_id=l.item_id,
                        item_code=l.item_code,
                        item_name=l.item_name,
                        requirement=l.requirement,
                        method=getattr(l, "method", None),
                        judgment_standard=getattr(l, "judgment_standard", None),
                        value_type=l.value_type,
                        unit=l.unit,
                        measured_value=l.measured_value,
                        is_pass=l.is_pass,
                        photo_required=bool(getattr(l, "photo_required", False)),
                        remark=l.remark,
                        attachments=l.attachments,
                    )
                    for l in await self._load_lines(tenant_id, header.id)
                ]
                attachments = (
                    data.attachments
                    if "attachments" in data.model_fields_set
                    else getattr(header, "attachments", None)
                )
                _assert_spot_check_capture_payload(
                    capture_mode,
                    attachments=attachments,
                    lines=line_inputs if capture_mode != "B" else [],
                )
            if data.lines is not None:
                await EquipmentSpotCheckLine.filter(
                    tenant_id=tenant_id,
                    spot_check_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=resolve_business_datetime())
                failed_descriptions: List[str] = []
                for line_input in data.lines:
                    is_pass = _line_is_pass(
                        line_input.value_type,
                        line_input.measured_value,
                        line_input.numeric_min,
                        line_input.numeric_max,
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
                        method=line_input.method,
                        judgment_standard=line_input.judgment_standard,
                        value_type=line_input.value_type,
                        unit=line_input.unit,
                        numeric_min=line_input.numeric_min,
                        numeric_max=line_input.numeric_max,
                        measured_value=line_input.measured_value,
                        is_pass=is_pass,
                        photo_required=bool(line_input.photo_required),
                        remark=line_input.remark,
                        attachments=line_input.attachments,
                    )
                    if not is_pass:
                        label = line_input.item_name or line_input.item_code or str(line_input.item_id)
                        failed_descriptions.append(
                            f"{label}: {line_input.measured_value or '不合格'}"
                        )
                has_abnormality = len(failed_descriptions) > 0
                header.has_abnormality = has_abnormality
                if has_abnormality:
                    header.abnormality_description = "；".join(failed_descriptions)
                    # 新变异常且尚无关联故障时补建（避免重复）
                    if not header.fault_report_uuid:
                        equipment = await _get_equipment_or_raise(
                            tenant_id, header.equipment_id
                        )
                        fault = await _create_fault_from_ops(
                            tenant_id=tenant_id,
                            equipment=equipment,
                            source_type="spot_check",
                            source_uuid=header.uuid,
                            description=(
                                f"点检单 {header.document_no} 不合格项: "
                                f"{header.abnormality_description}"
                            ),
                            reporter_id=header.inspector_id,
                            reporter_name=header.inspector_name,
                        )
                        header.fault_report_uuid = fault.uuid
                else:
                    header.abnormality_description = None
            header.status = "待审核"
            header.reject_reason = None
            header.reviewed_by = None
            header.reviewed_by_name = None
            header.reviewed_at = None
            await header.save()
            if prev_status == "已驳回" and header.scheme_id:
                from apps.kuaizhizao.services.spot_check_reminder_service import (
                    SpotCheckReminderService,
                )

                scheme, _ = await self.scheme_service.get_with_lines(
                    tenant_id, header.scheme_id
                )
                await SpotCheckReminderService.on_spot_check_created(
                    tenant_id, header, scheme
                )
            if getattr(header, "equipment_id", None):
                equipment = await Equipment.filter(
                    tenant_id=tenant_id,
                    id=header.equipment_id,
                    deleted_at__isnull=True,
                ).first()
                if equipment and getattr(equipment, "force_spot_check_required", False):
                    from apps.kuaizhizao.services.equipment_line_rebind_service import (
                        EquipmentLineRebindService,
                    )

                    await EquipmentLineRebindService.clear_force_spot_for_equipment(
                        tenant_id, equipment, current_user=current_user
                    )
            return header

    async def delete(self, tenant_id: int, row_id: int) -> None:
        header = await self.get(tenant_id, row_id)
        if header.status not in ("待审核", "已驳回"):
            raise ValidationError("仅待审核或已驳回的点检单可删除")
        header.deleted_at = resolve_business_datetime()
        await header.save()


class EquipmentRoutePatrolService:
    route_service = EquipmentPatrolRouteService()
    scheme_service = EquipmentInspectionSchemeService()

    async def preview_lines(self, tenant_id: int, route_id: int) -> RoutePatrolPreviewResponse:
        route, steps = await self.route_service.get_with_steps(tenant_id, route_id)
        expanded_steps: List[
            tuple[Any, Optional[EquipmentInspectionScheme], List[EquipmentInspectionSchemeLine], str]
        ] = []
        for step in steps:
            if not step.scheme_id:
                expanded_steps.append((step, None, [], "A"))
                continue
            scheme, scheme_lines = await self.scheme_service.get_with_lines(tenant_id, step.scheme_id)
            capture_mode = _normalize_capture_mode(getattr(scheme, "capture_mode", None) or "A")
            expanded_steps.append((step, scheme, scheme_lines, capture_mode))

        item_map = await _load_inspection_item_map(
            tenant_id,
            [sl.item_id for _, _, scheme_lines, _ in expanded_steps for sl in scheme_lines],
        )

        preview_lines: List[RoutePatrolPreviewLine] = []
        line_counter = 0
        for step, _scheme, scheme_lines, capture_mode in expanded_steps:
            equipment = await _get_equipment_or_raise(tenant_id, step.equipment_id)
            eq_code = step.equipment_code or equipment.code
            eq_name = step.equipment_name or equipment.name
            if not step.scheme_id:
                line_counter += 1
                preview_lines.append(
                    RoutePatrolPreviewLine(
                        step_no=line_counter,
                        equipment_id=equipment.id,
                        equipment_uuid=equipment.uuid,
                        equipment_code=eq_code,
                        equipment_name=eq_name,
                        capture_mode="A",
                        photo_required=False,
                        is_pass=True,
                    )
                )
                continue
            if capture_mode == "B":
                line_counter += 1
                preview_lines.append(
                    RoutePatrolPreviewLine(
                        step_no=line_counter,
                        equipment_id=equipment.id,
                        equipment_uuid=equipment.uuid,
                        equipment_code=eq_code,
                        equipment_name=eq_name,
                        item_name="现场拍照",
                        capture_mode="B",
                        photo_required=True,
                        is_pass=True,
                    )
                )
                continue
            for sl in scheme_lines:
                spec = _resolve_inspection_item_value_spec(
                    item_map.get(int(sl.item_id)) if sl.item_id else None,
                    fallback_value_type=sl.value_type,
                    fallback_unit=sl.unit,
                    fallback_numeric_min=sl.numeric_min,
                    fallback_numeric_max=sl.numeric_max,
                )
                line_counter += 1
                preview_lines.append(
                    RoutePatrolPreviewLine(
                        step_no=line_counter,
                        equipment_id=equipment.id,
                        equipment_uuid=equipment.uuid,
                        equipment_code=eq_code,
                        equipment_name=eq_name,
                        item_id=sl.item_id,
                        item_code=sl.item_code,
                        item_name=sl.item_name,
                        capture_mode=capture_mode,
                        requirement=sl.requirement,
                        method=getattr(sl, "method", None),
                        judgment_standard=getattr(sl, "judgment_standard", None),
                        value_type=spec["value_type"],
                        unit=spec["unit"],
                        photo_required=bool(getattr(sl, "photo_required", False)),
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

    async def _persist_patrol_line(
        self,
        *,
        tenant_id: int,
        header: EquipmentRoutePatrol,
        line_input: RoutePatrolLineInput,
        prior_fault: Optional[dict[tuple[int, Optional[int]], str]] = None,
    ) -> tuple[bool, Optional[str]]:
        equipment = await _get_equipment_or_raise(tenant_id, line_input.equipment_id)
        _reject_scrapped_equipment(equipment)
        capture_mode = _normalize_capture_mode(getattr(line_input, "capture_mode", None) or "A")
        item = None
        if line_input.item_id:
            item = await EquipmentInspectionItem.filter(
                tenant_id=tenant_id,
                id=line_input.item_id,
                deleted_at__isnull=True,
            ).first()
        spec = _resolve_inspection_item_value_spec(
            item,
            fallback_value_type=line_input.value_type,
            fallback_unit=line_input.unit,
        )
        value_type = spec["value_type"]
        unit = spec["unit"]
        numeric_min = spec["numeric_min"]
        numeric_max = spec["numeric_max"]
        is_pass = _line_is_pass(
            value_type,
            line_input.measured_value,
            numeric_min,
            numeric_max,
            line_input.is_pass,
        )
        fault_uuid: Optional[str] = None
        if not is_pass:
            inherit_key = (equipment.id, line_input.item_id)
            if prior_fault:
                fault_uuid = prior_fault.get(inherit_key)
            if not fault_uuid:
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
            capture_mode=capture_mode,
            requirement=line_input.requirement,
            method=line_input.method,
            judgment_standard=line_input.judgment_standard,
            value_type=value_type,
            unit=unit,
            measured_value=line_input.measured_value,
            is_pass=is_pass,
            photo_required=bool(line_input.photo_required) or capture_mode == "B",
            fault_report_uuid=fault_uuid,
            remark=line_input.remark,
            attachments=line_input.attachments,
        )
        return (not is_pass), fault_uuid

    async def create(
        self,
        tenant_id: int,
        data: RoutePatrolCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> EquipmentRoutePatrol:
        route, steps = await self.route_service.get_with_steps(tenant_id, data.route_id)
        if not steps:
            raise ValidationError("巡检路线没有步骤，无法创建巡检单")

        async with in_transaction():
            document_no = await _generate_code(tenant_id, "equipment_route_patrol_code", "RP")
            payload = dict(
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
            apply_create_audit(payload, current_user)
            header = await EquipmentRoutePatrol.create(**payload)

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
                        capture_mode=pl.capture_mode,
                        requirement=pl.requirement,
                        method=pl.method,
                        judgment_standard=pl.judgment_standard,
                        value_type=pl.value_type,
                        unit=pl.unit,
                        photo_required=pl.photo_required,
                    )
                    for pl in preview.lines
                ]

            _assert_route_patrol_capture_payload(line_inputs)

            has_abnormality = False
            for line_input in line_inputs:
                abnormal, _ = await self._persist_patrol_line(
                    tenant_id=tenant_id,
                    header=header,
                    line_input=line_input,
                )
                if abnormal:
                    has_abnormality = True

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
        uuid: Optional[str] = None,
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
        if uuid:
            qs = qs.filter(uuid=uuid.strip())
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

    async def update(self, tenant_id: int, row_id: int, data: RoutePatrolUpdate, current_user: Optional[User] = None) -> EquipmentRoutePatrol:
        async with in_transaction():
            header = await self.get(tenant_id, row_id)
            update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
            for k, v in update_data.items():
                setattr(header, k, v)
            apply_update_audit(header, current_user)
            if data.lines is not None:
                _assert_route_patrol_capture_payload(data.lines)
                old_lines = await EquipmentRoutePatrolLine.filter(
                    tenant_id=tenant_id,
                    route_patrol_id=header.id,
                    deleted_at__isnull=True,
                )
                # 按 equipment_id + item_id 继承原行故障 UUID，避免 update 重复建故障
                prior_fault: dict[tuple[int, Optional[int]], str] = {}
                for ol in old_lines:
                    if ol.fault_report_uuid:
                        prior_fault[(ol.equipment_id, ol.item_id)] = ol.fault_report_uuid
                await EquipmentRoutePatrolLine.filter(
                    tenant_id=tenant_id,
                    route_patrol_id=header.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=resolve_business_datetime())
                has_abnormality = False
                for line_input in data.lines:
                    abnormal, _ = await self._persist_patrol_line(
                        tenant_id=tenant_id,
                        header=header,
                        line_input=line_input,
                        prior_fault=prior_fault,
                    )
                    if abnormal:
                        has_abnormality = True
                header.has_abnormality = has_abnormality
            await header.save()
            return header

    async def delete(self, tenant_id: int, row_id: int) -> None:
        header = await self.get(tenant_id, row_id)
        header.deleted_at = resolve_business_datetime()
        await header.save()


class EquipmentScrapApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: ScrapApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> EquipmentScrapApplication:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        if equipment.status == "报废":
            raise ValidationError("设备已报废，不能重复申请")
        application_no = await _generate_code(tenant_id, "equipment_scrap_application_code", "SA")
        payload = dict(
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
        apply_create_audit(payload, current_user)
        return await EquipmentScrapApplication.create(**payload)

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
            "-created_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: ScrapApplicationUpdate,
        current_user: Optional[User] = None,
    ) -> EquipmentScrapApplication:
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
    ) -> EquipmentScrapApplication:
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
    ) -> EquipmentScrapApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        equipment = await _get_equipment_or_raise(tenant_id, row.equipment_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = resolve_business_datetime()
            if not row.scrap_date:
                row.scrap_date = date.today()
            apply_update_audit(row, current_user)
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
        current_user: Optional[User] = None,
    ) -> EquipmentScrapApplication:
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


class EquipmentTransferApplicationService:
    async def create(
        self,
        tenant_id: int,
        data: TransferApplicationCreate,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> EquipmentTransferApplication:
        equipment = await _get_equipment_or_raise(tenant_id, data.equipment_id)
        application_no = await _generate_code(tenant_id, "equipment_transfer_application_code", "TA")
        payload = dict(
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
        apply_create_audit(payload, current_user)
        return await EquipmentTransferApplication.create(**payload)

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
            "-created_at",
        )
        rows = await qs.order_by(order_clause).offset(skip).limit(limit)
        return rows, total

    async def update(
        self,
        tenant_id: int,
        row_id: int,
        data: TransferApplicationUpdate,
        current_user: Optional[User] = None,
    ) -> EquipmentTransferApplication:
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
    ) -> EquipmentTransferApplication:
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
    ) -> EquipmentTransferApplication:
        row = await self.get(tenant_id, row_id)
        if row.status != "已提交":
            raise ValidationError("仅已提交状态可审核通过")
        equipment = await _get_equipment_or_raise(tenant_id, row.equipment_id)
        async with in_transaction():
            row.status = "已审核"
            row.approver_id = approver_id
            row.approver_name = approver_name
            row.approved_at = resolve_business_datetime()
            if not row.transfer_date:
                row.transfer_date = date.today()
            apply_update_audit(row, current_user)
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
        current_user: Optional[User] = None,
    ) -> EquipmentTransferApplication:
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
