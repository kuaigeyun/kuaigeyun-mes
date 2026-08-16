"""图档借阅单与密级授权。"""

from __future__ import annotations

from typing import List, Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields, operator_name_from_user
from apps.master_data.models.drawing import DrawingUserClearance, EngineeringDrawing
from apps.master_data.models.drawing_loan import DrawingLoan, DrawingLoanLine
from apps.master_data.schemas.drawing_loan_schemas import (
    DrawingClearanceListResponse,
    DrawingClearanceResponse,
    DrawingClearanceUpsert,
    DrawingLoanCreate,
    DrawingLoanLineInput,
    DrawingLoanLineResponse,
    DrawingLoanListResponse,
    DrawingLoanResponse,
    DrawingLoanUpdate,
)
from apps.master_data.services.drawing_security import (
    DrawingSecurityService,
    normalize_security_level,
)
from core.utils.timezone_utils import coerce_business_datetime_to_utc, resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


def _line_response(line: DrawingLoanLine) -> DrawingLoanLineResponse:
    return DrawingLoanLineResponse(
        id=line.id,
        drawing_id=line.drawing_id,
        drawing_uuid=line.drawing_uuid,
        drawing_code=line.drawing_code,
        drawing_name=line.drawing_name,
        drawing_revision=line.drawing_revision,
        security_level=line.security_level,
    )


def _to_response(row: DrawingLoan, lines: Optional[List[DrawingLoanLine]] = None) -> DrawingLoanResponse:
    audit = audit_response_fields(row)
    return DrawingLoanResponse(
        id=row.id,
        uuid=row.uuid,
        tenant_id=row.tenant_id,
        code=row.code,
        name=row.name,
        purpose=row.purpose,
        due_at=row.due_at,
        status=row.status,
        returned_at=row.returned_at,
        returned_by_name=row.returned_by_name,
        created_by_name=audit.get("created_by_name"),
        updated_by_name=audit.get("updated_by_name"),
        created_at=row.created_at,
        updated_at=row.updated_at,
        lines=[_line_response(line) for line in (lines or [])],
    )


class DrawingLoanService:
    @staticmethod
    async def has_active_loan(tenant_id: int, user_id: int, drawing_id: int) -> bool:
        loans = await DrawingLoan.filter(
            tenant_id=tenant_id,
            created_by=user_id,
            status="Borrowed",
            deleted_at__isnull=True,
        ).all()
        if not loans:
            return False
        return await DrawingLoanLine.filter(
            tenant_id=tenant_id,
            loan_id__in=[row.id for row in loans],
            drawing_id=drawing_id,
        ).exists()

    @staticmethod
    async def _next_code(tenant_id: int) -> str:
        day = today_site_str().replace("-", "")
        prefix = f"JY{day}"
        count = await DrawingLoan.filter(tenant_id=tenant_id, code__startswith=prefix).count()
        return f"{prefix}{count + 1:03d}"

    @staticmethod
    async def _get_or_404(tenant_id: int, loan_uuid: str) -> DrawingLoan:
        row = await DrawingLoan.get_or_none(
            tenant_id=tenant_id, uuid=loan_uuid, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("借阅单不存在")
        return row

    @staticmethod
    async def _lines(tenant_id: int, loan_id: int) -> List[DrawingLoanLine]:
        return await DrawingLoanLine.filter(tenant_id=tenant_id, loan_id=loan_id).order_by("id")

    @staticmethod
    async def _replace_lines(
        tenant_id: int,
        loan: DrawingLoan,
        lines: List[DrawingLoanLineInput],
        current_user: User,
    ) -> List[DrawingLoanLine]:
        if not lines:
            raise ValidationError("请至少选择一张已发布图纸")
        await DrawingLoanLine.filter(tenant_id=tenant_id, loan_id=loan.id).delete()
        created: List[DrawingLoanLine] = []
        seen: set[str] = set()
        for item in lines:
            if item.drawing_uuid in seen:
                continue
            seen.add(item.drawing_uuid)
            drawing = await EngineeringDrawing.get_or_none(
                tenant_id=tenant_id, uuid=item.drawing_uuid, deleted_at__isnull=True
            )
            if not drawing:
                raise NotFoundError(f"图纸不存在: {item.drawing_uuid}")
            if (drawing.status or "") != "Released":
                raise ValidationError(f"仅已发布图纸可借阅: {drawing.code}")
            await DrawingSecurityService.assert_can_view(tenant_id, current_user, drawing)
            created.append(
                await DrawingLoanLine.create(
                    tenant_id=tenant_id,
                    loan_id=loan.id,
                    drawing_id=drawing.id,
                    drawing_uuid=drawing.uuid,
                    drawing_code=drawing.code,
                    drawing_name=drawing.name,
                    drawing_revision=drawing.revision,
                    security_level=drawing.security_level,
                )
            )
        if not created:
            raise ValidationError("请至少选择一张已发布图纸")
        return created

    @staticmethod
    async def create(
        tenant_id: int, data: DrawingLoanCreate, current_user: User
    ) -> DrawingLoanResponse:
        code = (data.code or "").strip().upper() or await DrawingLoanService._next_code(tenant_id)
        exists = await DrawingLoan.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"借阅单号 {code} 已存在")
        due_at = coerce_business_datetime_to_utc(data.due_at)
        if due_at is None:
            raise ValidationError("请填写应还时间")
        payload = {
            "tenant_id": tenant_id,
            "code": code,
            "name": data.name,
            "purpose": (data.purpose or "").strip() or None,
            "due_at": due_at,
            "status": "Draft",
        }
        apply_create_audit(payload, current_user)
        row = await DrawingLoan.create(**payload)
        lines = await DrawingLoanService._replace_lines(tenant_id, row, data.lines, current_user)
        return _to_response(row, lines)

    @staticmethod
    async def update(
        tenant_id: int,
        loan_uuid: str,
        data: DrawingLoanUpdate,
        current_user: User,
    ) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Draft":
            raise ValidationError("仅草稿借阅单可编辑")
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise ValidationError("借阅单名称不能为空")
            row.name = name
        if data.purpose is not None:
            row.purpose = data.purpose.strip() or None
        if data.due_at is not None:
            due_at = coerce_business_datetime_to_utc(data.due_at)
            if due_at is None:
                raise ValidationError("请填写应还时间")
            row.due_at = due_at
        apply_update_audit(row, current_user)
        await row.save()
        lines = await DrawingLoanService._lines(tenant_id, row.id)
        if data.lines is not None:
            lines = await DrawingLoanService._replace_lines(tenant_id, row, data.lines, current_user)
        return _to_response(row, lines)

    @staticmethod
    async def get(tenant_id: int, loan_uuid: str) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        return _to_response(row, await DrawingLoanService._lines(tenant_id, row.id))

    @staticmethod
    async def list_loans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> DrawingLoanListResponse:
        query = DrawingLoan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw) | Q(name__icontains=kw) | Q(purpose__icontains=kw)
            )
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        return DrawingLoanListResponse(data=[_to_response(row) for row in rows], total=total)

    @staticmethod
    async def submit(tenant_id: int, loan_uuid: str, current_user: User) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Draft":
            raise ValidationError("仅草稿借阅单可提交")
        lines = await DrawingLoanService._lines(tenant_id, row.id)
        if not lines:
            raise ValidationError("请至少选择一张已发布图纸")
        row.status = "Pending"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, lines)

    @staticmethod
    async def approve(tenant_id: int, loan_uuid: str, current_user: User) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审借阅单可审核")
        row.status = "Borrowed"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingLoanService._lines(tenant_id, row.id))

    @staticmethod
    async def reject(tenant_id: int, loan_uuid: str, current_user: User) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审借阅单可驳回")
        row.status = "Draft"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingLoanService._lines(tenant_id, row.id))

    @staticmethod
    async def revoke(tenant_id: int, loan_uuid: str, current_user: User) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审借阅单可撤回")
        row.status = "Draft"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingLoanService._lines(tenant_id, row.id))

    @staticmethod
    async def complete(tenant_id: int, loan_uuid: str, current_user: User) -> DrawingLoanResponse:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Borrowed":
            raise ValidationError("仅借出中的借阅单可归还")
        now = resolve_business_datetime()
        row.status = "Returned"
        row.returned_at = now
        row.returned_by = int(current_user.id)
        row.returned_by_name = operator_name_from_user(current_user) or None
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingLoanService._lines(tenant_id, row.id))

    @staticmethod
    async def delete(tenant_id: int, loan_uuid: str) -> None:
        row = await DrawingLoanService._get_or_404(tenant_id, loan_uuid)
        if row.status != "Draft":
            raise ValidationError("仅草稿借阅单可删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()

    @staticmethod
    async def list_clearances(tenant_id: int) -> DrawingClearanceListResponse:
        rows = await DrawingUserClearance.filter(tenant_id=tenant_id).order_by("user_name", "id")
        return DrawingClearanceListResponse(
            data=[
                DrawingClearanceResponse(
                    user_id=row.user_id,
                    user_name=row.user_name,
                    security_level=row.security_level,
                    updated_by_name=row.updated_by_name,
                    updated_at=row.updated_at,
                )
                for row in rows
            ],
            total=len(rows),
        )

    @staticmethod
    async def upsert_clearance(
        tenant_id: int, body: DrawingClearanceUpsert, current_user: User
    ) -> DrawingClearanceResponse:
        level = normalize_security_level(body.security_level, field="授权密级")
        target = await User.get_or_none(id=body.user_id, tenant_id=tenant_id)
        if not target:
            raise NotFoundError("用户不存在")
        user_name = operator_name_from_user(target) or target.username
        row = await DrawingUserClearance.get_or_none(tenant_id=tenant_id, user_id=int(target.id))
        if not row:
            row = DrawingUserClearance(
                tenant_id=tenant_id,
                user_id=int(target.id),
                user_name=user_name,
                security_level=level,
            )
        else:
            row.user_name = user_name
            row.security_level = level
        apply_update_audit(row, current_user)
        await row.save()
        return DrawingClearanceResponse(
            user_id=row.user_id,
            user_name=row.user_name,
            security_level=row.security_level,
            updated_by_name=row.updated_by_name,
            updated_at=row.updated_at,
        )

    @staticmethod
    async def delete_clearance(tenant_id: int, user_id: int) -> None:
        row = await DrawingUserClearance.get_or_none(tenant_id=tenant_id, user_id=user_id)
        if not row:
            raise NotFoundError("密级授权不存在")
        await row.delete()
