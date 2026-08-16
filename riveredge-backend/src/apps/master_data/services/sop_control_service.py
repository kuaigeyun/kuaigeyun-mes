"""SOP 文控：提交/审核/生效/作废/升版、受控份发放/回收、打印数据。"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from apps.common.audit_actor import apply_update_audit
from apps.master_data.models.process import SOP, SopControlledCopy, SopRevision
from apps.master_data.schemas.process_schemas import (
    SOPResponse,
    SopControlledCopyDispatchRequest,
    SopControlledCopyRecallRequest,
    SopControlledCopyResponse,
    SopPrintDataResponse,
    SopRevisionResponse,
    SopReviseRequest,
)
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

SOP_CARRIERS = {"electronic", "paper", "hybrid"}
SOP_CONTROL_STATUSES = {"draft", "in_review", "effective", "obsolete"}
COPY_STATUSES = {"issued", "pending_retrieve", "retrieved", "lost"}
COPY_LOCATION_TYPES = {"plant", "workshop", "station", "person"}


def _normalize_attachments(raw: Any) -> List[Dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        if "files" in raw and isinstance(raw["files"], list):
            return [x for x in raw["files"] if isinstance(x, dict)]
        return [raw]
    return []


def _has_controlled_original(attachments: Any) -> bool:
    return len(_normalize_attachments(attachments)) > 0


def _validate_carrier_content(sop: SOP) -> None:
    carrier = getattr(sop, "carrier", None) or "electronic"
    if carrier not in SOP_CARRIERS:
        raise ValidationError(f"未知载体类型: {carrier}")

    has_flow = bool(getattr(sop, "flow_config", None)) or bool(
        (getattr(sop, "content", None) or "").strip()
    )
    has_scan = _has_controlled_original(getattr(sop, "attachments", None))
    has_location = bool((getattr(sop, "storage_location", None) or "").strip())

    if carrier == "electronic" and not has_flow:
        raise ValidationError("电子载体 SOP 须配置作业指导步骤或正文")
    if carrier == "paper":
        if not has_scan:
            raise ValidationError("纸质载体 SOP 须上传受控扫描件")
        if not has_location:
            raise ValidationError("纸质载体 SOP 须填写存放位置")
    if carrier == "hybrid":
        if not has_flow:
            raise ValidationError("混合载体 SOP 须配置电子作业指导步骤或正文")
        if not has_scan:
            raise ValidationError("混合载体 SOP 须上传受控扫描件")
        if not has_location:
            raise ValidationError("混合载体 SOP 须填写存放位置")


def _next_revision(current: Optional[str]) -> str:
    raw = (current or "1.0").strip()
    m = re.match(r"^([A-Za-z]*)(\d+(?:\.\d+)*)$", raw)
    if m:
        prefix, num = m.group(1), m.group(2)
        if "." in num:
            major, minor = num.split(".", 1)
            return f"{prefix}{major}.{int(minor) + 1}"
        return f"{prefix}{int(num) + 1}"
    m2 = re.match(r"^(.+?)(\d+)$", raw)
    if m2:
        return f"{m2.group(1)}{int(m2.group(2)) + 1}"
    return f"{raw}-1"


async def _get_sop(tenant_id: int, sop_uuid: str) -> SOP:
    sop = await SOP.filter(
        tenant_id=tenant_id,
        uuid=sop_uuid,
        deleted_at__isnull=True,
    ).first()
    if not sop:
        raise NotFoundError(f"SOP {sop_uuid} 不存在")
    return sop


async def _copy_counts(tenant_id: int, sop_id: int) -> Tuple[int, int]:
    issued = await SopControlledCopy.filter(
        tenant_id=tenant_id,
        sop_id=sop_id,
        status="issued",
        deleted_at__isnull=True,
    ).count()
    pending = await SopControlledCopy.filter(
        tenant_id=tenant_id,
        sop_id=sop_id,
        status="pending_retrieve",
        deleted_at__isnull=True,
    ).count()
    return issued, pending


async def enrich_sop_response(sop: SOP) -> SOPResponse:
    issued, pending = await _copy_counts(sop.tenant_id, sop.id)
    data = SOPResponse.model_validate(sop).model_dump()
    data["issued_copy_count"] = issued
    data["pending_retrieve_copy_count"] = pending
    return SOPResponse.model_validate(data)


def _snapshot_revision_fields(sop: SOP) -> Dict[str, Any]:
    return {
        "revision": sop.current_revision or sop.version or "1.0",
        "carrier": sop.carrier or "electronic",
        "content": sop.content,
        "attachments": sop.attachments,
        "flow_config": sop.flow_config,
        "form_config": sop.form_config,
        "storage_location": sop.storage_location,
        "change_reason": sop.change_reason,
    }


def _flow_to_steps(flow_config: Any) -> List[Dict[str, Any]]:
    if not isinstance(flow_config, dict):
        return []
    nodes = flow_config.get("nodes") or []
    edges = flow_config.get("edges") or []
    if not nodes:
        return []
    node_map = {n.get("id"): n for n in nodes if isinstance(n, dict) and n.get("id")}
    start_ids = [
        n.get("id")
        for n in nodes
        if isinstance(n, dict) and n.get("type") == "start"
    ]
    if not start_ids:
        return []
    edge_map: Dict[str, str] = {}
    for e in edges:
        if isinstance(e, dict) and e.get("source") and e.get("target"):
            edge_map[str(e["source"])] = str(e["target"])
    ordered: List[Dict[str, Any]] = []
    cur = start_ids[0]
    seen = set()
    while cur and cur not in seen:
        seen.add(cur)
        node = node_map.get(cur)
        if not node:
            break
        ntype = node.get("type")
        if ntype in ("step", "check"):
            data = node.get("data") or {}
            ordered.append(
                {
                    "id": cur,
                    "type": ntype,
                    "title": data.get("label") or data.get("title") or "",
                    "description": data.get("description"),
                    "key_points": data.get("keyPoints") or data.get("key_points"),
                }
            )
        if ntype == "end":
            break
        cur = edge_map.get(cur)
    return ordered


class SopControlService:
    @staticmethod
    async def list_revisions(tenant_id: int, sop_uuid: str) -> Tuple[List[SopRevisionResponse], int]:
        sop = await _get_sop(tenant_id, sop_uuid)
        rows = (
            await SopRevision.filter(
                tenant_id=tenant_id,
                sop_id=sop.id,
                deleted_at__isnull=True,
            )
            .order_by("-effective_at", "-id")
            .all()
        )
        items = [SopRevisionResponse.model_validate(r) for r in rows]
        return items, len(items)

    @staticmethod
    async def list_copies(tenant_id: int, sop_uuid: str) -> Tuple[List[SopControlledCopyResponse], int]:
        sop = await _get_sop(tenant_id, sop_uuid)
        rows = (
            await SopControlledCopy.filter(
                tenant_id=tenant_id,
                sop_id=sop.id,
                deleted_at__isnull=True,
            )
            .order_by("-issued_at", "-id")
            .all()
        )
        items = [SopControlledCopyResponse.model_validate(r) for r in rows]
        return items, len(items)

    @staticmethod
    async def submit(tenant_id: int, sop_uuid: str, current_user: Optional[User] = None) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "draft":
            raise BusinessLogicError("仅草稿状态可提交审核")
        _validate_carrier_content(sop)
        sop.control_status = "in_review"
        sop.approved_at = None
        sop.approved_by_name = None
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def approve(tenant_id: int, sop_uuid: str, current_user: Optional[User] = None) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "in_review":
            raise BusinessLogicError("仅审核中状态可审核通过")
        sop.approved_at = resolve_business_datetime()
        sop.approved_by_name = getattr(current_user, "name", None) or getattr(
            current_user, "username", None
        )
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def reject(
        tenant_id: int,
        sop_uuid: str,
        current_user: Optional[User] = None,
    ) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "in_review":
            raise BusinessLogicError("仅审核中状态可驳回")
        sop.control_status = "draft"
        sop.approved_at = None
        sop.approved_by_name = None
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def revoke(
        tenant_id: int,
        sop_uuid: str,
        current_user: Optional[User] = None,
    ) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "in_review":
            raise BusinessLogicError("仅审核中状态可撤销提交")
        sop.control_status = "draft"
        sop.approved_at = None
        sop.approved_by_name = None
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def publish(tenant_id: int, sop_uuid: str, current_user: Optional[User] = None) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "in_review":
            raise BusinessLogicError("仅审核中状态可发布生效")
        if not sop.approved_at:
            raise BusinessLogicError("请先审核通过再发布生效")
        _validate_carrier_content(sop)

        revision = sop.current_revision or sop.version or "1.0"
        publisher = getattr(current_user, "name", None) or getattr(current_user, "username", None)
        now = resolve_business_datetime()

        await SopRevision.filter(
            tenant_id=tenant_id,
            sop_id=sop.id,
            obsolete_at__isnull=True,
            deleted_at__isnull=True,
        ).exclude(revision=revision).update(obsolete_at=now)

        rev_row = await SopRevision.filter(
            tenant_id=tenant_id,
            sop_id=sop.id,
            revision=revision,
            deleted_at__isnull=True,
        ).first()
        snap = _snapshot_revision_fields(sop)
        if rev_row:
            for key, val in snap.items():
                setattr(rev_row, key, val)
            rev_row.effective_at = now
            rev_row.obsolete_at = None
            rev_row.published_by_name = publisher
            await rev_row.save()
        else:
            await SopRevision.create(
                tenant_id=tenant_id,
                sop_id=sop.id,
                effective_at=now,
                published_by_name=publisher,
                **snap,
            )

        await SopControlledCopy.filter(
            tenant_id=tenant_id,
            sop_id=sop.id,
            status="issued",
            deleted_at__isnull=True,
        ).update(status="pending_retrieve")

        sop.control_status = "effective"
        sop.current_revision = revision
        sop.version = revision
        sop.effective_at = now
        sop.obsolete_at = None
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def obsolete(tenant_id: int, sop_uuid: str, current_user: Optional[User] = None) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status not in ("effective", "draft"):
            raise BusinessLogicError("仅草稿或生效中状态可作废")
        now = resolve_business_datetime()
        if sop.control_status == "effective":
            rev_row = await SopRevision.filter(
                tenant_id=tenant_id,
                sop_id=sop.id,
                revision=sop.current_revision or sop.version or "1.0",
                deleted_at__isnull=True,
            ).first()
            if rev_row:
                rev_row.obsolete_at = now
                await rev_row.save()
            await SopControlledCopy.filter(
                tenant_id=tenant_id,
                sop_id=sop.id,
                status="issued",
                deleted_at__isnull=True,
            ).update(status="pending_retrieve")
        sop.control_status = "obsolete"
        sop.obsolete_at = now
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def revise(
        tenant_id: int,
        sop_uuid: str,
        body: SopReviseRequest,
        current_user: Optional[User] = None,
    ) -> SOPResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "effective":
            raise BusinessLogicError("仅生效中 SOP 可升版")
        now = resolve_business_datetime()
        rev_row = await SopRevision.filter(
            tenant_id=tenant_id,
            sop_id=sop.id,
            revision=sop.current_revision or sop.version or "1.0",
            deleted_at__isnull=True,
        ).first()
        if rev_row and not rev_row.obsolete_at:
            rev_row.obsolete_at = now
            await rev_row.save()

        next_rev = _next_revision(sop.current_revision or sop.version)
        sop.control_status = "draft"
        sop.current_revision = next_rev
        sop.version = next_rev
        sop.change_reason = (body.change_reason or "").strip() or sop.change_reason
        sop.approved_at = None
        sop.approved_by_name = None
        sop.effective_at = None
        apply_update_audit(sop, current_user)
        await sop.save()
        return await enrich_sop_response(sop)

    @staticmethod
    async def _next_copy_no(tenant_id: int, sop_id: int) -> str:
        existing = await SopControlledCopy.filter(
            tenant_id=tenant_id,
            sop_id=sop_id,
            deleted_at__isnull=True,
        ).count()
        return f"C-{existing + 1:03d}"

    @staticmethod
    async def dispatch_copy(
        tenant_id: int,
        sop_uuid: str,
        body: SopControlledCopyDispatchRequest,
        current_user: Optional[User] = None,
    ) -> SopControlledCopyResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        if sop.control_status != "effective":
            raise BusinessLogicError("仅生效中 SOP 可发放受控份")
        if body.location_type not in COPY_LOCATION_TYPES:
            raise ValidationError("location_type 必须是 plant/workshop/station/person")
        if body.location_type == "station" and not body.station_id:
            raise ValidationError("工位发放须指定 station_id")
        if body.location_type == "person" and not body.holder_user_id:
            raise ValidationError("人员发放须指定 holder_user_id")

        issuer = getattr(current_user, "name", None) or getattr(current_user, "username", None)
        copy = await SopControlledCopy.create(
            tenant_id=tenant_id,
            sop_id=sop.id,
            copy_no=await SopControlService._next_copy_no(tenant_id, sop.id),
            location_type=body.location_type,
            station_id=body.station_id,
            holder_user_id=body.holder_user_id,
            location_note=(body.location_note or "").strip() or None,
            revision=sop.current_revision or sop.version or "1.0",
            status="issued",
            issued_at=resolve_business_datetime(),
            issued_by_name=issuer,
        )
        return SopControlledCopyResponse.model_validate(copy)

    @staticmethod
    async def recall_copy(
        tenant_id: int,
        sop_uuid: str,
        body: SopControlledCopyRecallRequest,
        current_user: Optional[User] = None,
    ) -> SopControlledCopyResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        copy = await SopControlledCopy.filter(
            tenant_id=tenant_id,
            sop_id=sop.id,
            id=body.copy_id,
            deleted_at__isnull=True,
        ).first()
        if not copy:
            raise NotFoundError("受控份不存在")
        if copy.status not in ("issued", "pending_retrieve"):
            raise BusinessLogicError("该受控份已回收或已标记丢失")

        retriever = getattr(current_user, "name", None) or getattr(current_user, "username", None)
        copy.status = "lost" if body.mark_lost else "retrieved"
        copy.retrieved_at = resolve_business_datetime()
        copy.retrieved_by_name = retriever
        await copy.save()
        return SopControlledCopyResponse.model_validate(copy)

    @staticmethod
    async def get_print_data(
        tenant_id: int,
        sop_uuid: str,
        controlled: bool = False,
        copy_id: Optional[int] = None,
    ) -> SopPrintDataResponse:
        sop = await _get_sop(tenant_id, sop_uuid)
        copy_no: Optional[str] = None
        if controlled:
            if copy_id:
                copy = await SopControlledCopy.filter(
                    tenant_id=tenant_id,
                    sop_id=sop.id,
                    id=copy_id,
                    deleted_at__isnull=True,
                ).first()
                if not copy:
                    raise NotFoundError("受控份不存在")
                copy_no = copy.copy_no
            watermark = "受控副本"
            if copy_no:
                watermark = f"受控副本 {copy_no} 修订 {sop.current_revision or sop.version or '1.0'}"
        else:
            watermark = "非受控副本 不得现场使用"

        revision = sop.current_revision or sop.version or "1.0"
        return SopPrintDataResponse(
            sop_uuid=str(sop.uuid),
            code=sop.code,
            name=sop.name,
            revision=revision,
            carrier=sop.carrier or "electronic",
            controlled=controlled,
            copy_no=copy_no,
            watermark=watermark,
            storage_location=sop.storage_location,
            content=sop.content,
            attachments=_normalize_attachments(sop.attachments),
            steps=_flow_to_steps(sop.flow_config),
        )

    @staticmethod
    def assert_editable(sop: SOP) -> None:
        if sop.control_status == "effective":
            raise ValidationError("生效中 SOP 请先升版再编辑")
        if sop.control_status == "in_review":
            raise ValidationError("审核中 SOP 不可编辑")
        if sop.control_status == "obsolete":
            raise ValidationError("已作废 SOP 不可编辑")
