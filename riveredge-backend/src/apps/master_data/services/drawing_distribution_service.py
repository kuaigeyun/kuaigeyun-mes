"""图档发放单与车间发放控制。"""

from __future__ import annotations

from typing import List, Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.drawing_distribution import (
    DrawingDistribution,
    DrawingDistributionLine,
    DrawingDistributionPolicy,
)
from apps.master_data.schemas.drawing_distribution_schemas import (
    DrawingDistributionCreate,
    DrawingDistributionLineInput,
    DrawingDistributionLineResponse,
    DrawingDistributionListResponse,
    DrawingDistributionPolicyResponse,
    DrawingDistributionRecallRequest,
    DrawingDistributionResponse,
    DrawingDistributionUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


def _line_response(line: DrawingDistributionLine) -> DrawingDistributionLineResponse:
    return DrawingDistributionLineResponse(
        id=line.id,
        drawing_id=line.drawing_id,
        drawing_uuid=line.drawing_uuid,
        drawing_code=line.drawing_code,
        drawing_name=line.drawing_name,
        drawing_revision=line.drawing_revision,
    )


def _to_response(
    row: DrawingDistribution, lines: Optional[List[DrawingDistributionLine]] = None
) -> DrawingDistributionResponse:
    audit = audit_response_fields(row)
    return DrawingDistributionResponse(
        id=row.id,
        uuid=row.uuid,
        tenant_id=row.tenant_id,
        code=row.code,
        name=row.name,
        status=row.status,
        remark=row.remark,
        issued_at=row.issued_at,
        issued_by_name=row.issued_by_name,
        recalled_at=row.recalled_at,
        recalled_by_name=row.recalled_by_name,
        recall_reason=row.recall_reason,
        created_by_name=audit.get("created_by_name"),
        updated_by_name=audit.get("updated_by_name"),
        created_at=row.created_at,
        updated_at=row.updated_at,
        lines=[_line_response(line) for line in (lines or [])],
    )


class DrawingDistributionService:
    @staticmethod
    async def is_distribution_required(tenant_id: int) -> bool:
        policy = await DrawingDistributionPolicy.get_or_none(tenant_id=tenant_id)
        return bool(policy and policy.is_enabled)

    @staticmethod
    async def issued_drawing_ids(tenant_id: int) -> List[int]:
        issued = await DrawingDistribution.filter(
            tenant_id=tenant_id, status="Issued", deleted_at__isnull=True
        ).all()
        if not issued:
            return []
        lines = await DrawingDistributionLine.filter(
            tenant_id=tenant_id,
            distribution_id__in=[row.id for row in issued],
        ).all()
        return list({line.drawing_id for line in lines})

    @staticmethod
    async def get_policy(tenant_id: int) -> DrawingDistributionPolicyResponse:
        policy = await DrawingDistributionPolicy.get_or_none(tenant_id=tenant_id)
        return DrawingDistributionPolicyResponse(is_enabled=bool(policy and policy.is_enabled))

    @staticmethod
    async def update_policy(
        tenant_id: int, is_enabled: bool, current_user: Optional[User]
    ) -> DrawingDistributionPolicyResponse:
        policy = await DrawingDistributionPolicy.get_or_none(tenant_id=tenant_id)
        if not policy:
            policy = DrawingDistributionPolicy(tenant_id=tenant_id, is_enabled=is_enabled)
        else:
            policy.is_enabled = is_enabled
        apply_update_audit(policy, current_user)
        await policy.save()
        return DrawingDistributionPolicyResponse(is_enabled=policy.is_enabled)

    @staticmethod
    async def _next_code(tenant_id: int) -> str:
        day = today_site_str().replace("-", "")
        prefix = f"TF{day}"
        count = await DrawingDistribution.filter(
            tenant_id=tenant_id, code__startswith=prefix
        ).count()
        return f"{prefix}{count + 1:03d}"

    @staticmethod
    async def _replace_lines(
        tenant_id: int,
        distribution: DrawingDistribution,
        lines: List[DrawingDistributionLineInput],
    ) -> List[DrawingDistributionLine]:
        if not lines:
            raise ValidationError("请至少选择一张已发布图纸")
        await DrawingDistributionLine.filter(
            tenant_id=tenant_id, distribution_id=distribution.id
        ).delete()
        created: List[DrawingDistributionLine] = []
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
                raise ValidationError(f"仅已发布图纸可发放: {drawing.code}")
            created.append(
                await DrawingDistributionLine.create(
                    tenant_id=tenant_id,
                    distribution_id=distribution.id,
                    drawing_id=drawing.id,
                    drawing_uuid=drawing.uuid,
                    drawing_code=drawing.code,
                    drawing_name=drawing.name,
                    drawing_revision=drawing.revision,
                )
            )
        if not created:
            raise ValidationError("请至少选择一张已发布图纸")
        return created

    @staticmethod
    async def _get_or_404(tenant_id: int, dist_uuid: str) -> DrawingDistribution:
        row = await DrawingDistribution.get_or_none(
            tenant_id=tenant_id, uuid=dist_uuid, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("发放单不存在")
        return row

    @staticmethod
    async def _lines(tenant_id: int, distribution_id: int) -> List[DrawingDistributionLine]:
        return await DrawingDistributionLine.filter(
            tenant_id=tenant_id, distribution_id=distribution_id
        ).order_by("id")

    @staticmethod
    async def create(
        tenant_id: int, data: DrawingDistributionCreate, current_user: User
    ) -> DrawingDistributionResponse:
        code = (data.code or "").strip().upper() or await DrawingDistributionService._next_code(tenant_id)
        exists = await DrawingDistribution.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"发放单号 {code} 已存在")
        payload = {
            "tenant_id": tenant_id,
            "code": code,
            "name": data.name,
            "remark": (data.remark or "").strip() or None,
            "status": "Draft",
        }
        apply_create_audit(payload, current_user)
        row = await DrawingDistribution.create(**payload)
        lines = await DrawingDistributionService._replace_lines(tenant_id, row, data.lines)
        return _to_response(row, lines)

    @staticmethod
    async def update(
        tenant_id: int,
        dist_uuid: str,
        data: DrawingDistributionUpdate,
        current_user: User,
    ) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Draft":
            raise ValidationError("仅草稿发放单可编辑")
        if data.name is not None:
            row.name = data.name.strip()
        if data.remark is not None:
            row.remark = data.remark.strip() or None
        apply_update_audit(row, current_user)
        await row.save()
        lines = await DrawingDistributionService._lines(tenant_id, row.id)
        if data.lines is not None:
            lines = await DrawingDistributionService._replace_lines(tenant_id, row, data.lines)
        return _to_response(row, lines)

    @staticmethod
    async def get(tenant_id: int, dist_uuid: str) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        return _to_response(row, await DrawingDistributionService._lines(tenant_id, row.id))

    @staticmethod
    async def list_distributions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> DrawingDistributionListResponse:
        query = DrawingDistribution.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw) | Q(remark__icontains=kw))
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        items = [_to_response(row) for row in rows]
        return DrawingDistributionListResponse(data=items, total=total)

    @staticmethod
    async def submit(tenant_id: int, dist_uuid: str, current_user: User) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Draft":
            raise ValidationError("仅草稿发放单可提交")
        lines = await DrawingDistributionService._lines(tenant_id, row.id)
        if not lines:
            raise ValidationError("请至少选择一张已发布图纸")
        row.status = "Pending"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, lines)

    @staticmethod
    async def approve(tenant_id: int, dist_uuid: str, current_user: User) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审发放单可审核发放")
        now = resolve_business_datetime()
        row.status = "Issued"
        row.issued_at = now
        row.issued_by = int(current_user.id)
        row.issued_by_name = (current_user.full_name or current_user.username or "").strip() or None
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingDistributionService._lines(tenant_id, row.id))

    @staticmethod
    async def reject(tenant_id: int, dist_uuid: str, current_user: User) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审发放单可驳回")
        row.status = "Draft"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingDistributionService._lines(tenant_id, row.id))

    @staticmethod
    async def revoke(tenant_id: int, dist_uuid: str, current_user: User) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Pending":
            raise ValidationError("仅待审发放单可撤回")
        row.status = "Draft"
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingDistributionService._lines(tenant_id, row.id))

    @staticmethod
    async def recall(
        tenant_id: int,
        dist_uuid: str,
        body: DrawingDistributionRecallRequest,
        current_user: User,
    ) -> DrawingDistributionResponse:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status != "Issued":
            raise ValidationError("仅已发放单据可收回")
        now = resolve_business_datetime()
        row.status = "Recalled"
        row.recalled_at = now
        row.recalled_by = int(current_user.id)
        row.recalled_by_name = (current_user.full_name or current_user.username or "").strip() or None
        row.recall_reason = (body.reason or "").strip() or None
        apply_update_audit(row, current_user)
        await row.save()
        return _to_response(row, await DrawingDistributionService._lines(tenant_id, row.id))

    @staticmethod
    async def delete(tenant_id: int, dist_uuid: str) -> None:
        row = await DrawingDistributionService._get_or_404(tenant_id, dist_uuid)
        if row.status not in ("Draft", "Recalled"):
            raise ValidationError("仅草稿或已收回发放单可删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()
