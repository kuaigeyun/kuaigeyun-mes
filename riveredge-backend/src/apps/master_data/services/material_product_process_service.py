"""
物料产品工艺服务：单表读写，并同步物料指派、计件单价。

工序序列仅存 material_product_process.lines，不回写共用工艺路线模板，
避免多物料共用一路线时互相覆盖。
"""

from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import NotFoundError, ValidationError
from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.material_product_process import MaterialProductProcess
from apps.master_data.models.process import Operation, ProcessRoute
from apps.master_data.models.employee_performance import PieceRate
from apps.master_data.schemas.material_product_process_schemas import (
    MaterialProductProcessResponse,
    MaterialProductProcessSave,
    ProductProcessLineSchema,
)
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

SECONDS_PER_HOUR = 3600.0


def _first_id(ids: Optional[List[int]]) -> Optional[int]:
    if not ids:
        return None
    for x in ids:
        if x is not None:
            return int(x)
    return None


def _product_process_seconds_to_wo_hours(
    total_seconds: Optional[float],
    qty: Optional[float],
) -> Optional[float]:
    """产品工艺秒（N 件合计）→ 工单小时/件。"""
    if total_seconds is None:
        return None
    basis = float(qty) if qty is not None and float(qty) > 0 else 1.0
    return (float(total_seconds) / basis) / SECONDS_PER_HOUR


def _route_hours_to_product_process_seconds(hours: Optional[float]) -> Optional[float]:
    """工艺路线小时 → 产品工艺秒。"""
    if hours is None:
        return None
    return float(hours) * SECONDS_PER_HOUR


def _convert_route_row_times_to_seconds(row: Dict[str, Any]) -> Dict[str, Any]:
    """路线 operation_sequence 行（小时）转为产品工艺行时间（秒）。"""
    out = dict(row)
    if "standard_time" in out or "standardTime" in out:
        std = _float_or_none(out.get("standard_time", out.get("standardTime")))
        if std is not None:
            sec = _route_hours_to_product_process_seconds(std)
            out["standard_time"] = sec
            out["standardTime"] = sec
        out["standard_time_qty"] = 1
        out["standardTimeQty"] = 1
        out.setdefault("standard_time_unit", "m")
        out.setdefault("standardTimeUnit", "m")
    if "setup_time" in out or "setupTime" in out:
        setup = _float_or_none(out.get("setup_time", out.get("setupTime")))
        if setup is not None:
            sec = _route_hours_to_product_process_seconds(setup)
            out["setup_time"] = sec
            out["setupTime"] = sec
        out.setdefault("setup_time_unit", "m")
        out.setdefault("setupTimeUnit", "m")
    return out


def _line_to_operation_payload(line: ProductProcessLineSchema, allow_jump: bool) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "uuid": line.operation_uuid,
        "code": line.code,
        "name": line.name,
        "reporting_type": line.reporting_type or "quantity",
        "reportingType": line.reporting_type or "quantity",
        "is_node_operation": allow_jump and bool(line.is_node_operation),
        "isNodeOperation": allow_jump and bool(line.is_node_operation),
    }
    if line.operation_id is not None:
        row["operation_id"] = line.operation_id
        row["operationId"] = line.operation_id
    om = line.over_report_mode or "none"
    ov = float(line.over_report_value or 0)
    if om != "none" or ov > 0:
        row["over_report_mode"] = om
        row["overReportMode"] = om
        row["over_report_value"] = ov
        row["overReportValue"] = ov
    std_hours = _product_process_seconds_to_wo_hours(line.standard_time, line.standard_time_qty)
    if std_hours is not None:
        row["standard_time"] = float(std_hours)
    setup_hours = _product_process_seconds_to_wo_hours(line.setup_time, 1.0)
    if setup_hours is not None:
        row["setup_time"] = float(setup_hours)
    ws = line.workshop_ids or []
    if ws:
        row["workshop_ids"] = ws
        row["workshop_id"] = ws[0]
    ops = line.operator_ids or []
    if ops:
        row["operator_ids"] = ops
        row["assigned_worker_id"] = ops[0]
    teams = line.team_ids or []
    if teams:
        row["team_ids"] = teams
        row["assigned_team_id"] = teams[0]
    eqs = line.equipment_ids or []
    if eqs:
        row["equipment_ids"] = eqs
        row["assigned_equipment_id"] = eqs[0]
    if line.is_outsourced:
        row["is_outsourced"] = True
        row["isOutsourced"] = True
        lead = line.outsource_lead_time_days
        row["outsource_lead_time_days"] = int(lead) if lead is not None else 1
        row["outsourceLeadTimeDays"] = row["outsource_lead_time_days"]
        if line.outsource_supplier_id:
            row["outsource_supplier_id"] = int(line.outsource_supplier_id)
            row["outsourceSupplierId"] = int(line.outsource_supplier_id)
        if line.outsource_supplier_name:
            row["outsource_supplier_name"] = line.outsource_supplier_name
            row["outsourceSupplierName"] = line.outsource_supplier_name
    return row


def lines_to_operation_sequence(
    lines: List[ProductProcessLineSchema],
    allow_jump: bool,
) -> Dict[str, Any]:
    return {
        "sequence": [ln.operation_uuid for ln in lines],
        "operations": [_line_to_operation_payload(ln, allow_jump) for ln in lines],
    }


async def _load_operations_by_uuid(tenant_id: int, uuids: List[str]) -> Dict[str, Operation]:
    if not uuids:
        return {}
    ops = await Operation.filter(
        tenant_id=tenant_id,
        uuid__in=uuids,
        deleted_at__isnull=True,
    ).all()
    return {o.uuid: o for o in ops}


async def _parse_sequence_to_line_dicts(tenant_id: int, seq: Any) -> List[Dict[str, Any]]:
    """解析工艺路线 operation_sequence 为行字典列表（保持顺序）。"""
    if not seq:
        return []
    result: List[Dict[str, Any]] = []

    if isinstance(seq, list):
        for item in seq:
            if isinstance(item, dict):
                u = item.get("uuid") or item.get("operation_uuid")
                if u:
                    result.append(dict(item))
            elif isinstance(item, str):
                result.append({"uuid": item})
        return result

    if not isinstance(seq, dict):
        return result

    ops = seq.get("operations")
    order = seq.get("sequence")
    if isinstance(ops, list) and isinstance(order, list):
        op_by_uuid = {}
        for o in ops:
            if isinstance(o, dict):
                u = o.get("uuid") or o.get("operation_uuid")
                if u:
                    op_by_uuid[str(u)] = o
        for u in order:
            su = str(u)
            if su in op_by_uuid:
                result.append(dict(op_by_uuid[su]))
            else:
                result.append({"uuid": su})
        return result

    if isinstance(ops, list):
        for o in ops:
            if isinstance(o, dict):
                u = o.get("uuid") or o.get("operation_uuid")
                if u:
                    result.append(dict(o))
        return result

    if isinstance(order, list):
        for u in order:
            result.append({"uuid": str(u)})
        if result:
            return result

    op_ids = seq.get("operation_ids") or seq.get("operationIds")
    if isinstance(op_ids, list) and op_ids:
        ids = [int(x) for x in op_ids if x is not None]
        if ids:
            ops_by_id = await Operation.filter(
                tenant_id=tenant_id,
                id__in=ids,
                deleted_at__isnull=True,
            ).all()
            by_id = {int(o.id): o for o in ops_by_id}
            for oid in ids:
                op = by_id.get(int(oid))
                if op:
                    result.append({"uuid": op.uuid, "operation_id": op.id})
            return result

    return result


def _operation_uuid_from_row(row: Dict[str, Any]) -> str:
    return str(row.get("uuid") or row.get("operation_uuid") or row.get("operationUuid") or "")


def _stored_line_to_dict(ln: Any) -> Optional[Dict[str, Any]]:
    if isinstance(ln, dict):
        return dict(ln)
    return None


def _merge_stored_lines_with_route(
    stored_lines: List[Any],
    route_row_dicts: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    以已存产品工艺行为准合并路线工序模板：
    - 仅返回 stored_lines 中仍保留的工序（用户在产品工艺页删除的不恢复）
    - 顺序优先跟随路线；路线中无对应项的已存行保留在末尾
    - 已存字段覆盖路线默认值
    """
    stored_by_uuid: Dict[str, Dict[str, Any]] = {}
    for ln in stored_lines:
        d = _stored_line_to_dict(ln)
        if not d:
            continue
        uid = _operation_uuid_from_row(d)
        if uid:
            stored_by_uuid[uid] = d

    merged: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for d in route_row_dicts:
        uid = _operation_uuid_from_row(d)
        if not uid or uid not in stored_by_uuid:
            continue
        seen.add(uid)
        stored = stored_by_uuid[uid]
        merged.append(
            _normalize_line_time_fields(
                {**d, **stored, "uuid": uid, "operation_uuid": uid}
            )
        )

    for uid, stored in stored_by_uuid.items():
        if uid in seen:
            continue
        merged.append(
            _normalize_line_time_fields(
                {**stored, "uuid": uid, "operation_uuid": uid}
            )
        )
    return merged


def _row_dict_to_line_schema(
    row: Dict[str, Any],
    op: Optional[Operation],
    piece_rate: Optional[Decimal],
) -> ProductProcessLineSchema:
    uid = _operation_uuid_from_row(row)
    qty = _float_or_none(row.get("standard_time_qty") or row.get("standardTimeQty"))
    std_unit = row.get("standard_time_unit") or row.get("standardTimeUnit") or "m"
    setup_unit = row.get("setup_time_unit") or row.get("setupTimeUnit") or "m"
    if std_unit not in ("h", "m", "s"):
        std_unit = "m"
    if setup_unit not in ("h", "m", "s"):
        setup_unit = "m"
    return ProductProcessLineSchema(
        operation_uuid=uid,
        operation_id=(
            row.get("operation_id")
            or row.get("operationId")
            or (op.id if op else None)
        ),
        code=row.get("code") or (op.code if op else None),
        name=row.get("name") or (op.name if op else None),
        standard_time=_seconds_field_from_row(row, "standardTime", "standard_time"),
        standard_time_qty=qty if qty is not None else 1,
        standard_time_unit=std_unit,
        setup_time=_seconds_field_from_row(row, "setupTime", "setup_time"),
        setup_time_unit=setup_unit,
        workshop_ids=_ids_from_row(row, "workshop"),
        operator_ids=_operator_ids_from_row(row),
        team_ids=_team_ids_from_row(row),
        equipment_ids=_equipment_ids_from_row(row),
        piece_rate=piece_rate,
        reporting_type=str(
            row.get("reporting_type") or row.get("reportingType") or (op.reporting_type if op else "quantity")
        ),
        is_node_operation=bool(row.get("is_node_operation") or row.get("isNodeOperation") or False),
        over_report_mode=str(row.get("over_report_mode") or row.get("overReportMode") or "none"),
        over_report_value=float(row.get("over_report_value") or row.get("overReportValue") or 0),
        is_outsourced=bool(
            row.get("is_outsourced")
            if row.get("is_outsourced") is not None
            else row.get("isOutsourced") or False
        ),
        outsource_lead_time_days=_int_or_none(
            row.get("outsource_lead_time_days")
            if row.get("outsource_lead_time_days") is not None
            else row.get("outsourceLeadTimeDays")
        ),
        outsource_supplier_id=_int_or_none(
            row.get("outsource_supplier_id") or row.get("outsourceSupplierId"),
            min_value=1,
        ),
        outsource_supplier_name=(
            str(row.get("outsource_supplier_name") or row.get("outsourceSupplierName") or "").strip()
            or None
        ),
    )


def _int_or_none(v: Any, *, min_value: int = 0) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        n = int(v)
        return n if n >= min_value else None
    except (TypeError, ValueError):
        return None


def _float_or_none(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _seconds_field_from_row(row: Dict[str, Any], camel: str, snake: str) -> Optional[float]:
    """
    读取产品工艺时间字段（单位：秒）。

    保存路径 model_dump(by_alias=True) 写入 camelCase；路线合并可能残留 snake_case 小时值。
    优先 camelCase；仅当 camel 缺失时才用 snake。两者都在且明显冲突时（camel 为秒、snake 为小时残留）取 camel。
    """
    camel_v = _float_or_none(row.get(camel))
    snake_v = _float_or_none(row.get(snake))
    if camel_v is not None and snake_v is not None and abs(camel_v - snake_v) > 1e-6:
        # 典型污染：standardTime=1800（秒）与 standard_time=0.5（路线小时残留）
        if camel_v >= 60 and 0 < snake_v < 60:
            return camel_v
        return camel_v
    if camel_v is not None:
        return camel_v
    return snake_v


def _normalize_line_time_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """合并后统一时间字段为秒，并去掉互相冲突的双写键。"""
    out = dict(row)
    std = _seconds_field_from_row(out, "standardTime", "standard_time")
    setup = _seconds_field_from_row(out, "setupTime", "setup_time")
    if std is not None:
        out["standardTime"] = std
        out["standard_time"] = std
    else:
        out.pop("standardTime", None)
        out.pop("standard_time", None)
    if setup is not None:
        out["setupTime"] = setup
        out["setup_time"] = setup
    else:
        out.pop("setupTime", None)
        out.pop("setup_time", None)
    return out


def _ids_from_row(row: Dict[str, Any], prefix: str) -> Optional[List[int]]:
    plural = row.get(f"{prefix}_ids") or row.get(f"{prefix}Ids")
    if isinstance(plural, list) and plural:
        return [int(x) for x in plural if x is not None]
    singular = row.get(f"{prefix}_id") or row.get(f"{prefix}Id")
    if singular is not None:
        try:
            return [int(singular)]
        except (TypeError, ValueError):
            return None
    return None


def _team_ids_from_row(row: Dict[str, Any]) -> Optional[List[int]]:
    plural = row.get("team_ids") or row.get("teamIds")
    if isinstance(plural, list) and plural:
        return [int(x) for x in plural if x is not None]
    for key in ("assigned_team_id", "assignedTeamId"):
        if row.get(key) is not None:
            try:
                return [int(row[key])]
            except (TypeError, ValueError):
                return None
    return None


def _operator_ids_from_row(row: Dict[str, Any]) -> Optional[List[int]]:
    plural = row.get("operator_ids") or row.get("operatorIds")
    if isinstance(plural, list) and plural:
        return [int(x) for x in plural if x is not None]
    for key in ("assigned_worker_id", "assignedWorkerId"):
        if row.get(key) is not None:
            try:
                return [int(row[key])]
            except (TypeError, ValueError):
                return None
    return None


def _equipment_ids_from_row(row: Dict[str, Any]) -> Optional[List[int]]:
    plural = row.get("equipment_ids") or row.get("equipmentIds")
    if isinstance(plural, list) and plural:
        return [int(x) for x in plural if x is not None]
    for key in ("assigned_equipment_id", "assignedEquipmentId"):
        if row.get(key) is not None:
            try:
                return [int(row[key])]
            except (TypeError, ValueError):
                return None
    return None


async def _compose_lines(
    tenant_id: int,
    material_id: int,
    process_route: Optional[ProcessRoute],
    stored_lines: Optional[List[Any]],
) -> List[ProductProcessLineSchema]:
    piece_map: Dict[int, Decimal] = {}
    rates = await PieceRate.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        is_active=True,
        deleted_at__isnull=True,
    ).all()
    for r in rates:
        if r.operation_id is not None:
            piece_map[int(r.operation_id)] = r.rate

    route_row_dicts: List[Dict[str, Any]] = []
    if process_route and process_route.operation_sequence:
        route_row_dicts = await _parse_sequence_to_line_dicts(
            tenant_id, process_route.operation_sequence
        )
        route_row_dicts = [_convert_route_row_times_to_seconds(d) for d in route_row_dicts]

    if stored_lines and route_row_dicts:
        row_dicts = _merge_stored_lines_with_route(stored_lines, route_row_dicts)
    elif stored_lines:
        row_dicts = [
            _normalize_line_time_fields(ln)
            for ln in stored_lines
            if isinstance(ln, dict)
        ]
    elif route_row_dicts:
        row_dicts = [_normalize_line_time_fields(d) for d in route_row_dicts]
    else:
        return []

    uuids = [
        _operation_uuid_from_row(d)
        for d in row_dicts
        if _operation_uuid_from_row(d)
    ]
    op_map = await _load_operations_by_uuid(tenant_id, uuids)

    lines: List[ProductProcessLineSchema] = []
    for d in row_dicts:
        uid = _operation_uuid_from_row(d)
        if not uid:
            continue
        op = op_map.get(uid)
        op_id = d.get("operation_id") or d.get("operationId") or (op.id if op else None)
        embedded_pr = d.get("piece_rate") or d.get("pieceRate")
        pr: Optional[Decimal] = None
        if embedded_pr is not None:
            try:
                pr = Decimal(str(embedded_pr))
            except Exception:
                pr = None
        if pr is None and op_id is not None:
            pr = piece_map.get(int(op_id))
        if pr is None and op:
            pr = piece_map.get(int(op.id))
        line = _row_dict_to_line_schema(d, op, pr)
        if op and not line.workshop_ids and op.default_workshop_ids:
            line.workshop_ids = list(op.default_workshop_ids)
        if op and not line.operator_ids and op.default_operator_ids:
            line.operator_ids = list(op.default_operator_ids)
        if op and not line.team_ids and op.default_team_ids:
            line.team_ids = list(op.default_team_ids)
        if op and not line.equipment_ids and op.default_equipment_ids:
            line.equipment_ids = list(op.default_equipment_ids)
        lines.append(line)
    return lines


def _stored_lines_to_schemas(stored_lines: List[Any]) -> List[ProductProcessLineSchema]:
    schemas: List[ProductProcessLineSchema] = []
    for ln in stored_lines:
        if isinstance(ln, dict):
            schemas.append(ProductProcessLineSchema.model_validate(ln))
    return schemas


class MaterialProductProcessService:
    @staticmethod
    async def _get_material(tenant_id: int, material_uuid: str) -> Material:
        material = await Material.filter(
            uuid=material_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        return material

    @staticmethod
    async def _resolve_route(
        tenant_id: int,
        route_uuid: Optional[str],
        material: Material,
    ) -> Optional[ProcessRoute]:
        if route_uuid:
            pr = await ProcessRoute.filter(
                uuid=route_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not pr:
                raise ValidationError("所选工艺路线不存在或已删除")
            return pr
        pr_id = getattr(material, "process_route_id", None)
        if pr_id:
            return await ProcessRoute.filter(
                id=int(pr_id),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
        return None

    @staticmethod
    async def list_product_process_route_assignments(tenant_id: int):
        """批量返回产品工艺表中的路线指派（materialUuid → processRouteUuid）。"""
        from apps.master_data.schemas.material_product_process_schemas import (
            ProductProcessRouteAssignmentItem,
            ProductProcessRouteAssignmentListResponse,
        )

        records = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            process_route_id__isnull=False,
        ).values("material_id", "process_route_id")
        if not records:
            return ProductProcessRouteAssignmentListResponse(items=[])

        material_ids = sorted({int(row["material_id"]) for row in records})
        route_ids = sorted({int(row["process_route_id"]) for row in records})

        material_rows = await Material.filter(
            id__in=material_ids,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).values("id", "uuid")
        material_uuid_by_id = {int(row["id"]): str(row["uuid"]) for row in material_rows}

        route_rows = await ProcessRoute.filter(
            id__in=route_ids,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).values("id", "uuid")
        route_uuid_by_id = {int(row["id"]): str(row["uuid"]) for row in route_rows}

        items: list[ProductProcessRouteAssignmentItem] = []
        seen: set[str] = set()
        for row in records:
            material_uuid = material_uuid_by_id.get(int(row["material_id"]))
            route_uuid = route_uuid_by_id.get(int(row["process_route_id"]))
            if not material_uuid or not route_uuid or material_uuid in seen:
                continue
            seen.add(material_uuid)
            items.append(
                ProductProcessRouteAssignmentItem(
                    material_uuid=material_uuid,
                    process_route_uuid=route_uuid,
                )
            )
        return ProductProcessRouteAssignmentListResponse(items=items)

    @staticmethod
    async def get_for_material(tenant_id: int, material_uuid: str) -> MaterialProductProcessResponse:
        material = await MaterialProductProcessService._get_material(tenant_id, material_uuid)
        record = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            deleted_at__isnull=True,
        ).first()

        stored_lines = record.lines if record else None
        allow_jump = bool(record.allow_operation_jump) if record else False
        process_route = await MaterialProductProcessService.resolve_process_route_for_material(
            tenant_id, material.id
        )
        if process_route and not record:
            allow_jump = bool(getattr(process_route, "allow_operation_jump", False))

        lines = await _compose_lines(
            tenant_id,
            material.id,
            process_route,
            stored_lines,
        )

        return MaterialProductProcessResponse(
            material_uuid=material.uuid,
            material_id=material.id,
            process_route_uuid=process_route.uuid if process_route else None,
            process_route_id=process_route.id if process_route else None,
            allow_operation_jump=allow_jump,
            lines=lines,
            created_at=getattr(record, "created_at", None) if record else None,
            updated_at=getattr(record, "updated_at", None) if record else None,
            **(audit_response_fields(record) if record else {}),
        )

    @staticmethod
    async def sync_process_route_from_material(
        tenant_id: int,
        material_id: int,
        *,
        previous_process_route_id: Optional[int],
        new_process_route_id: Optional[int],
        current_user: Optional[User] = None,
    ) -> bool:
        """
        物料默认工艺路线变更后，将已有产品工艺记录的路线与工序模板对齐。

        与 save_for_material 互为补充：产品工艺「另存为新路线」会回写物料 FK；物料保存须同步产品工艺表，
        否则工单仍按产品工艺表旧路线解析（优先级高于物料 FK）。

        无产品工艺记录时不新建（生效路线可继续走物料 FK）。
        """
        if previous_process_route_id == new_process_route_id:
            return False

        material = await Material.filter(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not material or getattr(material, "source_type", None) != "Make":
            return False

        record = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
        ).first()
        if not record:
            return False

        process_route: Optional[ProcessRoute] = None
        if new_process_route_id is not None:
            process_route = await ProcessRoute.filter(
                id=int(new_process_route_id),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()

        allow_jump = bool(getattr(process_route, "allow_operation_jump", False)) if process_route else False
        lines_schemas = await _compose_lines(tenant_id, material_id, process_route, None)
        lines_json = [ln.model_dump(mode="json", by_alias=True) for ln in lines_schemas]

        record.process_route_id = int(new_process_route_id) if new_process_route_id else None
        record.allow_operation_jump = allow_jump
        record.lines = lines_json
        apply_update_audit(record, current_user)
        await record.save(
            update_fields=[
                "process_route_id",
                "allow_operation_jump",
                "lines",
                "updated_at",
                "updated_by",
                "updated_by_name",
            ]
        )

        await MaterialProductProcessService._sync_piece_rates(
            tenant_id,
            material,
            lines_schemas,
        )
        return True

    @staticmethod
    async def resolve_process_route_for_material(
        tenant_id: int,
        material_id: int,
        *,
        active_only: bool = True,
    ) -> Optional[ProcessRoute]:
        """
        解析物料生效的工艺路线（唯一优先级）：
        产品工艺指派 > 物料 FK/defaults > 物料分组 > source_config（历史兜底）。
        """
        record = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
        ).first()

        async def _load_route(pr_id: int) -> Optional[ProcessRoute]:
            query = ProcessRoute.filter(
                id=int(pr_id),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if active_only:
                query = query.filter(is_active=True)
            return await query.first()

        if record and record.process_route_id:
            route = await _load_route(record.process_route_id)
            if route:
                return route

        material = await Material.filter(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not material:
            return None

        if material.process_route_id:
            route = await _load_route(material.process_route_id)
            if route:
                return route

        from apps.master_data.services.process_service import ProcessService

        defaults_route = await ProcessService._process_route_from_material_defaults(
            tenant_id, material
        )
        if defaults_route:
            return defaults_route

        if material.group_id:
            group = await MaterialGroup.filter(
                id=material.group_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if group and group.process_route_id:
                route = await _load_route(group.process_route_id)
                if route:
                    return route

        source_config = material.source_config or {}
        sc_pr_id = source_config.get("process_route_id")
        if sc_pr_id:
            route = await _load_route(int(sc_pr_id))
            if route:
                return route

        return None

    @staticmethod
    async def resolve_sequence_for_material(
        tenant_id: int,
        material_id: int,
        process_route: Optional[ProcessRoute] = None,
    ) -> Tuple[Optional[Any], bool]:
        """
        工单展开工序：优先产品工艺 lines，否则用已解析路线的模板 operation_sequence。
        """
        record = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
        ).first()

        if record and record.lines:
            process_route = process_route or await MaterialProductProcessService.resolve_process_route_for_material(
                tenant_id, material_id
            )
            composed = await _compose_lines(
                tenant_id,
                material_id,
                process_route,
                record.lines,
            )
            if composed:
                return (
                    lines_to_operation_sequence(
                        composed,
                        bool(record.allow_operation_jump),
                    ),
                    bool(record.allow_operation_jump),
                )

        if process_route is None:
            process_route = await MaterialProductProcessService.resolve_process_route_for_material(
                tenant_id, material_id
            )

        if process_route and process_route.operation_sequence:
            allow_jump = bool(getattr(process_route, "allow_operation_jump", False))
            if record:
                allow_jump = bool(record.allow_operation_jump)
            return (process_route.operation_sequence, allow_jump)

        if record:
            return (None, bool(record.allow_operation_jump))
        return (None, False)

    @staticmethod
    async def reconcile_stored_lines_after_route_update(
        tenant_id: int,
        process_route: ProcessRoute,
    ) -> int:
        """路线工序变更后，同步引用该路线的产品工艺已存行（移除路线已删工序）。"""
        if not process_route.operation_sequence:
            return 0
        route_row_dicts = await _parse_sequence_to_line_dicts(
            tenant_id, process_route.operation_sequence
        )
        records = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            deleted_at__isnull=True,
        ).all()
        updated = 0
        route_uuids = {
            uid
            for d in route_row_dicts
            if (uid := _operation_uuid_from_row(d))
        }
        for record in records:
            if not record.lines:
                continue
            filtered_lines = [
                ln
                for ln in record.lines
                if (d := _stored_line_to_dict(ln))
                and (uid := _operation_uuid_from_row(d))
                and uid in route_uuids
            ]
            merged = _merge_stored_lines_with_route(filtered_lines, route_row_dicts)
            if merged != record.lines:
                record.lines = merged
                await record.save(update_fields=["lines", "updated_at"])
                updated += 1
        return updated

    @staticmethod
    async def save_for_material(
        tenant_id: int,
        material_uuid: str,
        data: MaterialProductProcessSave,
        current_user: Optional[User] = None,
    ) -> MaterialProductProcessResponse:
        material = await MaterialProductProcessService._get_material(tenant_id, material_uuid)

        if data.save_as_new_route:
            code = (data.new_route_code or "").strip()
            name = (data.new_route_name or "").strip()
            if not code:
                raise ValidationError("另存为新工艺路线须填写路线编码")
            if not name:
                raise ValidationError("另存为新工艺路线须填写路线名称")
            if not data.lines:
                raise ValidationError("至少保留一道工序后再另存为新工艺路线")
        else:
            process_route_probe = await MaterialProductProcessService._resolve_route(
                tenant_id, data.process_route_uuid, material
            )
            if data.process_route_uuid and not process_route_probe:
                raise ValidationError("所选工艺路线不存在或已删除")
            if process_route_probe and not data.lines:
                raise ValidationError("已指派工艺路线时至少保留一道工序")

        # 补齐 operation_id
        uuids = [ln.operation_uuid for ln in data.lines if ln.operation_uuid]
        op_map = await _load_operations_by_uuid(tenant_id, uuids)
        normalized: List[ProductProcessLineSchema] = []
        for ln in data.lines:
            op = op_map.get(ln.operation_uuid)
            if not op:
                raise ValidationError(f"工序 {ln.operation_uuid} 不存在或已删除")
            normalized.append(
                ln.model_copy(
                    update={
                        "operation_id": op.id,
                        "code": ln.code or op.code,
                        "name": ln.name or op.name,
                    }
                )
            )

        process_route: Optional[ProcessRoute] = None
        if data.save_as_new_route:
            from apps.master_data.schemas.process_schemas import ProcessRouteCreate
            from apps.master_data.services.process_service import ProcessService

            op_sequence = lines_to_operation_sequence(normalized, data.allow_operation_jump)
            created_route = await ProcessService.create_process_route(
                tenant_id,
                ProcessRouteCreate(
                    code=(data.new_route_code or "").strip(),
                    name=(data.new_route_name or "").strip(),
                    operation_sequence=op_sequence,
                    allow_operation_jump=data.allow_operation_jump,
                    is_active=True,
                ),
                current_user=current_user,
            )
            process_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                uuid=created_route.uuid,
                deleted_at__isnull=True,
            ).first()
            if not process_route:
                raise ValidationError("新建工艺路线失败，请重试")
        else:
            process_route = await MaterialProductProcessService._resolve_route(
                tenant_id, data.process_route_uuid, material
            )

        pr_id = process_route.id if process_route else None
        lines_json = [ln.model_dump(mode="json", by_alias=True) for ln in normalized]

        record = await MaterialProductProcess.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            deleted_at__isnull=True,
        ).first()
        if record:
            record.process_route_id = pr_id
            record.allow_operation_jump = data.allow_operation_jump
            record.lines = lines_json
            apply_update_audit(record, current_user)
            await record.save(
                update_fields=[
                    "process_route_id",
                    "allow_operation_jump",
                    "lines",
                    "updated_at",
                    "updated_by",
                    "updated_by_name",
                ]
            )
        else:
            create_payload = {
                "tenant_id": tenant_id,
                "uuid": str(uuid_mod.uuid4()),
                "material_id": material.id,
                "process_route_id": pr_id,
                "allow_operation_jump": data.allow_operation_jump,
                "lines": lines_json,
            }
            apply_create_audit(create_payload, current_user)
            record = await MaterialProductProcess.create(**create_payload)

        # 仅「另存为新工艺路线」时回写物料默认路线；普通保存只写产品工艺表
        if data.save_as_new_route and process_route:
            defaults = material.defaults if isinstance(material.defaults, dict) else {}
            defaults = dict(defaults or {})
            defaults["defaultProcessRouteUuid"] = process_route.uuid
            defaults["defaultProcessRoute"] = pr_id
            await material.update_from_dict(
                {
                    "process_route_id": pr_id,
                    "defaults": defaults,
                }
            ).save()

        await MaterialProductProcessService._sync_piece_rates(
            tenant_id,
            material,
            normalized,
        )

        return await MaterialProductProcessService.get_for_material(tenant_id, material_uuid)

    @staticmethod
    async def get_template_lines_for_route_uuid(
        tenant_id: int,
        route_uuid: str,
    ) -> tuple[bool, List[ProductProcessLineSchema]]:
        """解析工艺路线工序模板（不含物料计件单价，供产品工艺页导入）。"""
        route = await ProcessRoute.filter(
            uuid=route_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not route:
            raise NotFoundError(f"工艺路线 {route_uuid} 不存在")
        allow_jump = bool(getattr(route, "allow_operation_jump", False))
        lines = await _compose_lines(tenant_id, 0, route, None)
        return allow_jump, lines

    @staticmethod
    async def _sync_piece_rates(
        tenant_id: int,
        material: Material,
        lines: List[ProductProcessLineSchema],
    ) -> None:
        wanted: Dict[int, Decimal] = {}
        for ln in lines:
            if ln.operation_id is not None and ln.piece_rate is not None:
                wanted[int(ln.operation_id)] = Decimal(str(ln.piece_rate))

        existing = await PieceRate.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            deleted_at__isnull=True,
        ).all()

        now = resolve_business_datetime()
        for rate in existing:
            op_id = int(rate.operation_id)
            if op_id not in wanted:
                await rate.update_from_dict({"deleted_at": now, "is_active": False}).save()
                continue
            new_val = wanted.pop(op_id)
            if rate.rate != new_val:
                await rate.update_from_dict(
                    {
                        "rate": new_val,
                        "operation_code": next(
                            (ln.code for ln in lines if ln.operation_id == op_id),
                            rate.operation_code,
                        ),
                        "operation_name": next(
                            (ln.name for ln in lines if ln.operation_id == op_id),
                            rate.operation_name,
                        ),
                        "material_code": material.main_code or material.code,
                        "is_active": True,
                        "deleted_at": None,
                    }
                ).save()

        for op_id, val in wanted.items():
            ln = next((x for x in lines if x.operation_id == op_id), None)
            await PieceRate.create(
                tenant_id=tenant_id,
                uuid=str(uuid_mod.uuid4()),
                operation_id=op_id,
                operation_code=ln.code if ln else None,
                operation_name=ln.name if ln else None,
                material_id=material.id,
                material_code=material.main_code or material.code,
                rate=val,
                is_active=True,
            )
