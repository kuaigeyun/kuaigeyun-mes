"""轻办公审批单据通用服务。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional, Type

from tortoise.models import Model

from apps.kuaioa.services.approval_helper import (
    cancel_approval,
    enrich_with_approval,
    is_audit_required,
    start_approval,
)
from apps.common.audit_actor import apply_create_audit
from apps.kuaioa.services.kuaioa_list_core import (
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    touch_updated,
)
from core.utils.timezone_utils import coerce_business_datetime_to_utc, resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User


@dataclass(frozen=True)
class KuaioaApprovalDocConfig:
    model: Type[Model]
    code_field: str
    code_prefix: str
    entity_type: str
    audit_node_key: str
    title_prefix: str
    keyword_fields: tuple[str, ...]
    not_found_message: str = "单据不存在"


class KuaioaApprovalDocService:
    def __init__(self, config: KuaioaApprovalDocConfig) -> None:
        self.config = config

    async def list_rows(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        applicant_id: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        q = self.config.model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if applicant_id is not None:
            q = q.filter(applicant_id=applicant_id)
        if keyword:
            q = q.filter(build_keyword_q(keyword, *self.config.keyword_fields))
        rows = await q.order_by("-created_at", "-id")
        result: list[dict[str, Any]] = []
        for row in rows:
            item = model_to_dict(row)
            await enrich_with_approval(item, tenant_id, self.config.entity_type)
            result.append(item)
        return result

    async def get_row(self, tenant_id: int, row_id: int) -> dict[str, Any]:
        row = await self.config.model.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(self.config.not_found_message)
        item = model_to_dict(row)
        return await enrich_with_approval(item, tenant_id, self.config.entity_type)

    async def create_row(
        self,
        tenant_id: int,
        payload: dict[str, Any],
        user: User,
        *,
        title_field: str = "title",
    ) -> dict[str, Any]:
        data = dict(payload)
        code = await generate_daily_code(
            self.config.model,
            tenant_id,
            self.config.code_prefix,
            code_field=self.config.code_field,
        )
        data[self.config.code_field] = code
        data["tenant_id"] = tenant_id
        applicant_id = data.get("applicant_id")
        if applicant_id:
            data["applicant_id"] = int(applicant_id)
            if not data.get("applicant_name"):
                picked = await User.get_or_none(id=int(applicant_id))
                data["applicant_name"] = (
                    getattr(picked, "name", None) or getattr(picked, "username", None) if picked else None
                )
        else:
            data["applicant_id"] = user.id
            data["applicant_name"] = getattr(user, "name", None) or getattr(user, "username", None)
        data["status"] = "draft"
        apply_create_audit(data, user)
        if title_field in data and isinstance(data[title_field], str):
            data[title_field] = data[title_field].strip()
        row = await self.config.model.create(**data)
        return model_to_dict(row)

    async def update_row(
        self,
        tenant_id: int,
        row_id: int,
        payload: dict[str, Any],
        user_id: int,
        *,
        editable_statuses: frozenset[str] = frozenset({"draft", "rejected"}),
    ) -> dict[str, Any]:
        row = await self.config.model.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(self.config.not_found_message)
        if row.status not in editable_statuses:
            raise BusinessLogicError("当前状态不可编辑")
        for key, value in payload.items():
            if key in {"id", "tenant_id", "uuid", self.config.code_field, "status", "applicant_id"}:
                continue
            if hasattr(row, key):
                setattr(row, key, value)
        await touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_row(
        self,
        tenant_id: int,
        row_id: int,
        user_id: int,
        *,
        deletable_statuses: frozenset[str] = frozenset({"draft", "cancelled"}),
    ) -> None:
        row = await self.config.model.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(self.config.not_found_message)
        if row.status not in deletable_statuses:
            raise BusinessLogicError("仅草稿或已撤销状态可删除")
        row.deleted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()

    async def submit_row(
        self,
        tenant_id: int,
        row_id: int,
        user_id: int,
        *,
        title_getter: Callable[[Model], str],
        content_getter: Callable[[Model], str],
    ) -> dict[str, Any]:
        row = await self.config.model.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(self.config.not_found_message)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可提交")
        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()
        if await is_audit_required(tenant_id, self.config.audit_node_key):
            await start_approval(
                tenant_id,
                node_key=self.config.audit_node_key,
                entity_type=self.config.entity_type,
                entity_id=int(row.id),
                entity_uuid=str(row.uuid),
                title=f"{self.config.title_prefix}: {title_getter(row)}",
                content=content_getter(row),
                submitter_id=user_id,
            )
        else:
            row.status = "approved"
            await touch_updated(row, user_id)
            await row.save()
        return await self.get_row(tenant_id, row_id)

    async def revoke_row(self, tenant_id: int, row_id: int, user_id: int) -> dict[str, Any]:
        row = await self.config.model.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(self.config.not_found_message)
        if row.status != "pending":
            raise BusinessLogicError("仅待审批状态可撤销")
        row.status = "cancelled"
        await touch_updated(row, user_id)
        await row.save()
        await cancel_approval(
            tenant_id,
            entity_type=self.config.entity_type,
            entity_id=int(row.id),
            operator_id=user_id,
        )
        return model_to_dict(row)


async def apply_approval_decision(
    model: Type[Model],
    tenant_id: int,
    row_id: int,
    approved: bool,
    user_id: int,
) -> None:
    row = await model.get_or_none(id=row_id, tenant_id=tenant_id, deleted_at__isnull=True)
    if not row:
        return
    row.status = "approved" if approved else "rejected"
    await touch_updated(row, user_id)
    await row.save()


def parse_business_datetime(value: Optional[str]) -> Any:
    if value is None or not str(value).strip():
        return None
    return coerce_business_datetime_to_utc(str(value).strip())
