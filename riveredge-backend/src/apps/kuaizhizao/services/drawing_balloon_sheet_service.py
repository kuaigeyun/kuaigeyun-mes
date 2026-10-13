"""图纸气泡标注单服务"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, List, Optional

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.drawing_balloon_sheet import DrawingBalloonSheet
from apps.kuaizhizao.models.drawing_balloon_sheet_line import DrawingBalloonSheetLine
from apps.kuaizhizao.schemas.drawing_balloon_sheet import (
    DrawingBalloonConfirmLinesRequest,
    DrawingBalloonSheetCreate,
    DrawingBalloonSheetLineCreate,
    DrawingBalloonSheetLineResponse,
    DrawingBalloonSheetListResponse,
    DrawingBalloonSheetResponse,
    DrawingBalloonSheetUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService

SHEET_STATUSES = {"draft", "confirmed"}
EDITABLE_STATUSES = {"draft"}
PRO_MODULE = "drawing_balloon_annotation"


def _opt_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _dec(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


async def assert_drawing_balloon_pro_access(tenant_id: int) -> None:
    result = await BusinessConfigService().check_pro_feature_access(
        tenant_id, "modules", PRO_MODULE
    )
    if not result.get("has_access"):
        msg = result.get("upgrade_message") or "图纸气泡标注需要专业或企业套餐"
        raise BusinessLogicError(msg)


class DrawingBalloonSheetService(AppBaseService[DrawingBalloonSheet]):
    def __init__(self) -> None:
        super().__init__(DrawingBalloonSheet)

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        today = today_site_str()
        return await self.generate_code(
            tenant_id, "DRAWING_BALLOON_SHEET_CODE", prefix=f"BAL{today}"
        )

    async def _get_sheet(self, tenant_id: int, sheet_id: int) -> DrawingBalloonSheet:
        row = await DrawingBalloonSheet.filter(
            id=sheet_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("图纸气泡标注单不存在")
        return row

    async def _load_lines(self, tenant_id: int, sheet_id: int) -> List[DrawingBalloonSheetLine]:
        return await DrawingBalloonSheetLine.filter(
            tenant_id=tenant_id, sheet_id=sheet_id, deleted_at__isnull=True
        ).order_by("sequence", "id")

    def _line_to_response(self, row: DrawingBalloonSheetLine) -> DrawingBalloonSheetLineResponse:
        return DrawingBalloonSheetLineResponse.model_validate(row)

    def _to_response(
        self, row: DrawingBalloonSheet, lines: Optional[List[DrawingBalloonSheetLine]] = None
    ) -> DrawingBalloonSheetResponse:
        payload = DrawingBalloonSheetResponse.model_validate(row)
        if lines is not None:
            payload.lines = [self._line_to_response(l) for l in lines]
        return payload

    async def _replace_lines(
        self, tenant_id: int, sheet_id: int, items: List[DrawingBalloonSheetLineCreate]
    ) -> List[DrawingBalloonSheetLine]:
        now = resolve_business_datetime()
        await DrawingBalloonSheetLine.filter(
            tenant_id=tenant_id, sheet_id=sheet_id, deleted_at__isnull=True
        ).update(deleted_at=now)
        created: List[DrawingBalloonSheetLine] = []
        for idx, item in enumerate(items, start=1):
            data = item.model_dump()
            seq = data.get("sequence") or idx
            row = await DrawingBalloonSheetLine.create(
                tenant_id=tenant_id,
                sheet_id=sheet_id,
                sequence=seq,
                balloon_no=data.get("balloon_no"),
                characteristic_name=data["characteristic_name"],
                nominal_value=_dec(data.get("nominal_value")),
                upper_tolerance=_dec(data.get("upper_tolerance")),
                lower_tolerance=_dec(data.get("lower_tolerance")),
                unit=data.get("unit"),
                remarks=data.get("remarks"),
            )
            created.append(row)
        return created

    async def create_sheet(
        self, tenant_id: int, payload: DrawingBalloonSheetCreate, user: Optional[User] = None
    ) -> DrawingBalloonSheetResponse:
        await assert_drawing_balloon_pro_access(tenant_id)
        data = payload.model_dump()
        status = data.get("status") or "draft"
        if status not in SHEET_STATUSES:
            raise BusinessLogicError("非法状态")
        data["sheet_code"] = await self._ensure_code(tenant_id, data.get("sheet_code"))
        exists = await DrawingBalloonSheet.filter(
            tenant_id=tenant_id, sheet_code=data["sheet_code"], deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("标注单编码已存在")
        row = DrawingBalloonSheet(tenant_id=tenant_id, **data)
        apply_create_audit(row, user)
        await row.save()
        return self._to_response(row, [])

    async def list_sheets(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        confirmed_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> DrawingBalloonSheetListResponse:
        query = DrawingBalloonSheet.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            query = query.filter(title__icontains=keyword)
        if status:
            query = query.filter(status=status)
        if confirmed_only:
            query = query.filter(status="confirmed")
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        return DrawingBalloonSheetListResponse(
            items=[self._to_response(r) for r in rows],
            total=total,
        )

    async def get_sheet(self, tenant_id: int, sheet_id: int) -> DrawingBalloonSheetResponse:
        row = await self._get_sheet(tenant_id, sheet_id)
        lines = await self._load_lines(tenant_id, sheet_id)
        return self._to_response(row, lines)

    async def get_by_linked_fai_order(
        self, tenant_id: int, fai_order_id: int
    ) -> Optional[DrawingBalloonSheetResponse]:
        row = await DrawingBalloonSheet.filter(
            tenant_id=tenant_id,
            linked_fai_order_id=fai_order_id,
            deleted_at__isnull=True,
        ).order_by("-id").first()
        if not row:
            return None
        lines = await self._load_lines(tenant_id, row.id)
        return self._to_response(row, lines)

    async def update_sheet(
        self,
        tenant_id: int,
        sheet_id: int,
        payload: DrawingBalloonSheetUpdate,
        user: Optional[User] = None,
    ) -> DrawingBalloonSheetResponse:
        row = await self._get_sheet(tenant_id, sheet_id)
        if row.status not in EDITABLE_STATUSES:
            raise BusinessLogicError("已确认单据不可修改")
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] not in SHEET_STATUSES:
            raise BusinessLogicError("非法状态")
        if "sheet_code" in data and data["sheet_code"]:
            dup = await DrawingBalloonSheet.filter(
                tenant_id=tenant_id,
                sheet_code=data["sheet_code"],
                deleted_at__isnull=True,
            ).exclude(id=sheet_id).exists()
            if dup:
                raise BusinessLogicError("标注单编码已存在")
        for k, v in data.items():
            setattr(row, k, v)
        apply_update_audit(row, user)
        await row.save()
        lines = await self._load_lines(tenant_id, sheet_id)
        return self._to_response(row, lines)

    async def delete_sheet(
        self, tenant_id: int, sheet_id: int, user: Optional[User] = None
    ) -> None:
        row = await self._get_sheet(tenant_id, sheet_id)
        if row.status != "draft":
            raise BusinessLogicError("仅草稿可删除")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()

    async def save_balloon_candidates(
        self,
        tenant_id: int,
        sheet_id: int,
        candidates: List[Any],
        drawing_file_url: Optional[str] = None,
        user: Optional[User] = None,
    ) -> DrawingBalloonSheetResponse:
        await assert_drawing_balloon_pro_access(tenant_id)
        row = await self._get_sheet(tenant_id, sheet_id)
        if row.status not in EDITABLE_STATUSES:
            raise BusinessLogicError("已确认单据不可修改候选")
        row.balloon_candidates = candidates
        if drawing_file_url is not None:
            row.drawing_file_url = drawing_file_url
        apply_update_audit(row, user)
        await row.save()
        lines = await self._load_lines(tenant_id, sheet_id)
        return self._to_response(row, lines)

    async def confirm_lines(
        self,
        tenant_id: int,
        sheet_id: int,
        payload: DrawingBalloonConfirmLinesRequest,
        user: Optional[User] = None,
    ) -> DrawingBalloonSheetResponse:
        await assert_drawing_balloon_pro_access(tenant_id)
        row = await self._get_sheet(tenant_id, sheet_id)
        if row.status not in EDITABLE_STATUSES:
            raise BusinessLogicError("已确认单据不可再次确认")
        candidates = payload.candidates or []
        if not candidates:
            raise BusinessLogicError("候选列表为空")
        creates: List[DrawingBalloonSheetLineCreate] = []
        base_seq = 0
        if not payload.replace_existing:
            existing = await self._load_lines(tenant_id, sheet_id)
            base_seq = len(existing)
            for e in existing:
                creates.append(
                    DrawingBalloonSheetLineCreate(
                        sequence=e.sequence,
                        balloon_no=e.balloon_no,
                        characteristic_name=e.characteristic_name,
                        nominal_value=float(e.nominal_value) if e.nominal_value is not None else None,
                        upper_tolerance=float(e.upper_tolerance) if e.upper_tolerance is not None else None,
                        lower_tolerance=float(e.lower_tolerance) if e.lower_tolerance is not None else None,
                        unit=e.unit,
                        remarks=e.remarks,
                    )
                )
        for idx, raw in enumerate(candidates, start=1):
            if not isinstance(raw, dict):
                raise BusinessLogicError("候选元素须为对象")
            name = str(raw.get("characteristic_name") or raw.get("name") or "").strip()
            if not name:
                raise BusinessLogicError(f"第 {idx} 项缺少特性名称")
            creates.append(
                DrawingBalloonSheetLineCreate(
                    sequence=base_seq + idx,
                    balloon_no=str(raw.get("balloon_no") or (base_seq + idx)),
                    characteristic_name=name,
                    nominal_value=_opt_float(raw.get("nominal_value") or raw.get("nominal")),
                    upper_tolerance=_opt_float(raw.get("upper_tolerance") or raw.get("upper")),
                    lower_tolerance=_opt_float(raw.get("lower_tolerance") or raw.get("lower")),
                    unit=raw.get("unit"),
                    remarks=raw.get("note") or raw.get("remarks"),
                )
            )
        async with in_transaction():
            lines = await self._replace_lines(tenant_id, sheet_id, creates)
            row.balloon_candidates = candidates
            row.status = "confirmed"
            apply_update_audit(row, user)
            await row.save()
            return self._to_response(row, lines)
