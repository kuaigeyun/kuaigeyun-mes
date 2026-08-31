"""交付项目问题服务"""

from __future__ import annotations

from typing import Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.delivery_project import DeliveryIssueStatus
from apps.kuaizhizao.models.delivery_project import DeliveryIssue, DeliveryProjectNode
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryIssueCreate,
    DeliveryIssueListEnvelope,
    DeliveryIssueResponse,
    DeliveryIssueUpdate,
)
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class DeliveryIssueService(AppBaseService[DeliveryIssue]):
    def __init__(self):
        super().__init__(DeliveryIssue)
        self._project_service = DeliveryProjectService()

    async def _generate_issue_code(self, tenant_id: int) -> str:
        try:
            return await self.generate_code(
                tenant_id,
                "DELIVERY_ISSUE_CODE",
                prefix=f"DPI{today_site_str()}",
            )
        except Exception:
            import uuid

            return f"DPI{today_site_str()}{uuid.uuid4().hex[:4].upper()}"

    async def _get_or_404(self, tenant_id: int, issue_id: int) -> DeliveryIssue:
        row = await DeliveryIssue.get_or_none(
            tenant_id=tenant_id, id=issue_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"问题单不存在: {issue_id}")
        return row

    async def create_issue(
        self,
        tenant_id: int,
        body: DeliveryIssueCreate,
        current_user: User,
    ) -> DeliveryIssueResponse:
        project = await self._project_service._get_or_404(tenant_id, body.project_id)
        node_name = None
        if body.node_id:
            node = await DeliveryProjectNode.get_or_none(
                tenant_id=tenant_id, id=body.node_id, project_id=body.project_id
            )
            if not node:
                raise ValidationError(f"节点不存在: {body.node_id}")
            node_name = node.node_name
        assignee_name = None
        if body.assignee_id:
            user = await User.get_or_none(id=body.assignee_id, tenant_id=tenant_id)
            if not user:
                raise ValidationError(f"责任人不存在: {body.assignee_id}")
            assignee_name = operator_name_from_user(user)
        code = await self._generate_issue_code(tenant_id)
        row = DeliveryIssue(
            tenant_id=tenant_id,
            issue_code=code,
            project_id=project.id,
            project_code=project.project_code,
            node_id=body.node_id,
            node_name=node_name,
            issue_type=body.issue_type,
            priority=body.priority,
            status=DeliveryIssueStatus.OPEN.value,
            title=body.title.strip(),
            description=body.description,
            assignee_id=body.assignee_id,
            assignee_name=assignee_name,
            due_date=body.due_date,
        )
        apply_create_audit(row, current_user)
        await row.save()
        return DeliveryIssueResponse.model_validate(row)

    async def list_issues(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        project_id: Optional[int] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> DeliveryIssueListEnvelope:
        qs = DeliveryIssue.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if status:
            qs = qs.filter(status=status)
        if priority:
            qs = qs.filter(priority=priority)
        if keyword:
            kw = keyword.strip()
            qs = qs.filter(
                Q(issue_code__icontains=kw)
                | Q(title__icontains=kw)
                | Q(project_code__icontains=kw)
            )
        total = await qs.count()
        rows = await qs.order_by("-created_at").offset(skip).limit(limit)
        return DeliveryIssueListEnvelope(
            items=[DeliveryIssueResponse.model_validate(r) for r in rows],
            total=total,
        )

    async def get_issue(self, tenant_id: int, issue_id: int) -> DeliveryIssueResponse:
        return DeliveryIssueResponse.model_validate(await self._get_or_404(tenant_id, issue_id))

    async def update_issue(
        self,
        tenant_id: int,
        issue_id: int,
        body: DeliveryIssueUpdate,
        current_user: User,
    ) -> DeliveryIssueResponse:
        row = await self._get_or_404(tenant_id, issue_id)
        if body.issue_type is not None:
            row.issue_type = body.issue_type
        if body.priority is not None:
            row.priority = body.priority
        if body.status is not None:
            row.status = body.status
            if body.status in (DeliveryIssueStatus.RESOLVED.value, DeliveryIssueStatus.CLOSED.value):
                row.resolved_at = resolve_business_datetime()
        if body.title is not None:
            row.title = body.title.strip()
        if body.description is not None:
            row.description = body.description
        if body.assignee_id is not None:
            if body.assignee_id:
                user = await User.get_or_none(id=body.assignee_id, tenant_id=tenant_id)
                if not user:
                    raise ValidationError(f"责任人不存在: {body.assignee_id}")
                row.assignee_id = user.id
                row.assignee_name = operator_name_from_user(user)
            else:
                row.assignee_id = None
                row.assignee_name = None
        if body.due_date is not None:
            row.due_date = body.due_date
        if body.resolution is not None:
            row.resolution = body.resolution
        apply_update_audit(row, current_user)
        await row.save()
        return DeliveryIssueResponse.model_validate(row)

    async def delete_issue(self, tenant_id: int, issue_id: int, current_user: User) -> None:
        row = await self._get_or_404(tenant_id, issue_id)
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
