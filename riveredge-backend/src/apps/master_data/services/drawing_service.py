"""
工程图纸业务服务
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.material import Material
from apps.master_data.models.process import Operation, ProcessRoute
from apps.master_data.schemas.drawing_schemas import (
    AssociatedMaterialBrief,
    AssociatedOperationBrief,
    AssociatedProcessRouteBrief,
    EngineeringDrawingCreate,
    EngineeringDrawingObsoleteRequest,
    EngineeringDrawingResponse,
    EngineeringDrawingRevisionBrief,
    EngineeringDrawingRevisionCreate,
    EngineeringDrawingUpdate,
    FileBriefResponse,
    LinkedBomBrief,
)
from core.services.file.file_service import FileService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _norm_uuid_list(value: Any) -> List[str]:
    if not value:
        return []
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _next_revision(revision: str) -> str:
    rev = (revision or "A").strip().upper()
    if len(rev) == 1 and rev.isalpha():
        if rev == "Z":
            return "AA"
        return chr(ord(rev) + 1)
    if rev.isdigit():
        return str(int(rev) + 1).zfill(len(rev))
    m = re.match(r"^(.+?)(\d+)$", rev)
    if m:
        prefix, num = m.group(1), m.group(2)
        return f"{prefix}{str(int(num) + 1).zfill(len(num))}"
    return f"{rev}-1"


def _row_sort_key(drawing: EngineeringDrawing, field: str) -> tuple:
    if field == "released_at":
        val = drawing.released_at or drawing.created_at
    else:
        val = getattr(drawing, field, None) or drawing.created_at
    return (val, drawing.created_at, drawing.id)


def pick_current_effective_rows(rows: List[EngineeringDrawing]) -> List[EngineeringDrawing]:
    """每个图号保留一条现行有效版：最新 Released，否则最新 Draft。"""
    by_code: Dict[str, List[EngineeringDrawing]] = {}
    for row in rows:
        by_code.setdefault(row.code, []).append(row)

    effective: List[EngineeringDrawing] = []
    for group in by_code.values():
        released = [r for r in group if (r.status or "") == "Released"]
        if released:
            effective.append(max(released, key=lambda r: _row_sort_key(r, "released_at")))
            continue
        drafts = [r for r in group if (r.status or "") == "Draft"]
        if drafts:
            effective.append(max(drafts, key=lambda r: _row_sort_key(r, "created_at")))
    return effective


class _AssociationMaps:
    __slots__ = ("materials_by_uuid", "routes_by_uuid", "operations_by_uuid", "materials_by_id")

    def __init__(self) -> None:
        self.materials_by_uuid: Dict[str, AssociatedMaterialBrief] = {}
        self.routes_by_uuid: Dict[str, AssociatedProcessRouteBrief] = {}
        self.operations_by_uuid: Dict[str, AssociatedOperationBrief] = {}
        self.materials_by_id: Dict[int, Material] = {}


async def _build_association_maps(
    tenant_id: int, drawings: List[EngineeringDrawing]
) -> _AssociationMaps:
    maps = _AssociationMaps()
    if not drawings:
        return maps

    material_uuids: set[str] = set()
    route_uuids: set[str] = set()
    operation_uuids: set[str] = set()
    bom_material_ids: set[int] = set()

    for drawing in drawings:
        material_uuids.update(_norm_uuid_list(drawing.material_uuids))
        route_uuids.update(_norm_uuid_list(drawing.process_route_uuids))
        operation_uuids.update(_norm_uuid_list(drawing.operation_uuids))
        if drawing.linked_bom_material_id:
            bom_material_ids.add(int(drawing.linked_bom_material_id))

    if material_uuids or bom_material_ids:
        query = Material.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        filters = Q()
        if material_uuids:
            filters |= Q(uuid__in=list(material_uuids))
        if bom_material_ids:
            filters |= Q(id__in=list(bom_material_ids))
        materials = await query.filter(filters).all()
        for mat in materials:
            brief = AssociatedMaterialBrief(uuid=mat.uuid, main_code=mat.main_code, name=mat.name)
            maps.materials_by_uuid[mat.uuid] = brief
            maps.materials_by_id[mat.id] = mat

    if route_uuids:
        routes = await ProcessRoute.filter(
            tenant_id=tenant_id, uuid__in=list(route_uuids), deleted_at__isnull=True
        ).all()
        for route in routes:
            maps.routes_by_uuid[route.uuid] = AssociatedProcessRouteBrief(
                uuid=route.uuid, code=route.code, name=route.name
            )

    if operation_uuids:
        operations = await Operation.filter(
            tenant_id=tenant_id, uuid__in=list(operation_uuids), deleted_at__isnull=True
        ).all()
        for op in operations:
            maps.operations_by_uuid[op.uuid] = AssociatedOperationBrief(
                uuid=op.uuid, code=op.code, name=op.name
            )

    return maps


def _apply_associations(
    drawing: EngineeringDrawing, maps: Optional[_AssociationMaps]
) -> Dict[str, Any]:
    if not maps:
        return {}

    material_uuids = _norm_uuid_list(drawing.material_uuids)
    route_uuids = _norm_uuid_list(drawing.process_route_uuids)
    operation_uuids = _norm_uuid_list(drawing.operation_uuids)

    materials = [maps.materials_by_uuid[u] for u in material_uuids if u in maps.materials_by_uuid]
    process_routes = [maps.routes_by_uuid[u] for u in route_uuids if u in maps.routes_by_uuid]
    operations = [maps.operations_by_uuid[u] for u in operation_uuids if u in maps.operations_by_uuid]

    linked_bom: Optional[LinkedBomBrief] = None
    if drawing.linked_bom_material_id and drawing.linked_bom_version:
        mat = maps.materials_by_id.get(int(drawing.linked_bom_material_id))
        if mat:
            linked_bom = LinkedBomBrief(
                material_id=mat.id,
                material_code=mat.main_code,
                material_name=mat.name,
                version=drawing.linked_bom_version,
            )

    out: Dict[str, Any] = {}
    if materials:
        out["materials"] = materials
    if process_routes:
        out["process_routes"] = process_routes
    if operations:
        out["operations"] = operations
    if linked_bom:
        out["linked_bom"] = linked_bom
    return out


async def _ensure_file_uuids(tenant_id: int, uuids: List[str], label: str) -> None:
    for uid in uuids:
        try:
            await FileService.get_file_by_uuid(tenant_id, uid)
        except NotFoundError as e:
            raise ValidationError(f"{label}文件不存在: {uid}") from e


async def _file_brief(tenant_id: int, file_uuid: str) -> Optional[FileBriefResponse]:
    if not file_uuid:
        return None
    try:
        f = await FileService.get_file_by_uuid(tenant_id, file_uuid)
    except NotFoundError:
        return None
    preview_url = None
    try:
        from core.services.file.file_preview_service import FilePreviewService

        preview_url = await FilePreviewService.generate_simple_preview_url(
            file_uuid=f.uuid,
            tenant_id=tenant_id,
        )
    except Exception:
        preview_url = None
    return FileBriefResponse(
        uuid=f.uuid,
        original_name=f.original_name,
        file_extension=f.file_extension,
        file_size=int(f.file_size or 0),
        preview_url=preview_url,
    )


async def _to_response(
    tenant_id: int,
    drawing: EngineeringDrawing,
    maps: Optional[_AssociationMaps] = None,
) -> EngineeringDrawingResponse:
    supp_uuids = _norm_uuid_list(drawing.supplementary_file_uuids)
    supp_files: List[FileBriefResponse] = []
    for uid in supp_uuids:
        brief = await _file_brief(tenant_id, uid)
        if brief:
            supp_files.append(brief)
    payload: Dict[str, Any] = {
        "id": drawing.id,
        "uuid": drawing.uuid,
        "tenant_id": drawing.tenant_id,
        "code": drawing.code,
        "name": drawing.name,
        "revision": drawing.revision,
        "drawing_type": drawing.drawing_type,
        "status": drawing.status,
        "file_uuid": drawing.file_uuid,
        "supplementary_file_uuids": supp_uuids or None,
        "material_uuids": _norm_uuid_list(drawing.material_uuids) or None,
        "process_route_uuids": _norm_uuid_list(drawing.process_route_uuids) or None,
        "operation_uuids": _norm_uuid_list(drawing.operation_uuids) or None,
        "description": drawing.description,
        "released_at": drawing.released_at,
        "released_by": drawing.released_by,
        "obsolete_at": drawing.obsolete_at,
        "obsolete_reason": drawing.obsolete_reason,
        "created_at": drawing.created_at,
        "updated_at": drawing.updated_at,
        **audit_response_fields(drawing),
        "linked_bom_material_id": drawing.linked_bom_material_id,
        "linked_bom_version": drawing.linked_bom_version,
        "last_step_bom_import_at": drawing.last_step_bom_import_at,
        "file": await _file_brief(tenant_id, drawing.file_uuid),
        "supplementary_files": supp_files or None,
    }
    payload.update(_apply_associations(drawing, maps))
    return EngineeringDrawingResponse.model_validate(payload)


async def _to_responses(
    tenant_id: int, drawings: List[EngineeringDrawing]
) -> List[EngineeringDrawingResponse]:
    maps = await _build_association_maps(tenant_id, drawings)
    return [await _to_response(tenant_id, d, maps) for d in drawings]


class DrawingService:
    @staticmethod
    async def create_drawing(
        tenant_id: int,
        data: EngineeringDrawingCreate,
        current_user: Optional[User] = None,
    ) -> EngineeringDrawingResponse:
        await _ensure_file_uuids(tenant_id, [data.file_uuid], "主")
        supp = _norm_uuid_list(data.supplementary_file_uuids)
        if supp:
            await _ensure_file_uuids(tenant_id, supp, "附加")

        exists = await EngineeringDrawing.filter(
            tenant_id=tenant_id,
            code=data.code,
            revision=data.revision,
            deleted_at__isnull=True,
        ).exists()
        if exists:
            raise ValidationError(f"图号 {data.code} 修订版 {data.revision} 已存在")

        payload = {
            "tenant_id": tenant_id,
            "code": data.code,
            "name": data.name,
            "revision": data.revision,
            "drawing_type": data.drawing_type,
            "status": "Draft",
            "file_uuid": data.file_uuid,
            "supplementary_file_uuids": supp or None,
            "material_uuids": _norm_uuid_list(data.material_uuids) or None,
            "process_route_uuids": _norm_uuid_list(data.process_route_uuids) or None,
            "operation_uuids": _norm_uuid_list(data.operation_uuids) or None,
            "description": (data.description or "").strip() or None,
        }
        apply_create_audit(payload, current_user)
        drawing = await EngineeringDrawing.create(**payload)
        return await _to_response(tenant_id, drawing)

    @staticmethod
    async def update_drawing(
        tenant_id: int,
        drawing_uuid: str,
        data: EngineeringDrawingUpdate,
        current_user: Optional[User] = None,
    ) -> EngineeringDrawingResponse:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        if (drawing.status or "") != "Draft":
            raise ValidationError("仅草稿状态图纸可编辑")

        update_data = data.model_dump(exclude_unset=True, by_alias=False)
        if "file_uuid" in update_data and update_data["file_uuid"]:
            await _ensure_file_uuids(tenant_id, [update_data["file_uuid"]], "主")
        if "supplementary_file_uuids" in update_data:
            supp = _norm_uuid_list(update_data["supplementary_file_uuids"])
            if supp:
                await _ensure_file_uuids(tenant_id, supp, "附加")
            update_data["supplementary_file_uuids"] = supp or None
        for key in ("material_uuids", "process_route_uuids", "operation_uuids"):
            if key in update_data:
                update_data[key] = _norm_uuid_list(update_data[key]) or None
        if "name" in update_data and update_data["name"]:
            update_data["name"] = update_data["name"].strip()
        if "description" in update_data:
            update_data["description"] = (update_data["description"] or "").strip() or None

        for k, v in update_data.items():
            setattr(drawing, k, v)
        apply_update_audit(drawing, current_user)
        await drawing.save()
        return await _to_response(tenant_id, drawing)

    @staticmethod
    async def list_drawings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        drawing_type: Optional[str] = None,
        keyword: Optional[str] = None,
        material_uuid: Optional[str] = None,
        process_route_uuid: Optional[str] = None,
        operation_uuid: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        view: str = "current",
    ) -> Tuple[List[EngineeringDrawingResponse], int]:
        query = EngineeringDrawing.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if drawing_type:
            query = query.filter(drawing_type=drawing_type)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(code__icontains=kw)
                    | Q(name__icontains=kw)
                    | Q(description__icontains=kw)
                )
        if material_uuid:
            query = query.filter(material_uuids__contains=[material_uuid])
        if process_route_uuid:
            query = query.filter(process_route_uuids__contains=[process_route_uuid])
        if operation_uuid:
            query = query.filter(operation_uuids__contains=[operation_uuid])

        order_field = "created_at"
        if sort_by in ("code", "name", "revision", "status", "created_at", "released_at"):
            order_field = sort_by
        descending = (sort_order or "desc").lower() == "desc"

        if (view or "current").lower() == "current":
            all_rows = await query.all()
            rows = pick_current_effective_rows(all_rows)
            rows.sort(key=lambda r: _row_sort_key(r, order_field), reverse=descending)
            total = len(rows)
            page_rows = rows[skip : skip + limit]
            items = await _to_responses(tenant_id, page_rows)
            return items, total

        order_expr = f"-{order_field}" if descending else order_field
        total = await query.count()
        rows = await query.order_by(order_expr).offset(skip).limit(limit)
        items = await _to_responses(tenant_id, rows)
        return items, total

    @staticmethod
    async def get_drawing(tenant_id: int, drawing_uuid: str) -> EngineeringDrawingResponse:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        maps = await _build_association_maps(tenant_id, [drawing])
        return await _to_response(tenant_id, drawing, maps)

    @staticmethod
    async def list_revisions(
        tenant_id: int, drawing_uuid: str
    ) -> Tuple[str, List[EngineeringDrawingRevisionBrief]]:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        rows = await EngineeringDrawing.filter(
            tenant_id=tenant_id,
            code=drawing.code,
            deleted_at__isnull=True,
        ).order_by("created_at")
        revisions = [
            EngineeringDrawingRevisionBrief.model_validate(
                {
                    "uuid": r.uuid,
                    "revision": r.revision,
                    "status": r.status,
                    "released_at": r.released_at,
                    "obsolete_reason": r.obsolete_reason,
                    "created_at": r.created_at,
                }
            )
            for r in rows
        ]
        return drawing.code, revisions

    @staticmethod
    async def delete_drawing(tenant_id: int, drawing_uuid: str) -> None:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        if (drawing.status or "") not in ("Draft", "Obsolete"):
            raise ValidationError("仅草稿或已作废状态图纸可删除")
        drawing.deleted_at = _utcnow()
        await drawing.save()

    @staticmethod
    async def release_drawing(
        tenant_id: int,
        drawing_uuid: str,
        released_by: Optional[int] = None,
    ) -> EngineeringDrawingResponse:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        if (drawing.status or "") != "Draft":
            raise ValidationError("仅草稿状态图纸可发布")

        now = _utcnow()
        old_released = await EngineeringDrawing.filter(
            tenant_id=tenant_id,
            code=drawing.code,
            status="Released",
            deleted_at__isnull=True,
        ).all()
        for old in old_released:
            old.status = "Obsolete"
            old.obsolete_at = now
            old.obsolete_reason = old.obsolete_reason or f"被修订版 {drawing.revision} 取代"
            await old.save()

        drawing.status = "Released"
        drawing.released_at = now
        drawing.released_by = released_by
        await drawing.save()
        return await _to_response(tenant_id, drawing)

    @staticmethod
    async def obsolete_drawing(
        tenant_id: int,
        drawing_uuid: str,
        body: EngineeringDrawingObsoleteRequest,
    ) -> EngineeringDrawingResponse:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        if (drawing.status or "") != "Released":
            raise ValidationError("仅已发布图纸可作废")
        drawing.status = "Obsolete"
        drawing.obsolete_at = _utcnow()
        drawing.obsolete_reason = (body.reason or "").strip() or None
        await drawing.save()
        return await _to_response(tenant_id, drawing)

    @staticmethod
    async def create_revision(
        tenant_id: int,
        drawing_uuid: str,
        body: EngineeringDrawingRevisionCreate,
        current_user: Optional[User] = None,
    ) -> EngineeringDrawingResponse:
        source = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)
        if (source.status or "") != "Released":
            raise ValidationError("仅已发布图纸可升版")

        new_revision = _next_revision(source.revision)
        while await EngineeringDrawing.filter(
            tenant_id=tenant_id,
            code=source.code,
            revision=new_revision,
            deleted_at__isnull=True,
        ).exists():
            new_revision = _next_revision(new_revision)

        file_uuid = body.file_uuid or source.file_uuid
        supp = (
            _norm_uuid_list(body.supplementary_file_uuids)
            if body.supplementary_file_uuids is not None
            else _norm_uuid_list(source.supplementary_file_uuids)
        )
        await _ensure_file_uuids(tenant_id, [file_uuid], "主")
        if supp:
            await _ensure_file_uuids(tenant_id, supp, "附加")

        payload = {
            "tenant_id": tenant_id,
            "code": source.code,
            "name": source.name,
            "revision": new_revision,
            "drawing_type": source.drawing_type,
            "status": "Draft",
            "file_uuid": file_uuid,
            "supplementary_file_uuids": supp or None,
            "material_uuids": _norm_uuid_list(source.material_uuids) or None,
            "process_route_uuids": _norm_uuid_list(source.process_route_uuids) or None,
            "operation_uuids": _norm_uuid_list(source.operation_uuids) or None,
            "description": (body.description if body.description is not None else source.description),
        }
        apply_create_audit(payload, current_user)
        drawing = await EngineeringDrawing.create(**payload)
        return await _to_response(tenant_id, drawing)

    @staticmethod
    async def list_by_context(
        tenant_id: int,
        material_uuid: Optional[str] = None,
        process_route_uuid: Optional[str] = None,
        operation_uuid: Optional[str] = None,
    ) -> List[EngineeringDrawingResponse]:
        query = EngineeringDrawing.filter(
            tenant_id=tenant_id,
            status="Released",
            deleted_at__isnull=True,
        )
        if material_uuid:
            query = query.filter(material_uuids__contains=[material_uuid])
        if process_route_uuid:
            query = query.filter(process_route_uuids__contains=[process_route_uuid])
        if operation_uuid:
            query = query.filter(operation_uuids__contains=[operation_uuid])
        rows = await query.order_by("-released_at", "-created_at")
        return await _to_responses(tenant_id, rows)

    @staticmethod
    async def _get_active_or_404(tenant_id: int, drawing_uuid: str) -> EngineeringDrawing:
        drawing = await EngineeringDrawing.get_or_none(
            tenant_id=tenant_id,
            uuid=drawing_uuid,
            deleted_at__isnull=True,
        )
        if not drawing:
            raise NotFoundError(f"图纸不存在: {drawing_uuid}")
        return drawing
