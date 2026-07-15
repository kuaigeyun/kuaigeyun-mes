"""设备台账履历：聚合点检/巡检/维保/产出/验收/状态调整与状态日志。"""

from __future__ import annotations

import asyncio
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_acceptance import HaoligoEquipmentAcceptanceSheet
from apps.haoligo.models.equipment_operations import (
    HaoligoEquipmentOutputRecord,
    HaoligoEquipmentRoutePatrolLine,
    HaoligoEquipmentSpotCheck,
    HaoligoEquipmentStatusAdjustment,
)
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog
from apps.haoligo.models.equipment_upkeep import (
    HaoligoEquipmentUpkeepCompleteSheet,
    HaoligoEquipmentUpkeepSheet,
)

EquipmentOperationKind = Literal[
    "spot_check",
    "route_patrol",
    "upkeep",
    "upkeep_complete",
    "output",
    "acceptance",
    "status_adjustment",
    "status_change",
]

_OPERATION_RECORDS_CAP = 200
_PER_KIND_LIMIT = 80
_OPERATION_DETAIL_TEXT_MAX = 400

_STATUS_LABELS = {
    "running": "运行",
    "repair": "维修",
    "shutdown": "停机",
    "standby": "待机",
}


class EquipmentOperationRecordFieldOut(BaseModel):
    label: str
    value: str


class EquipmentOperationRecordOut(BaseModel):
    """设备台账详情用：关联单据与状态变更摘要（按发生时间倒序）。"""

    kind: EquipmentOperationKind
    occurred_at: datetime
    record_id: int
    uuid: str
    title: str
    detail: str = ""
    fields: List[EquipmentOperationRecordFieldOut] = Field(default_factory=list)
    sheet_no: Optional[str] = Field(None, description="业务单号；历史数据可能为空")


class EquipmentOperationRecordsResponse(BaseModel):
    items: List[EquipmentOperationRecordOut]


def _clip(value: str, *, max_len: int = _OPERATION_DETAIL_TEXT_MAX) -> str:
    s = (value or "").strip()
    if len(s) <= max_len:
        return s
    return f"{s[: max_len - 1]}…"


def _fmt_decimal(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        s = str(value).strip()
        return s or None
    text = format(d.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def _status_label(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return _STATUS_LABELS.get(s.lower(), s)


def _field(label: str, value: Any) -> Optional[EquipmentOperationRecordFieldOut]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        text = _fmt_decimal(value)
    else:
        text = str(value).strip()
    if not text:
        return None
    return EquipmentOperationRecordFieldOut(label=label, value=_clip(text))


def _build_fields(*pairs: tuple[str, Any]) -> List[EquipmentOperationRecordFieldOut]:
    out: List[EquipmentOperationRecordFieldOut] = []
    for label, value in pairs:
        f = _field(label, value)
        if f:
            out.append(f)
    return out


def _event(
    *,
    kind: EquipmentOperationKind,
    occurred_at: datetime,
    record_id: int,
    uuid: str,
    title: str,
    sheet_no: Optional[str],
    field_pairs: List[tuple[str, Any]],
) -> EquipmentOperationRecordOut:
    fields = _build_fields(*field_pairs)
    detail = "；".join(f"{item.label}：{item.value}" for item in fields)
    return EquipmentOperationRecordOut(
        kind=kind,
        occurred_at=occurred_at,
        record_id=record_id,
        uuid=uuid,
        title=title,
        sheet_no=sheet_no,
        fields=fields,
        detail=detail,
    )


async def list_equipment_operation_records(
    *,
    tenant_id: int,
    equipment_id: int,
) -> EquipmentOperationRecordsResponse:
    equipment = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not equipment:
        return EquipmentOperationRecordsResponse(items=[])

    async def load_spot_checks():
        return (
            await tenant_alive(HaoligoEquipmentSpotCheck, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-recorded_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_upkeep_sheets():
        return (
            await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-created_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_outputs():
        return (
            await tenant_alive(HaoligoEquipmentOutputRecord, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-recorded_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_status_adjustments():
        return (
            await tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-recorded_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_acceptance():
        return (
            await tenant_alive(HaoligoEquipmentAcceptanceSheet, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-created_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_status_logs():
        return (
            await tenant_alive(HaoligoEquipmentOperationalStatusLog, tenant_id)
            .filter(equipment_id=equipment_id)
            .order_by("-created_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_route_patrol_lines():
        return (
            await tenant_alive(HaoligoEquipmentRoutePatrolLine, tenant_id)
            .filter(equipment_id=equipment_id)
            .prefetch_related("header")
            .order_by("-id")
            .limit(_PER_KIND_LIMIT)
        )

    async def load_upkeep_completes():
        return (
            await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
            .filter(source_upkeep_sheet__equipment_id=equipment_id)
            .order_by("-created_at", "-id")
            .limit(_PER_KIND_LIMIT)
        )

    (
        spot_checks,
        upkeep_sheets,
        complete_sheets,
        outputs,
        status_adjustments,
        acceptances,
        status_logs,
        patrol_lines,
    ) = await asyncio.gather(
        load_spot_checks(),
        load_upkeep_sheets(),
        load_upkeep_completes(),
        load_outputs(),
        load_status_adjustments(),
        load_acceptance(),
        load_status_logs(),
        load_route_patrol_lines(),
    )

    events: List[EquipmentOperationRecordOut] = []

    for row in spot_checks:
        events.append(
            _event(
                kind="spot_check",
                occurred_at=row.recorded_at or row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title="设备点检单",
                field_pairs=[
                    ("点检方案", row.inspection_param_set_name),
                    ("运行状态", _status_label(row.applied_operational_status)),
                    ("异常描述", row.abnormal_description),
                ],
            )
        )

    for line in patrol_lines:
        header = getattr(line, "header", None)
        occurred = getattr(header, "recorded_at", None) or line.created_at
        sheet_no = (getattr(header, "sheet_no", None) or "").strip() or None
        line_status = (line.line_status or "").strip()
        status_text = {
            "normal": "正常",
            "abnormal": "异常",
            "not_producing": "未生产",
        }.get(line_status, line_status or None)
        events.append(
            _event(
                kind="route_patrol",
                occurred_at=occurred,
                record_id=line.id,
                uuid=line.uuid,
                sheet_no=sheet_no,
                title="路线巡检",
                field_pairs=[
                    ("巡检结果", status_text),
                    ("运行状态", _status_label(line.applied_operational_status)),
                    ("异常描述", line.abnormal_description),
                ],
            )
        )

    for row in upkeep_sheets:
        svc = (row.service_type or "").strip() or "维保"
        events.append(
            _event(
                kind="upkeep",
                occurred_at=row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title=f"设备{svc}单",
                field_pairs=[
                    ("申请人", row.applicant_name),
                    ("申请部门", row.department_name),
                    ("方案", row.upkeep_param_set_name),
                    ("说明", row.description),
                ],
            )
        )

    for row in complete_sheets:
        svc = (row.service_type or "").strip() or "维保"
        events.append(
            _event(
                kind="upkeep_complete",
                occurred_at=row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title=f"设备{svc}完成单",
                field_pairs=[
                    ("来源单号", row.source_order_no),
                    ("申请人", row.applicant_name),
                    ("完修内容", row.completion_content or row.repair_content),
                    ("维修结果", row.repair_result),
                ],
            )
        )

    for row in outputs:
        events.append(
            _event(
                kind="output",
                occurred_at=row.recorded_at or row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title="设备产出单",
                field_pairs=[
                    ("制令单号", row.work_order_no),
                    ("成品", row.finished_product_name or row.product_name),
                    ("完成数量", _fmt_decimal(row.completed_qty)),
                    ("作业人员", row.operator_name),
                ],
            )
        )

    for row in acceptances:
        events.append(
            _event(
                kind="acceptance",
                occurred_at=row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title="新设备验收单",
                field_pairs=[
                    ("设备名称", row.equipment_name),
                    ("安装位置", row.install_location),
                    ("工作流状态", row.workflow_status),
                    ("制造商", row.manufacturer_name),
                ],
            )
        )

    for row in status_adjustments:
        events.append(
            _event(
                kind="status_adjustment",
                occurred_at=row.recorded_at or row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=(row.sheet_no or "").strip() or None,
                title="设备状态调整单",
                field_pairs=[
                    ("调整前", _status_label(row.old_operational_status)),
                    ("调整后", _status_label(row.new_operational_status)),
                    ("备注", row.remark),
                ],
            )
        )

    for row in status_logs:
        events.append(
            _event(
                kind="status_change",
                occurred_at=row.created_at,
                record_id=row.id,
                uuid=row.uuid,
                sheet_no=None,
                title="运行状态变更",
                field_pairs=[
                    ("变更前", _status_label(row.old_status)),
                    ("变更后", _status_label(row.new_status)),
                    ("操作人", row.changed_by_user_id),
                ],
            )
        )

    events.sort(key=lambda e: (e.occurred_at, e.record_id), reverse=True)
    return EquipmentOperationRecordsResponse(items=events[:_OPERATION_RECORDS_CAP])
