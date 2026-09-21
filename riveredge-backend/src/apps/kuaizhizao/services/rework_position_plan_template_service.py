"""返工排位策划模板服务。"""

from __future__ import annotations

import uuid
from typing import List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.rework_position_plan_template import (
    ReworkPositionPlanTemplate,
    ReworkPositionPlanTemplateItem,
)
from apps.kuaizhizao.schemas.rework_position_plan_template import (
    ReworkPositionPlanTemplateCreate,
    ReworkPositionPlanTemplateItemCreate,
    ReworkPositionPlanTemplateItemResponse,
    ReworkPositionPlanTemplateListResponse,
    ReworkPositionPlanTemplateResponse,
    ReworkPositionPlanTemplateUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class ReworkPositionPlanTemplateService(AppBaseService[ReworkPositionPlanTemplate]):
    code_field = "template_code"
    rule_code = "REWORK_POSITION_PLAN_TEMPLATE_CODE"
    code_prefix = "RPPT"

    def __init__(self) -> None:
        super().__init__(ReworkPositionPlanTemplate)
        self.model = ReworkPositionPlanTemplate

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            exists = await ReworkPositionPlanTemplate.filter(
                tenant_id=tenant_id,
                template_code=raw,
                deleted_at__isnull=True,
            ).exists()
            if exists:
                raise ValidationError(f"模板编码已存在: {raw}")
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    async def _load_items(
        self, tenant_id: int, template_id: int
    ) -> List[ReworkPositionPlanTemplateItemResponse]:
        rows = await ReworkPositionPlanTemplateItem.filter(
            tenant_id=tenant_id,
            template_id=template_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "line_no", "id")
        return [
            ReworkPositionPlanTemplateItemResponse(
                id=r.id,
                uuid=str(r.uuid) if r.uuid is not None else None,
                template_id=r.template_id,
                line_no=r.line_no,
                sequence=r.sequence,
                station_name=r.station_name,
                section_name=r.section_name,
                station_code=r.station_code,
                planned_headcount=r.planned_headcount,
                standard_minutes=r.standard_minutes,
                planned_qty=r.planned_qty,
                owner_user_id=r.owner_user_id,
                owner_user_name=r.owner_user_name,
                remarks=r.remarks,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in rows
        ]

    async def _build_response(
        self,
        row: ReworkPositionPlanTemplate,
        *,
        include_items: bool = True,
    ) -> ReworkPositionPlanTemplateResponse:
        resp = ReworkPositionPlanTemplateResponse(
            id=row.id,
            uuid=str(row.uuid) if row.uuid is not None else None,
            template_code=row.template_code,
            template_name=row.template_name,
            product_line_code=row.product_line_code,
            is_active=row.is_active,
            total_items=row.total_items,
            remarks=row.remarks,
            created_by=row.created_by,
            created_by_name=row.created_by_name,
            updated_by=row.updated_by,
            updated_by_name=row.updated_by_name,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        if include_items:
            resp.items = await self._load_items(row.tenant_id, row.id)
        return resp

    async def _replace_items(
        self,
        tenant_id: int,
        template_id: int,
        items: List[ReworkPositionPlanTemplateItemCreate],
        user: User,
    ) -> int:
        now = resolve_business_datetime()
        await ReworkPositionPlanTemplateItem.filter(
            tenant_id=tenant_id,
            template_id=template_id,
            deleted_at__isnull=True,
        ).update(
            deleted_at=now,
            updated_by=user.id,
            updated_by_name=getattr(user, "full_name", None) or getattr(user, "username", None),
        )
        for idx, item in enumerate(items):
            name = (item.station_name or "").strip()
            if not name:
                raise ValidationError(f"第 {idx + 1} 行工序名称不能为空")
            row = ReworkPositionPlanTemplateItem(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                template_id=template_id,
                line_no=item.line_no or (idx + 1),
                sequence=item.sequence or (idx + 1),
                station_name=name,
                section_name=(item.section_name or None),
                station_code=(item.station_code or None),
                planned_headcount=item.planned_headcount,
                standard_minutes=item.standard_minutes,
                planned_qty=item.planned_qty,
                owner_user_id=item.owner_user_id,
                owner_user_name=item.owner_user_name,
                remarks=item.remarks,
            )
            apply_create_audit(row, user)
            await row.save()
        return len(items)

    async def create(
        self,
        tenant_id: int,
        data: ReworkPositionPlanTemplateCreate,
        user: User,
    ) -> ReworkPositionPlanTemplateResponse:
        async with in_transaction():
            code = await self._ensure_code(tenant_id, data.template_code)
            row = ReworkPositionPlanTemplate(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                template_code=code,
                template_name=data.template_name.strip(),
                product_line_code=(data.product_line_code or None),
                is_active=bool(data.is_active),
                total_items=0,
                remarks=data.remarks,
            )
            apply_create_audit(row, user)
            await row.save()
            if data.items:
                row.total_items = await self._replace_items(tenant_id, row.id, data.items, user)
                await row.save(update_fields=["total_items", "updated_at"])
            return await self._build_response(row)

    async def get(self, tenant_id: int, template_id: int) -> ReworkPositionPlanTemplateResponse:
        row = await ReworkPositionPlanTemplate.filter(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"排位策划模板不存在: {template_id}")
        return await self._build_response(row)

    async def list(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        product_line_code: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> ReworkPositionPlanTemplateListResponse:
        query = ReworkPositionPlanTemplate.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(template_code__icontains=kw) | Q(template_name__icontains=kw)
                )
        if product_line_code:
            query = query.filter(product_line_code=product_line_code.strip())
        if is_active is not None:
            query = query.filter(is_active=is_active)
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        items = [await self._build_response(r, include_items=False) for r in rows]
        return ReworkPositionPlanTemplateListResponse(data=items, total=total, success=True)

    async def update(
        self,
        tenant_id: int,
        template_id: int,
        data: ReworkPositionPlanTemplateUpdate,
        user: User,
    ) -> ReworkPositionPlanTemplateResponse:
        row = await ReworkPositionPlanTemplate.filter(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"排位策划模板不存在: {template_id}")
        payload = data.model_dump(exclude_unset=True)
        items = payload.pop("items", None)
        async with in_transaction():
            for key, value in payload.items():
                if key == "template_name" and value is not None:
                    setattr(row, key, str(value).strip())
                else:
                    setattr(row, key, value)
            if items is not None:
                parsed = [ReworkPositionPlanTemplateItemCreate.model_validate(i) for i in items]
                row.total_items = await self._replace_items(tenant_id, row.id, parsed, user)
            apply_update_audit(row, user)
            await row.save()
        return await self._build_response(row)

    async def delete(self, tenant_id: int, template_id: int, user: User) -> None:
        row = await ReworkPositionPlanTemplate.filter(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"排位策划模板不存在: {template_id}")
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, user)
        await row.save(update_fields=["deleted_at", "updated_at", "updated_by", "updated_by_name"])
        await ReworkPositionPlanTemplateItem.filter(
            tenant_id=tenant_id,
            template_id=template_id,
            deleted_at__isnull=True,
        ).update(
            deleted_at=now,
            updated_by=user.id,
            updated_by_name=getattr(user, "full_name", None) or getattr(user, "username", None),
        )
