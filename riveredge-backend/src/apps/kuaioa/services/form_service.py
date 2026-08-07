"""审批表单服务。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaioa.models.form_request import KuaioaFormRequest
from apps.kuaioa.models.form_template import KuaioaFormTemplate
from apps.kuaioa.schemas.forms import (
    FormRequestCreate,
    FormRequestUpdate,
    FormTemplateCreate,
    FormTemplateUpdate,
)
from apps.kuaioa.services.approval_helper import (
    AUDIT_NODE_FORM_REQUEST,
    cancel_approval,
    enrich_with_approval,
    is_audit_required,
    start_approval,
)
from apps.kuaioa.services.kuaioa_list_core import (
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    parse_optional_date,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User


class FormTemplateService:
    async def list_templates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaFormTemplate.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if category:
            q = q.filter(category=category)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "template_code", "template_name"))
        rows = await q.order_by("-updated_at")
        return [model_to_dict(row) for row in rows]

    async def get_template(self, tenant_id: int, template_id: int) -> dict[str, Any]:
        row = await KuaioaFormTemplate.get_or_none(
            id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("表单模板不存在")
        return model_to_dict(row)

    async def create_template(
        self, tenant_id: int, data: FormTemplateCreate, user_id: int
    ) -> dict[str, Any]:
        exists = await KuaioaFormTemplate.filter(
            tenant_id=tenant_id, template_code=data.template_code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("模板编码已存在")
        row = await KuaioaFormTemplate.create(
            tenant_id=tenant_id,
            template_code=data.template_code.strip(),
            template_name=data.template_name.strip(),
            category=data.category,
            description=data.description,
            fields_schema=data.fields_schema,
            is_active=data.is_active,
            created_by=user_id,
            updated_by=user_id,
        )
        return model_to_dict(row)

    async def update_template(
        self, tenant_id: int, template_id: int, data: FormTemplateUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaFormTemplate.get_or_none(
            id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("表单模板不存在")
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_template(self, tenant_id: int, template_id: int, user_id: int) -> None:
        row = await KuaioaFormTemplate.get_or_none(
            id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("表单模板不存在")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()


class FormRequestService:
    async def list_requests(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        template_id: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaFormRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if template_id:
            q = q.filter(template_id=template_id)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "request_code", "title", "applicant_name"))
        rows = await q.order_by("-updated_at")
        result = []
        for row in rows:
            item = model_to_dict(row)
            await enrich_with_approval(item, tenant_id, "kuaioa_form_request")
            result.append(item)
        return result

    async def get_request(self, tenant_id: int, request_id: int) -> dict[str, Any]:
        row = await KuaioaFormRequest.get_or_none(
            id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("申请单不存在")
        item = model_to_dict(row)
        return await enrich_with_approval(item, tenant_id, "kuaioa_form_request")

    async def create_request(
        self, tenant_id: int, data: FormRequestCreate, user: User
    ) -> dict[str, Any]:
        template = None
        if data.template_id:
            template = await KuaioaFormTemplate.get_or_none(
                id=data.template_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
        request_code = await generate_daily_code(
            KuaioaFormRequest, tenant_id, "FR", code_field="request_code"
        )
        row = await KuaioaFormRequest.create(
            tenant_id=tenant_id,
            request_code=request_code,
            template_id=data.template_id,
            template_code=template.template_code if template else data.template_code,
            title=data.title.strip(),
            form_data=data.form_data,
            department_name=data.department_name,
            notes=data.notes,
            applicant_id=user.id,
            applicant_name=getattr(user, "name", None) or getattr(user, "username", None),
            status="draft",
            created_by=user.id,
            updated_by=user.id,
        )
        return model_to_dict(row)

    async def update_request(
        self, tenant_id: int, request_id: int, data: FormRequestUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaFormRequest.get_or_none(
            id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("申请单不存在")
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可编辑")
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_request(self, tenant_id: int, request_id: int, user_id: int) -> None:
        row = await KuaioaFormRequest.get_or_none(
            id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("申请单不存在")
        if row.status not in {"draft", "cancelled"}:
            raise BusinessLogicError("仅草稿或已撤销状态可删除")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()

    async def submit_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        row = await KuaioaFormRequest.get_or_none(
            id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("申请单不存在")
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可提交")
        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()
        if await is_audit_required(tenant_id, AUDIT_NODE_FORM_REQUEST):
            await start_approval(
                tenant_id,
                node_key=AUDIT_NODE_FORM_REQUEST,
                entity_type="kuaioa_form_request",
                entity_id=int(row.id),
                entity_uuid=str(row.uuid),
                title=f"通用申请单: {row.title}",
                content=row.notes or row.title,
                submitter_id=user_id,
            )
        else:
            row.status = "approved"
            touch_updated(row, user_id)
            await row.save()
        return await self.get_request(tenant_id, request_id)

    async def revoke_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        row = await KuaioaFormRequest.get_or_none(
            id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("申请单不存在")
        if row.status != "pending":
            raise BusinessLogicError("仅待审批状态可撤销")
        row.status = "cancelled"
        touch_updated(row, user_id)
        await row.save()
        await cancel_approval(
            tenant_id,
            entity_type="kuaioa_form_request",
            entity_id=int(row.id),
            operator_id=user_id,
        )
        return model_to_dict(row)


async def apply_form_request_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    row = await KuaioaFormRequest.get_or_none(
        id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
    )
    if not row:
        return
    row.status = "approved" if approved else "rejected"
    touch_updated(row, user_id)
    await row.save()
