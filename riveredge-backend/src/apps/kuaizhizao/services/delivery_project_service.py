"""交付项目服务"""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.delivery_project import (
    DeliveryNodeStatus,
    DeliveryNodeTaskStatus,
    DeliveryProjectStatus,
)
from apps.kuaizhizao.models.delivery_project import (
    DeliveryIssue,
    DeliveryNodeReport,
    DeliveryProcessTemplateNodeTask,
    DeliveryProject,
    DeliveryProjectMember,
    DeliveryProjectNode,
    DeliveryProjectNodeTask,
)
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryDashboardKpi,
    DeliveryDashboardResponse,
    DeliveryGanttItem,
    DeliveryFollowUpListEnvelope,
    DeliveryFollowUpRow,
    DeliveryMemberInput,
    DeliveryMemberResponse,
    DeliveryProgressSummaryEnvelope,
    DeliveryProgressSummaryRow,
    DeliveryProcessProgressEnvelope,
    DeliveryProcessProgressRow,
    DeliveryScheduleListEnvelope,
    DeliveryScheduleRow,
    DeliveryIssueProgressEnvelope,
    DeliveryIssueProgressRow,
    DeliveryProjectCreate,
    DeliveryProjectListEnvelope,
    DeliveryProjectListResponse,
    DeliveryProjectNodeResponse,
    DeliveryProjectNodeTaskCreate,
    DeliveryProjectNodeTaskResponse,
    DeliveryProjectNodeTaskUpdate,
    DeliveryProjectNodeUpdate,
    DeliveryProjectResponse,
    DeliveryProjectWorkbenchResponse,
    DeliveryProjectUpdate,
    PushDeliveryProjectFromSalesOrderRequest,
    PushDeliveryProjectPreviewResponse,
)
from apps.kuaizhizao.services.delivery_process_template_service import DeliveryProcessTemplateService
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.models.role import Role


_NODE_OWNER_ROLE_DOMAINS = {
    "production": "production",
    "quality": "quality",
    "logistics": "warehouse",
}


DELIVERY_PROJECT_SORTABLE_FIELDS = frozenset({
    "project_code",
    "project_name",
    "customer_name",
    "delivery_date",
    "status",
    "progress_percent",
    "created_at",
    "updated_at",
})


class DeliveryProjectService(AppBaseService[DeliveryProject]):
    def __init__(self):
        super().__init__(DeliveryProject)
        self._template_service = DeliveryProcessTemplateService()

    async def _generate_project_code(self, tenant_id: int) -> str:
        try:
            return await self.generate_code(tenant_id, "DELIVERY_PROJECT_CODE", prefix="JFXM")
        except Exception:
            import uuid

            return f"JFXM{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    async def _get_or_404(self, tenant_id: int, project_id: int) -> DeliveryProject:
        row = await DeliveryProject.get_or_none(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"交付项目不存在: {project_id}")
        return row

    async def _load_nodes(self, tenant_id: int, project_id: int) -> List[DeliveryProjectNode]:
        return await DeliveryProjectNode.filter(
            tenant_id=tenant_id, project_id=project_id
        ).order_by("sort_order", "id")

    @staticmethod
    def _compute_progress(nodes: List[DeliveryProjectNode]) -> Decimal:
        if not nodes:
            return Decimal("0")
        total = sum(Decimal(str(n.progress_percent or 0)) for n in nodes)
        return (total / len(nodes)).quantize(Decimal("0.01"))

    @staticmethod
    def _resolve_current_node(nodes: List[DeliveryProjectNode]) -> Tuple[Optional[str], Optional[str]]:
        for node in nodes:
            if node.status not in (DeliveryNodeStatus.COMPLETED.value,):
                return node.node_key, node.node_name
        if nodes:
            last = nodes[-1]
            return last.node_key, last.node_name
        return None, None

    async def _refresh_node_overdue(self, tenant_id: int, nodes: List[DeliveryProjectNode]) -> None:
        today = to_site_date(resolve_business_datetime())
        for node in nodes:
            if node.status == DeliveryNodeStatus.COMPLETED.value:
                continue
            if node.planned_end_date and node.planned_end_date < today:
                if node.status != DeliveryNodeStatus.OVERDUE.value:
                    node.status = DeliveryNodeStatus.OVERDUE.value
                    await node.save(update_fields=["status", "updated_at"])

    async def _sync_project_progress(self, project: DeliveryProject, nodes: List[DeliveryProjectNode]) -> None:
        await self._refresh_node_overdue(project.tenant_id, nodes)
        project.progress_percent = self._compute_progress(nodes)
        current_key, current_name = self._resolve_current_node(nodes)
        project.current_node_key = current_key
        project.current_node_name = current_name
        if all(n.status == DeliveryNodeStatus.COMPLETED.value for n in nodes) and nodes:
            project.status = DeliveryProjectStatus.COMPLETED.value
            if not project.actual_end_date:
                project.actual_end_date = to_site_date(resolve_business_datetime())
        await project.save()

    async def _to_list_item(self, row: DeliveryProject) -> DeliveryProjectListResponse:
        member_count = await DeliveryProjectMember.filter(
            tenant_id=row.tenant_id, project_id=row.id, deleted_at__isnull=True
        ).count()
        nodes = await self._load_nodes(row.tenant_id, row.id)
        await self._refresh_node_overdue(row.tenant_id, nodes)
        return DeliveryProjectListResponse(
            id=row.id,
            project_code=row.project_code,
            project_name=row.project_name,
            sales_order_code=row.sales_order_code,
            customer_name=row.customer_name,
            delivery_date=row.delivery_date,
            owner_name=row.owner_name,
            member_count=member_count,
            material_code=row.material_code,
            material_name=row.material_name,
            status=row.status,
            progress_percent=row.progress_percent,
            current_node_name=row.current_node_name,
            nodes=[DeliveryProjectNodeResponse.model_validate(n) for n in nodes],
            created_at=row.created_at,
            updated_at=row.updated_at,
            created_by_name=getattr(row, "created_by_name", None),
            updated_by_name=getattr(row, "updated_by_name", None),
        )

    async def _load_members(self, tenant_id: int, project_id: int) -> List[DeliveryMemberResponse]:
        rows = await DeliveryProjectMember.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).order_by("id")
        return [DeliveryMemberResponse(user_id=r.user_id, user_name=r.user_name) for r in rows]

    async def _resolve_members(
        self,
        tenant_id: int,
        members: List[DeliveryMemberInput],
        *,
        owner_id: Optional[int],
    ) -> List[Tuple[int, str]]:
        resolved: List[Tuple[int, str]] = []
        seen: set[int] = set()
        for item in members or []:
            uid = int(item.user_id)
            if owner_id and uid == owner_id:
                continue
            if uid in seen:
                continue
            user = await User.get_or_none(id=uid, tenant_id=tenant_id)
            if not user:
                raise ValidationError(f"成员不存在: {uid}")
            name = (item.user_name or "").strip() or operator_name_from_user(user)
            resolved.append((uid, name))
            seen.add(uid)
        return resolved

    async def _replace_project_members(
        self,
        tenant_id: int,
        project_id: int,
        members: List[DeliveryMemberInput],
        *,
        owner_id: Optional[int],
        current_user: User,
    ) -> None:
        resolved = await self._resolve_members(tenant_id, members, owner_id=owner_id)
        await DeliveryProjectMember.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())
        for uid, name in resolved:
            row = await DeliveryProjectMember.filter(
                tenant_id=tenant_id, project_id=project_id, user_id=uid
            ).first()
            if row:
                row.user_name = name
                row.deleted_at = None
                apply_update_audit(row, current_user)
                await row.save()
            else:
                created = DeliveryProjectMember(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    user_id=uid,
                    user_name=name,
                )
                apply_create_audit(created, current_user)
                await created.save()

    @staticmethod
    def _parse_task_members(raw: Any) -> List[DeliveryMemberResponse]:
        if not raw:
            return []
        if isinstance(raw, str):
            raw = json.loads(raw)
        if not isinstance(raw, list):
            raise ValidationError("任务 members_json 格式无效")
        out: List[DeliveryMemberResponse] = []
        for item in raw:
            if not isinstance(item, dict) or item.get("user_id") is None:
                raise ValidationError("任务成员项缺少 user_id")
            out.append(
                DeliveryMemberResponse(
                    user_id=int(item["user_id"]),
                    user_name=str(item.get("user_name") or ""),
                )
            )
        return out

    async def _serialize_task_members(
        self, tenant_id: int, members: List[DeliveryMemberInput], *, owner_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        resolved = await self._resolve_members(tenant_id, members, owner_id=owner_id)
        return [{"user_id": uid, "user_name": name} for uid, name in resolved]

    def _to_node_task_response(self, task: DeliveryProjectNodeTask) -> DeliveryProjectNodeTaskResponse:
        return DeliveryProjectNodeTaskResponse(
            id=task.id,
            project_id=task.project_id,
            node_id=task.node_id,
            template_task_id=task.template_task_id,
            task_key=task.task_key,
            task_name=task.task_name,
            sort_order=task.sort_order,
            status=task.status,
            owner_id=task.owner_id,
            owner_name=task.owner_name,
            members=self._parse_task_members(task.members_json),
            planned_start_date=task.planned_start_date,
            planned_end_date=task.planned_end_date,
            actual_start_date=task.actual_start_date,
            actual_end_date=task.actual_end_date,
            progress_percent=task.progress_percent or Decimal("0"),
        )

    async def _load_node_tasks(
        self, tenant_id: int, project_id: int
    ) -> Dict[int, List[DeliveryProjectNodeTask]]:
        rows = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).order_by("sort_order", "id")
        by_node: Dict[int, List[DeliveryProjectNodeTask]] = {}
        for row in rows:
            by_node.setdefault(row.node_id, []).append(row)
        return by_node

    async def _spawn_tasks_for_node(
        self,
        tenant_id: int,
        project: DeliveryProject,
        node: DeliveryProjectNode,
        template_node_id: Optional[int],
    ) -> None:
        if not template_node_id:
            return
        tpl_tasks = await DeliveryProcessTemplateNodeTask.filter(
            tenant_id=tenant_id, template_node_id=template_node_id
        ).order_by("sort_order", "id")
        for tpl_task in tpl_tasks:
            owner_id, owner_name = await self._resolve_node_owner_from_role(
                tenant_id, project, tpl_task.default_owner_role
            )
            await DeliveryProjectNodeTask.create(
                tenant_id=tenant_id,
                project_id=project.id,
                node_id=node.id,
                template_task_id=tpl_task.id,
                task_key=tpl_task.task_key,
                task_name=tpl_task.task_name,
                sort_order=tpl_task.sort_order,
                status=DeliveryNodeTaskStatus.TODO.value,
                owner_id=owner_id,
                owner_name=owner_name,
                members_json=[],
                planned_start_date=node.planned_start_date,
                planned_end_date=node.planned_end_date,
                progress_percent=Decimal("0"),
            )

    async def _to_detail(self, row: DeliveryProject, nodes: Optional[List[DeliveryProjectNode]] = None) -> DeliveryProjectResponse:
        if nodes is None:
            nodes = await self._load_nodes(row.tenant_id, row.id)
        tasks_by_node = await self._load_node_tasks(row.tenant_id, row.id)
        members = await self._load_members(row.tenant_id, row.id)
        node_payloads = []
        for n in nodes:
            node_payloads.append(
                DeliveryProjectNodeResponse(
                    id=n.id,
                    project_id=n.project_id,
                    node_key=n.node_key,
                    node_name=n.node_name,
                    sort_order=n.sort_order,
                    status=n.status,
                    progress_percent=n.progress_percent,
                    owner_id=n.owner_id,
                    owner_name=n.owner_name,
                    planned_start_date=n.planned_start_date,
                    planned_end_date=n.planned_end_date,
                    actual_start_date=n.actual_start_date,
                    actual_end_date=n.actual_end_date,
                    is_critical=n.is_critical,
                    is_milestone=n.is_milestone,
                    tasks=[self._to_node_task_response(t) for t in tasks_by_node.get(n.id, [])],
                )
            )
        return DeliveryProjectResponse(
            id=row.id,
            project_code=row.project_code,
            project_name=row.project_name,
            process_template_id=row.process_template_id,
            process_template_name=row.process_template_name,
            sales_order_id=row.sales_order_id,
            sales_order_code=row.sales_order_code,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            delivery_date=row.delivery_date,
            owner_id=row.owner_id,
            owner_name=row.owner_name,
            members=members,
            material_id=row.material_id,
            material_code=row.material_code,
            material_name=row.material_name,
            material_spec=row.material_spec,
            material_lines=self._parse_material_lines(row),
            rd_project_id=row.rd_project_id,
            status=row.status,
            progress_percent=row.progress_percent,
            current_node_key=row.current_node_key,
            current_node_name=row.current_node_name,
            planned_start_date=row.planned_start_date,
            planned_end_date=row.planned_end_date,
            actual_start_date=row.actual_start_date,
            actual_end_date=row.actual_end_date,
            notes=row.notes,
            nodes=node_payloads,
            created_at=row.created_at,
            updated_at=row.updated_at,
            created_by_name=getattr(row, "created_by_name", None),
            updated_by_name=getattr(row, "updated_by_name", None),
        )

    async def _resolve_owner(self, tenant_id: int, owner_id: Optional[int]) -> Tuple[Optional[int], Optional[str]]:
        if not owner_id:
            return None, None
        user = await User.get_or_none(id=owner_id, tenant_id=tenant_id)
        if not user:
            raise ValidationError(f"负责人不存在: {owner_id}")
        return user.id, operator_name_from_user(user)

    @staticmethod
    def _parse_material_lines(row: DeliveryProject) -> List[Dict[str, Any]]:
        raw = getattr(row, "material_lines_json", None)
        if not raw:
            return []
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            raise ValidationError("交付项目 material_lines_json 格式无效")
        return parsed

    async def _resolve_node_owner_from_role(
        self,
        tenant_id: int,
        project: DeliveryProject,
        role_key: Optional[str],
    ) -> Tuple[Optional[int], Optional[str]]:
        if not role_key:
            return project.owner_id, project.owner_name
        domain = _NODE_OWNER_ROLE_DOMAINS.get(str(role_key).strip().lower())
        if domain:
            role = await Role.filter(
                tenant_id=tenant_id, functional_domain=domain, is_active=True
            ).first()
            if role:
                user = await User.filter(
                    tenant_id=tenant_id, roles__id=role.id, is_active=True
                ).first()
                if user:
                    return user.id, operator_name_from_user(user)
        return project.owner_id, project.owner_name

    async def _spawn_nodes_from_template(
        self,
        tenant_id: int,
        project: DeliveryProject,
        template_id: int,
        start_date: Optional[date],
    ) -> List[DeliveryProjectNode]:
        template = await self._template_service._get_or_404(tenant_id, template_id)
        template_nodes = await self._template_service._load_nodes(tenant_id, template_id)
        if not template_nodes:
            raise ValidationError("流程模板无节点，无法创建项目")
        project.process_template_id = template.id
        project.process_template_name = template.template_name
        planned = self._template_service.compute_node_planned_dates(
            start_date or to_site_date(resolve_business_datetime()),
            template_nodes,
        )
        nodes: List[DeliveryProjectNode] = []
        for tpl_node, p_start, p_end in planned:
            owner_id, owner_name = await self._resolve_node_owner_from_role(
                tenant_id, project, tpl_node.default_owner_role
            )
            node = await DeliveryProjectNode.create(
                tenant_id=tenant_id,
                project_id=project.id,
                template_node_id=tpl_node.id,
                node_key=tpl_node.node_key,
                node_name=tpl_node.node_name,
                sort_order=tpl_node.sort_order,
                status=DeliveryNodeStatus.NOT_STARTED.value,
                progress_percent=Decimal("0"),
                owner_id=owner_id,
                owner_name=owner_name,
                planned_start_date=p_start,
                planned_end_date=p_end,
                is_critical=tpl_node.is_critical,
                is_milestone=tpl_node.is_milestone,
            )
            await self._spawn_tasks_for_node(tenant_id, project, node, tpl_node.id)
            nodes.append(node)
        if planned:
            project.planned_start_date = planned[0][1]
            project.planned_end_date = planned[-1][2]
        return nodes

    async def create_project(
        self,
        tenant_id: int,
        body: DeliveryProjectCreate,
        current_user: User,
    ) -> DeliveryProjectResponse:
        async with in_transaction():
            code = await self._generate_project_code(tenant_id)
            owner_id, owner_name = await self._resolve_owner(tenant_id, body.owner_id)
            customer_name = None
            if body.customer_id:
                customer = await Customer.get_or_none(id=body.customer_id, tenant_id=tenant_id)
                if not customer:
                    raise ValidationError(f"客户不存在: {body.customer_id}")
                customer_name = customer.name
            sales_order_code = None
            if body.sales_order_id:
                so = await SalesOrder.get_or_none(
                    tenant_id=tenant_id, id=body.sales_order_id, deleted_at__isnull=True
                )
                if not so:
                    raise ValidationError(f"销售订单不存在: {body.sales_order_id}")
                sales_order_code = so.order_code
            row = DeliveryProject(
                tenant_id=tenant_id,
                project_code=code,
                project_name=body.project_name.strip(),
                sales_order_id=body.sales_order_id,
                sales_order_code=sales_order_code,
                customer_id=body.customer_id,
                customer_name=customer_name,
                delivery_date=body.delivery_date,
                owner_id=owner_id,
                owner_name=owner_name,
                material_id=body.material_id,
                material_code=body.material_code,
                material_name=body.material_name,
                material_spec=body.material_spec,
                status=DeliveryProjectStatus.DRAFT.value,
                progress_percent=Decimal("0"),
                planned_start_date=body.planned_start_date,
                planned_end_date=body.planned_end_date,
                notes=body.notes,
            )
            apply_create_audit(row, current_user)
            await row.save()
            await self._replace_project_members(
                tenant_id,
                row.id,
                body.members or [],
                owner_id=owner_id,
                current_user=current_user,
            )
            nodes: List[DeliveryProjectNode] = []
            if body.process_template_id:
                nodes = await self._spawn_nodes_from_template(
                    tenant_id, row, body.process_template_id, body.planned_start_date
                )
                await row.save()
            if nodes:
                nodes[0].status = DeliveryNodeStatus.IN_PROGRESS.value
                nodes[0].actual_start_date = to_site_date(resolve_business_datetime())
                await nodes[0].save()
                row.status = DeliveryProjectStatus.IN_PROGRESS.value
                row.actual_start_date = nodes[0].actual_start_date
                await self._sync_project_progress(row, nodes)
        return await self._to_detail(row)

    async def list_projects(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        sales_order_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        current_node_key: Optional[str] = None,
        order_by: Optional[str] = None,
    ) -> DeliveryProjectListEnvelope:
        qs = DeliveryProject.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            qs = qs.filter(
                Q(project_code__icontains=kw)
                | Q(project_name__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(sales_order_code__icontains=kw)
            )
        if status:
            qs = qs.filter(status=status)
        if sales_order_id:
            qs = qs.filter(sales_order_id=sales_order_id)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if current_node_key:
            qs = qs.filter(current_node_key=current_node_key)
        order_field = "-created_at"
        if order_by:
            field = order_by.lstrip("-")
            if field in DELIVERY_PROJECT_SORTABLE_FIELDS:
                order_field = order_by if order_by.startswith("-") else order_by
                if not order_by.startswith("-"):
                    order_field = order_by
        total = await qs.count()
        rows = await qs.order_by(order_field).offset(skip).limit(limit)
        items = [await self._to_list_item(r) for r in rows]
        return DeliveryProjectListEnvelope(items=items, total=total)

    async def get_project(self, tenant_id: int, project_id: int) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        nodes = await self._load_nodes(tenant_id, project_id)
        await self._sync_project_progress(row, nodes)
        return await self._to_detail(row, nodes)

    async def get_workbench(self, tenant_id: int, project_id: int) -> DeliveryProjectWorkbenchResponse:
        detail = await self.get_project(tenant_id, project_id)
        reports = await DeliveryNodeReport.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            deleted_at__isnull=True,
        ).order_by("-report_date", "-id").limit(20)
        issues = await DeliveryIssue.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            deleted_at__isnull=True,
            status__in=["open", "in_progress"],
        ).order_by("-updated_at", "-id").limit(20)
        linked_rd_project = None
        if detail.rd_project_id:
            from apps.kuaiplm.models.rd_project import RdProject

            rd_row = await RdProject.get_or_none(
                tenant_id=tenant_id, id=detail.rd_project_id, deleted_at__isnull=True
            )
            if rd_row:
                linked_rd_project = {
                    "id": rd_row.id,
                    "project_code": rd_row.project_code,
                    "project_name": rd_row.project_name,
                }
        from apps.kuaizhizao.schemas.delivery_project import (
            DeliveryIssueResponse,
            DeliveryNodeReportResponse,
        )

        return DeliveryProjectWorkbenchResponse.model_validate(
            {
                **detail.model_dump(),
                "recent_reports": [
                    DeliveryNodeReportResponse.model_validate(r) for r in reports
                ],
                "open_issues": [DeliveryIssueResponse.model_validate(i) for i in issues],
                "linked_rd_project": linked_rd_project,
            }
        )

    async def update_project(
        self,
        tenant_id: int,
        project_id: int,
        body: DeliveryProjectUpdate,
        current_user: User,
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if body.owner_id is not None:
            row.owner_id, row.owner_name = await self._resolve_owner(tenant_id, body.owner_id)
        if body.project_name is not None:
            row.project_name = body.project_name.strip()
        if body.delivery_date is not None:
            row.delivery_date = body.delivery_date
        if body.status is not None:
            row.status = body.status
        if body.notes is not None:
            row.notes = body.notes
        if body.planned_start_date is not None:
            row.planned_start_date = body.planned_start_date
        if body.planned_end_date is not None:
            row.planned_end_date = body.planned_end_date
        apply_update_audit(row, current_user)
        await row.save()
        if body.members is not None:
            await self._replace_project_members(
                tenant_id,
                row.id,
                body.members,
                owner_id=row.owner_id,
                current_user=current_user,
            )
        return await self._to_detail(row)

    async def delete_project(self, tenant_id: int, project_id: int, current_user: User) -> None:
        row = await self._get_or_404(tenant_id, project_id)
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()

    async def start_project(self, tenant_id: int, project_id: int, current_user: User) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        nodes = await self._load_nodes(tenant_id, project_id)
        if not nodes:
            raise ValidationError("项目无流程节点，请先关联流程模板")
        if row.status not in (DeliveryProjectStatus.DRAFT.value, DeliveryProjectStatus.PAUSED.value):
            raise ValidationError("当前状态不可启动")
        row.status = DeliveryProjectStatus.IN_PROGRESS.value
        if not row.actual_start_date:
            row.actual_start_date = to_site_date(resolve_business_datetime())
        first_open = next((n for n in nodes if n.status == DeliveryNodeStatus.NOT_STARTED.value), nodes[0])
        if first_open.status == DeliveryNodeStatus.NOT_STARTED.value:
            first_open.status = DeliveryNodeStatus.IN_PROGRESS.value
            first_open.actual_start_date = to_site_date(resolve_business_datetime())
            await first_open.save()
        apply_update_audit(row, current_user)
        await self._sync_project_progress(row, nodes)
        return await self._to_detail(row, nodes)

    async def pause_project(
        self, tenant_id: int, project_id: int, current_user: User
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status != DeliveryProjectStatus.IN_PROGRESS.value:
            raise ValidationError("仅进行中的项目可暂停")
        row.status = DeliveryProjectStatus.PAUSED.value
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_detail(row)

    async def resume_project(
        self, tenant_id: int, project_id: int, current_user: User
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status != DeliveryProjectStatus.PAUSED.value:
            raise ValidationError("仅已暂停的项目可恢复")
        row.status = DeliveryProjectStatus.IN_PROGRESS.value
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_detail(row)

    async def cancel_project(
        self, tenant_id: int, project_id: int, current_user: User
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status in (
            DeliveryProjectStatus.COMPLETED.value,
            DeliveryProjectStatus.CANCELLED.value,
        ):
            raise ValidationError("已完成或已取消的项目不可再取消")
        row.status = DeliveryProjectStatus.CANCELLED.value
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_detail(row)

    async def complete_project(
        self,
        tenant_id: int,
        project_id: int,
        current_user: User,
        *,
        force: bool = False,
        reason: Optional[str] = None,
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status in (
            DeliveryProjectStatus.COMPLETED.value,
            DeliveryProjectStatus.CANCELLED.value,
        ):
            raise ValidationError("已完成或已取消的项目不可再结案")
        nodes = await self._load_nodes(tenant_id, project_id)
        if not force:
            if not nodes:
                raise ValidationError("项目无流程节点，无法结案")
            if not all(n.status == DeliveryNodeStatus.COMPLETED.value for n in nodes):
                raise ValidationError("尚有未完成节点，无法结案")
        elif reason:
            note = f"强制结案: {reason.strip()}"
            row.notes = f"{row.notes}\n{note}" if row.notes else note
        row.status = DeliveryProjectStatus.COMPLETED.value
        row.actual_end_date = to_site_date(resolve_business_datetime())
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_detail(row, nodes)

    async def change_template(
        self,
        tenant_id: int,
        project_id: int,
        template_id: int,
        current_user: User,
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status != DeliveryProjectStatus.PAUSED.value:
            raise ValidationError("仅已暂停的项目可更换流程模板")
        nodes = await self._load_nodes(tenant_id, project_id)
        kept_keys = {
            n.node_key
            for n in nodes
            if n.status != DeliveryNodeStatus.NOT_STARTED.value
        }
        not_started_ids = list(
            await DeliveryProjectNode.filter(
                tenant_id=tenant_id,
                project_id=project_id,
                status=DeliveryNodeStatus.NOT_STARTED.value,
            ).values_list("id", flat=True)
        )
        if not_started_ids:
            await DeliveryProjectNodeTask.filter(
                tenant_id=tenant_id,
                project_id=project_id,
                node_id__in=not_started_ids,
            ).delete()
        await DeliveryProjectNode.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            status=DeliveryNodeStatus.NOT_STARTED.value,
        ).delete()
        template = await self._template_service._get_or_404(tenant_id, template_id)
        template_nodes = await self._template_service._load_nodes(tenant_id, template_id)
        if not template_nodes:
            raise ValidationError("流程模板无节点，无法更换")
        row.process_template_id = template.id
        row.process_template_name = template.template_name
        start_date = row.planned_start_date or to_site_date(resolve_business_datetime())
        planned = self._template_service.compute_node_planned_dates(start_date, template_nodes)
        for tpl_node, p_start, p_end in planned:
            if tpl_node.node_key in kept_keys:
                continue
            owner_id, owner_name = await self._resolve_node_owner_from_role(
                tenant_id, row, tpl_node.default_owner_role
            )
            node = await DeliveryProjectNode.create(
                tenant_id=tenant_id,
                project_id=row.id,
                template_node_id=tpl_node.id,
                node_key=tpl_node.node_key,
                node_name=tpl_node.node_name,
                sort_order=tpl_node.sort_order,
                status=DeliveryNodeStatus.NOT_STARTED.value,
                progress_percent=Decimal("0"),
                owner_id=owner_id,
                owner_name=owner_name,
                planned_start_date=p_start,
                planned_end_date=p_end,
                is_critical=tpl_node.is_critical,
                is_milestone=tpl_node.is_milestone,
            )
            await self._spawn_tasks_for_node(tenant_id, row, node, tpl_node.id)
        if planned:
            row.planned_start_date = planned[0][1]
            row.planned_end_date = planned[-1][2]
        apply_update_audit(row, current_user)
        await row.save()
        refreshed_nodes = await self._load_nodes(tenant_id, project_id)
        await self._sync_project_progress(row, refreshed_nodes)
        return await self._to_detail(row, refreshed_nodes)

    async def update_project_node(
        self,
        tenant_id: int,
        project_id: int,
        node_id: int,
        body: DeliveryProjectNodeUpdate,
        current_user: User,
    ) -> DeliveryProjectNodeResponse:
        row = await self._get_or_404(tenant_id, project_id)
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {node_id}")
        if body.owner_id is not None:
            if body.owner_id:
                owner_id, owner_name = await self._resolve_owner(tenant_id, body.owner_id)
                node.owner_id = owner_id
                node.owner_name = owner_name
            else:
                node.owner_id = None
                node.owner_name = None
            await node.save()
        apply_update_audit(row, current_user)
        await row.save()
        tasks = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id, project_id=project_id, node_id=node.id, deleted_at__isnull=True
        ).order_by("sort_order", "id")
        return DeliveryProjectNodeResponse(
            id=node.id,
            project_id=node.project_id,
            node_key=node.node_key,
            node_name=node.node_name,
            sort_order=node.sort_order,
            status=node.status,
            progress_percent=node.progress_percent,
            owner_id=node.owner_id,
            owner_name=node.owner_name,
            planned_start_date=node.planned_start_date,
            planned_end_date=node.planned_end_date,
            actual_start_date=node.actual_start_date,
            actual_end_date=node.actual_end_date,
            is_critical=node.is_critical,
            is_milestone=node.is_milestone,
            tasks=[self._to_node_task_response(t) for t in tasks],
        )

    async def create_node_task(
        self,
        tenant_id: int,
        project_id: int,
        body: DeliveryProjectNodeTaskCreate,
        current_user: User,
    ) -> DeliveryProjectNodeTaskResponse:
        await self._get_or_404(tenant_id, project_id)
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=body.node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {body.node_id}")
        owner_id, owner_name = await self._resolve_owner(tenant_id, body.owner_id)
        members_json = await self._serialize_task_members(
            tenant_id, body.members or [], owner_id=owner_id
        )
        task = await DeliveryProjectNodeTask.create(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            task_name=body.task_name.strip(),
            sort_order=body.sort_order,
            status=DeliveryNodeTaskStatus.TODO.value,
            owner_id=owner_id,
            owner_name=owner_name,
            members_json=members_json,
            planned_start_date=body.planned_start_date or node.planned_start_date,
            planned_end_date=body.planned_end_date or node.planned_end_date,
            progress_percent=Decimal("0"),
        )
        apply_create_audit(task, current_user)
        await task.save()
        return self._to_node_task_response(task)

    async def update_node_task(
        self,
        tenant_id: int,
        project_id: int,
        task_id: int,
        body: DeliveryProjectNodeTaskUpdate,
        current_user: User,
    ) -> DeliveryProjectNodeTaskResponse:
        await self._get_or_404(tenant_id, project_id)
        task = await DeliveryProjectNodeTask.get_or_none(
            tenant_id=tenant_id, id=task_id, project_id=project_id, deleted_at__isnull=True
        )
        if not task:
            raise NotFoundError(f"节点任务不存在: {task_id}")
        if body.task_name is not None:
            task.task_name = body.task_name.strip()
        if body.sort_order is not None:
            task.sort_order = body.sort_order
        if body.status is not None:
            task.status = body.status
            if body.status == DeliveryNodeTaskStatus.DONE.value and not task.actual_end_date:
                task.actual_end_date = to_site_date(resolve_business_datetime())
                task.progress_percent = Decimal("100")
            if body.status == DeliveryNodeTaskStatus.IN_PROGRESS.value and not task.actual_start_date:
                task.actual_start_date = to_site_date(resolve_business_datetime())
        if body.owner_id is not None:
            task.owner_id, task.owner_name = await self._resolve_owner(tenant_id, body.owner_id)
        if body.members is not None:
            task.members_json = await self._serialize_task_members(
                tenant_id, body.members, owner_id=task.owner_id
            )
        if body.planned_start_date is not None:
            task.planned_start_date = body.planned_start_date
        if body.planned_end_date is not None:
            task.planned_end_date = body.planned_end_date
        if body.progress_percent is not None:
            task.progress_percent = body.progress_percent
        apply_update_audit(task, current_user)
        await task.save()
        await self._maybe_sync_node_progress_from_tasks(tenant_id, project_id, task.node_id)
        return self._to_node_task_response(task)

    async def delete_node_task(
        self,
        tenant_id: int,
        project_id: int,
        task_id: int,
        current_user: User,
    ) -> None:
        await self._get_or_404(tenant_id, project_id)
        task = await DeliveryProjectNodeTask.get_or_none(
            tenant_id=tenant_id, id=task_id, project_id=project_id, deleted_at__isnull=True
        )
        if not task:
            raise NotFoundError(f"节点任务不存在: {task_id}")
        node_id = task.node_id
        task.deleted_at = resolve_business_datetime()
        apply_update_audit(task, current_user)
        await task.save()
        await self._maybe_sync_node_progress_from_tasks(tenant_id, project_id, node_id)

    async def _maybe_sync_node_progress_from_tasks(
        self, tenant_id: int, project_id: int, node_id: int
    ) -> None:
        """无汇报覆盖时，用任务完成率回填节点进度。"""
        has_approved_report = await DeliveryNodeReport.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node_id,
            status="approved",
            deleted_at__isnull=True,
        ).exists()
        if has_approved_report:
            return
        tasks = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node_id,
            deleted_at__isnull=True,
        )
        if not tasks:
            return
        done = sum(1 for t in tasks if t.status == DeliveryNodeTaskStatus.DONE.value)
        percent = Decimal(str(round(100 * done / len(tasks), 2)))
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=node_id, project_id=project_id
        )
        if not node:
            return
        node.progress_percent = percent
        if percent >= 100:
            node.status = DeliveryNodeStatus.COMPLETED.value
            if not node.actual_end_date:
                node.actual_end_date = to_site_date(resolve_business_datetime())
        elif done > 0 and node.status == DeliveryNodeStatus.NOT_STARTED.value:
            node.status = DeliveryNodeStatus.IN_PROGRESS.value
            if not node.actual_start_date:
                node.actual_start_date = to_site_date(resolve_business_datetime())
        await node.save()
        project = await self._get_or_404(tenant_id, project_id)
        nodes = await self._load_nodes(tenant_id, project_id)
        await self._sync_project_progress(project, nodes)

    async def preview_push_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        current_user: User,
    ) -> PushDeliveryProjectPreviewResponse:
        so = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not so:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=sales_order_id).all()
        material_lines = [
            {
                "material_id": it.material_id,
                "material_code": it.material_code,
                "material_name": it.material_name,
                "material_spec": it.material_spec,
                "quantity": str(it.quantity),
            }
            for it in items
        ]
        existing = await DeliveryProject.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
            status__not=DeliveryProjectStatus.CANCELLED.value,
        ).first()
        default_template = await self._template_service.ensure_default_template(tenant_id, current_user)
        return PushDeliveryProjectPreviewResponse(
            sales_order_id=so.id,
            sales_order_code=so.order_code,
            customer_id=so.customer_id,
            customer_name=so.customer_name,
            delivery_date=so.delivery_date,
            material_lines=material_lines,
            existing_project_id=existing.id if existing else None,
            existing_project_code=existing.project_code if existing else None,
            default_template_id=default_template.id,
            default_template_name=default_template.template_name,
        )

    async def push_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        body: PushDeliveryProjectFromSalesOrderRequest,
        current_user: User,
    ) -> DeliveryProjectResponse:
        preview = await self.preview_push_from_sales_order(tenant_id, sales_order_id, current_user)
        if preview.existing_project_id:
            raise ValidationError(
                f"该销售订单已存在交付项目: {preview.existing_project_code}"
            )
        first_line = preview.material_lines[0] if preview.material_lines else {}
        project_name = (
            body.project_name.strip()
            if body.project_name
            else f"{preview.customer_name or preview.sales_order_code} 交机项目"
        )
        create_body = DeliveryProjectCreate(
            project_name=project_name,
            process_template_id=body.process_template_id or preview.default_template_id,
            sales_order_id=sales_order_id,
            customer_id=preview.customer_id,
            delivery_date=preview.delivery_date,
            owner_id=body.owner_id,
            material_id=first_line.get("material_id"),
            material_code=first_line.get("material_code"),
            material_name=first_line.get("material_name"),
            material_spec=first_line.get("material_spec"),
        )
        project = await self.create_project(tenant_id, create_body, current_user)
        row = await DeliveryProject.get(id=project.id)
        row.material_lines_json = json.dumps(preview.material_lines, ensure_ascii=False)
        await row.save(update_fields=["material_lines_json", "updated_at"])
        return await self.start_project(tenant_id, project.id, current_user)

    async def _build_project_gantt_items(self, tenant_id: int) -> List[DeliveryGanttItem]:
        active_statuses = [
            DeliveryProjectStatus.IN_PROGRESS.value,
            DeliveryProjectStatus.PAUSED.value,
        ]
        projects = (
            await DeliveryProject.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=active_statuses,
            )
            .order_by("planned_start_date", "-updated_at")
            .limit(20)
            .all()
        )
        if not projects:
            return []

        project_ids = [p.id for p in projects]
        all_nodes = (
            await DeliveryProjectNode.filter(
                tenant_id=tenant_id,
                project_id__in=project_ids,
            )
            .order_by("project_id", "sort_order")
            .all()
        )
        nodes_by_project: Dict[int, List[DeliveryProjectNode]] = {}
        for node in all_nodes:
            nodes_by_project.setdefault(node.project_id, []).append(node)

        items: List[DeliveryGanttItem] = []
        for project in projects:
            nodes = nodes_by_project.get(project.id, [])
            if not nodes:
                start, end = self._resolve_project_gantt_dates(project)
                items.append(
                    DeliveryGanttItem(
                        id=project.id * 100000,
                        project_id=project.id,
                        node_id=0,
                        project_code=project.project_code,
                        project_name=project.project_name,
                        node_name=project.current_node_name or project.project_name,
                        customer_name=project.customer_name,
                        node_status=project.status,
                        planned_start_date=start,
                        planned_end_date=end,
                        progress=float(project.progress_percent or 0),
                    )
                )
                continue

            for node in nodes:
                start, end = self._resolve_node_gantt_dates(project, node)
                if start is None or end is None:
                    continue
                items.append(
                    DeliveryGanttItem(
                        id=project.id * 100000 + node.id,
                        project_id=project.id,
                        node_id=node.id,
                        project_code=project.project_code,
                        project_name=project.project_name,
                        node_name=node.node_name,
                        customer_name=project.customer_name,
                        node_status=node.status,
                        planned_start_date=start,
                        planned_end_date=end,
                        progress=float(node.progress_percent or 0),
                    )
                )
        return items

    @staticmethod
    def _resolve_project_gantt_dates(project: DeliveryProject) -> Tuple[date, date]:
        start = project.planned_start_date or project.actual_start_date
        end = project.planned_end_date or project.delivery_date
        today = to_site_date(resolve_business_datetime())
        if start is None:
            if project.delivery_date:
                start = project.delivery_date - timedelta(days=60)
            else:
                start = today
        if end is None or end <= start:
            end = project.delivery_date or (start + timedelta(days=30))
        if end <= start:
            end = start + timedelta(days=7)
        return start, end

    @classmethod
    def _resolve_node_gantt_dates(
        cls,
        project: DeliveryProject,
        node: DeliveryProjectNode,
    ) -> Tuple[Optional[date], Optional[date]]:
        start = node.planned_start_date or node.actual_start_date
        end = node.planned_end_date or node.actual_end_date
        if start is None and end is not None:
            start = end - timedelta(days=7)
        if end is None and start is not None:
            end = start + timedelta(days=7)
        if start is None or end is None:
            p_start, p_end = cls._resolve_project_gantt_dates(project)
            return p_start, p_end
        if end <= start:
            end = start + timedelta(days=1)
        return start, end

    async def get_dashboard(self, tenant_id: int) -> DeliveryDashboardResponse:
        active_statuses = [
            DeliveryProjectStatus.IN_PROGRESS.value,
            DeliveryProjectStatus.PAUSED.value,
        ]
        active_projects = await DeliveryProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=active_statuses
        ).count()
        overdue_nodes = await DeliveryProjectNode.filter(
            tenant_id=tenant_id, status=DeliveryNodeStatus.OVERDUE.value
        ).count()
        today = to_site_date(resolve_business_datetime())
        at_risk = await DeliveryProject.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=active_statuses,
            delivery_date__lt=today,
        ).count()
        open_issues = await DeliveryIssue.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["open", "in_progress"],
        ).count()
        recent = await DeliveryProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).order_by("-updated_at").limit(8)
        overdue_node_rows = await DeliveryProjectNode.filter(
            tenant_id=tenant_id, status=DeliveryNodeStatus.OVERDUE.value
        ).order_by("planned_end_date").limit(10)
        overdue_payload: List[Dict[str, Any]] = []
        if overdue_node_rows:
            project_ids = {n.project_id for n in overdue_node_rows}
            projects = await DeliveryProject.filter(tenant_id=tenant_id, id__in=list(project_ids)).all()
            project_map = {p.id: p for p in projects}
            for node in overdue_node_rows:
                proj = project_map.get(node.project_id)
                overdue_payload.append(
                    {
                        "project_id": node.project_id,
                        "project_code": proj.project_code if proj else None,
                        "project_name": proj.project_name if proj else None,
                        "node_id": node.id,
                        "node_name": node.node_name,
                        "planned_end_date": node.planned_end_date,
                    }
                )
        project_gantt = await self._build_project_gantt_items(tenant_id)
        return DeliveryDashboardResponse(
            kpis=DeliveryDashboardKpi(
                active_projects=active_projects,
                overdue_nodes=overdue_nodes,
                at_risk_projects=at_risk,
                open_issues=open_issues,
            ),
            recent_projects=[await self._to_list_item(r) for r in recent],
            overdue_nodes=overdue_payload,
            project_gantt=project_gantt,
        )

    async def list_follow_up(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
    ) -> DeliveryFollowUpListEnvelope:
        envelope = await self.list_projects(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            status=status,
        )
        items: List[DeliveryFollowUpRow] = [
            DeliveryFollowUpRow(
                project_id=summary.id,
                project_code=summary.project_code,
                project_name=summary.project_name,
                customer_name=summary.customer_name,
                delivery_date=summary.delivery_date,
                status=summary.status,
                progress_percent=summary.progress_percent,
                current_node_name=summary.current_node_name,
                nodes=summary.nodes,
                created_at=summary.created_at,
                updated_at=summary.updated_at,
                created_by_name=summary.created_by_name,
                updated_by_name=summary.updated_by_name,
            )
            for summary in envelope.items
        ]
        return DeliveryFollowUpListEnvelope(items=items, total=envelope.total)

    async def list_progress_summary(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> DeliveryProgressSummaryEnvelope:
        envelope = await self.list_projects(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            status=status,
            customer_id=customer_id,
        )
        today = to_site_date(resolve_business_datetime())
        items: List[DeliveryProgressSummaryRow] = []
        for summary in envelope.items:
            nodes = await self._load_nodes(tenant_id, summary.id)
            await self._refresh_node_overdue(tenant_id, nodes)
            overdue_count = sum(1 for n in nodes if n.status == DeliveryNodeStatus.OVERDUE.value)
            open_issues = await DeliveryIssue.filter(
                tenant_id=tenant_id,
                project_id=summary.id,
                deleted_at__isnull=True,
                status__in=["open", "in_progress"],
            ).count()
            project_row = await DeliveryProject.get(id=summary.id)
            days_to_delivery = None
            if project_row.delivery_date:
                days_to_delivery = (project_row.delivery_date - today).days
            node_parts = [
                f"{n.node_name}:{int(n.progress_percent or 0)}%"
                for n in nodes
            ]
            items.append(
                DeliveryProgressSummaryRow(
                    id=summary.id,
                    project_code=summary.project_code,
                    project_name=summary.project_name,
                    customer_name=summary.customer_name,
                    sales_order_code=summary.sales_order_code,
                    delivery_date=summary.delivery_date,
                    owner_name=summary.owner_name,
                    material_code=summary.material_code,
                    material_name=summary.material_name,
                    status=summary.status,
                    progress_percent=summary.progress_percent,
                    current_node_name=summary.current_node_name,
                    planned_end_date=project_row.planned_end_date,
                    overdue_node_count=overdue_count,
                    open_issue_count=open_issues,
                    days_to_delivery=days_to_delivery,
                    node_summary=" / ".join(node_parts) if node_parts else None,
                )
            )
        return DeliveryProgressSummaryEnvelope(items=items, total=envelope.total)

    async def list_process_progress(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 200,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> DeliveryProcessProgressEnvelope:
        envelope = await self.list_projects(
            tenant_id,
            skip=0 if project_id else skip,
            limit=500 if project_id else min(limit * 5, 500),
            keyword=keyword,
            status=status,
        )
        rows: List[DeliveryProcessProgressRow] = []
        for summary in envelope.items:
            if project_id and summary.id != project_id:
                continue
            project_row = await DeliveryProject.get(id=summary.id)
            nodes = await self._load_nodes(tenant_id, summary.id)
            await self._refresh_node_overdue(tenant_id, nodes)
            node_ids = [n.id for n in nodes]
            issue_counts: Dict[int, int] = {}
            if node_ids:
                issues = await DeliveryIssue.filter(
                    tenant_id=tenant_id,
                    project_id=summary.id,
                    node_id__in=node_ids,
                    deleted_at__isnull=True,
                ).all()
                for issue in issues:
                    if issue.node_id:
                        issue_counts[issue.node_id] = issue_counts.get(issue.node_id, 0) + 1
            latest_reports: Dict[int, DeliveryNodeReport] = {}
            if node_ids:
                reports = await DeliveryNodeReport.filter(
                    tenant_id=tenant_id,
                    project_id=summary.id,
                    node_id__in=node_ids,
                    deleted_at__isnull=True,
                ).order_by("-report_date", "-id")
                for report in reports:
                    if report.node_id not in latest_reports:
                        latest_reports[report.node_id] = report
            for node in nodes:
                latest = latest_reports.get(node.id)
                rows.append(
                    DeliveryProcessProgressRow(
                        id=f"{summary.id}-{node.id}",
                        project_id=summary.id,
                        project_code=summary.project_code,
                        project_name=summary.project_name,
                        sales_order_code=summary.sales_order_code,
                        customer_name=summary.customer_name,
                        project_owner_name=summary.owner_name,
                        material_name=project_row.material_name,
                        delivery_date=summary.delivery_date,
                        node_id=node.id,
                        node_key=node.node_key,
                        node_name=node.node_name,
                        sort_order=node.sort_order,
                        node_status=node.status,
                        progress_percent=node.progress_percent,
                        node_owner_name=node.owner_name,
                        planned_start_date=node.planned_start_date,
                        planned_end_date=node.planned_end_date,
                        actual_start_date=node.actual_start_date,
                        actual_end_date=node.actual_end_date,
                        reporter_name=latest.reporter_name if latest else None,
                        issue_count=issue_counts.get(node.id, 0),
                        is_critical=node.is_critical,
                        is_milestone=node.is_milestone,
                    )
                )
        total = len(rows)
        page = rows[skip : skip + limit]
        return DeliveryProcessProgressEnvelope(items=page, total=total)

    async def list_schedules(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
    ) -> DeliveryScheduleListEnvelope:
        envelope = await self.list_projects(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            status=status or DeliveryProjectStatus.IN_PROGRESS.value,
            order_by="delivery_date",
        )
        today = to_site_date(resolve_business_datetime())
        items: List[DeliveryScheduleRow] = []
        for summary in envelope.items:
            nodes = await self._load_nodes(tenant_id, summary.id)
            await self._refresh_node_overdue(tenant_id, nodes)
            schedule_node = None
            for node in nodes:
                if node.status not in (DeliveryNodeStatus.COMPLETED.value,):
                    schedule_node = node
                    break
            if schedule_node is None and nodes:
                schedule_node = nodes[-1]
            report_overdue = False
            if schedule_node and schedule_node.planned_end_date:
                report_overdue = (
                    schedule_node.status == DeliveryNodeStatus.OVERDUE.value
                    or (
                        schedule_node.planned_end_date < today
                        and schedule_node.status != DeliveryNodeStatus.COMPLETED.value
                    )
                )
            items.append(
                DeliveryScheduleRow(
                    project_id=summary.id,
                    project_code=summary.project_code,
                    project_name=summary.project_name,
                    customer_name=summary.customer_name,
                    delivery_date=summary.delivery_date,
                    owner_name=summary.owner_name,
                    status=summary.status,
                    progress_percent=summary.progress_percent,
                    current_node_name=summary.current_node_name,
                    schedule_node_name=schedule_node.node_name if schedule_node else None,
                    schedule_node_owner_name=schedule_node.owner_name if schedule_node else None,
                    planned_start_date=schedule_node.planned_start_date if schedule_node else None,
                    planned_end_date=schedule_node.planned_end_date if schedule_node else None,
                    node_status=schedule_node.status if schedule_node else None,
                    report_overdue=report_overdue,
                    created_at=summary.created_at,
                    updated_at=summary.updated_at,
                    created_by_name=summary.created_by_name,
                    updated_by_name=summary.updated_by_name,
                )
            )
        return DeliveryScheduleListEnvelope(items=items, total=envelope.total)

    async def list_issue_progress(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> DeliveryIssueProgressEnvelope:
        qs = DeliveryIssue.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            qs = qs.filter(
                Q(issue_code__icontains=kw)
                | Q(title__icontains=kw)
                | Q(project_code__icontains=kw)
            )
        if status:
            qs = qs.filter(status=status)
        if project_id:
            qs = qs.filter(project_id=project_id)
        total = await qs.count()
        issues = await qs.order_by("-created_at").offset(skip).limit(limit)
        project_ids = {i.project_id for i in issues}
        projects = await DeliveryProject.filter(tenant_id=tenant_id, id__in=list(project_ids)).all()
        project_map = {p.id: p for p in projects}
        items: List[DeliveryIssueProgressRow] = []
        for issue in issues:
            proj = project_map.get(issue.project_id)
            items.append(
                DeliveryIssueProgressRow(
                    id=issue.id,
                    issue_code=issue.issue_code,
                    project_code=issue.project_code,
                    project_name=proj.project_name if proj else issue.project_code,
                    customer_name=proj.customer_name if proj else None,
                    node_name=issue.node_name,
                    issue_type=issue.issue_type,
                    priority=issue.priority,
                    status=issue.status,
                    title=issue.title,
                    assignee_name=issue.assignee_name,
                    due_date=issue.due_date,
                    created_at=issue.created_at,
                )
            )
        return DeliveryIssueProgressEnvelope(items=items, total=total)
