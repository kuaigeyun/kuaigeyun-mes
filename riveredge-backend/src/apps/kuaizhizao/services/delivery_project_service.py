"""交付项目服务"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.delivery_project import (
    DELIVERY_NODE_DOCUMENT_TYPES,
    DeliveryBoardSection,
    DeliveryLineRole,
    DeliveryNodeStatus,
    DeliveryNodeTaskStatus,
    DeliveryProjectStatus,
    DeliveryTaskKitStatus,
    DeliveryTaskParticipantActionStatus,
    DeliveryTaskParticipantMode,
    DeliveryTaskTrackMode,
)
from apps.kuaizhizao.models.delivery_project import (
    DeliveryIssue,
    DeliveryNodeReport,
    DeliveryProcessTemplate,
    DeliveryProcessTemplateNode,
    DeliveryProcessTemplateNodeTask,
    DeliveryProject,
    DeliveryProjectMember,
    DeliveryProjectNode,
    DeliveryProjectNodeDocument,
    DeliveryProjectNodeScheduleRevision,
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
    DeliveryTaskParticipantActionResponse,
    DeliveryTaskParticipantActionSubmit,
    DeliveryProjectNodeDocumentCreate,
    DeliveryProjectNodeDocumentResponse,
    DeliveryProjectNodeScheduleChangeItem,
    DeliveryProjectNodeScheduleRevisionResponse,
    DeliveryProjectNodeUpdate,
    DeliveryProjectResponse,
    DeliveryProjectWorkbenchResponse,
    DeliveryProjectUpdate,
    DeliverySidelineCreate,
    DeliveryWorkshopBoardCell,
    DeliveryWorkshopBoardCellPatch,
    DeliveryWorkshopBoardColumn,
    DeliveryWorkshopBoardEnvelope,
    DeliveryWorkshopBoardRow,
    PushDeliveryProjectFromSalesOrderRequest,
    PushDeliveryProjectPreviewResponse,
)
from apps.kuaizhizao.services.delivery_process_template_service import DeliveryProcessTemplateService
from apps.kuaizhizao.services.delivery_project_alert_service import DeliveryProjectAlertService
from apps.master_data.models.customer import Customer
from core.utils.timezone_utils import (
    resolve_business_datetime,
    today_site_str,
    to_api_isoformat,
    to_site_date,
)
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
        self._alert_service = DeliveryProjectAlertService()

    @staticmethod
    def _validate_date_range(
        start: Optional[date],
        end: Optional[date],
        *,
        label: str = "计划",
    ) -> None:
        if start and end and end < start:
            raise ValidationError(f"{label}结束日期不能早于开始日期")

    def _validate_task_planned_dates_against_node(
        self,
        node: DeliveryProjectNode,
        planned_start: Optional[date],
        planned_end: Optional[date],
    ) -> None:
        self._validate_date_range(planned_start, planned_end, label="任务计划")
        if node.planned_end_date and planned_end and planned_end > node.planned_end_date:
            raise ValidationError("子任务计划结束不能晚于节点计划结束")

    async def _assert_node_complete_gate(self, tenant_id: int, project_id: int, node: DeliveryProjectNode) -> None:
        if not node.is_milestone:
            return
        has_approved = await DeliveryNodeReport.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            status="approved",
            deleted_at__isnull=True,
        ).exists()
        if has_approved:
            return
        tasks = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            deleted_at__isnull=True,
        )
        open_tasks = [
            t
            for t in tasks
            if t.status != DeliveryNodeTaskStatus.CANCELLED.value
            and t.status != DeliveryNodeTaskStatus.DONE.value
        ]
        if open_tasks:
            raise ValidationError(
                "里程碑节点完成前，该节点下未取消的子任务须全部完成，或存在已通过的节点汇报"
            )

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
            material_spec=row.material_spec,
            status=row.status,
            progress_percent=row.progress_percent,
            current_node_name=row.current_node_name,
            board_section=getattr(row, "board_section", None) or DeliveryBoardSection.ACTIVE.value,
            config_attrs=self._normalize_config_attrs(getattr(row, "config_attrs", None)),
            parent_project_id=getattr(row, "parent_project_id", None),
            line_role=getattr(row, "line_role", None) or DeliveryLineRole.MAIN.value,
            nodes=[DeliveryProjectNodeResponse.model_validate(n) for n in nodes],
            created_at=row.created_at,
            updated_at=row.updated_at,
            created_by_name=getattr(row, "created_by_name", None),
            updated_by_name=getattr(row, "updated_by_name", None),
        )

    @staticmethod
    def _normalize_config_attrs(raw: Any) -> Optional[Dict[str, Any]]:
        if raw is None:
            return None
        if not isinstance(raw, dict):
            raise ValidationError("交付项目 config_attrs 必须为对象")
        return raw

    @staticmethod
    def _normalize_board_section(value: Optional[str]) -> str:
        section = (value or DeliveryBoardSection.ACTIVE.value).strip()
        allowed = {e.value for e in DeliveryBoardSection}
        if section not in allowed:
            raise ValidationError(f"无效的台账分段: {section}")
        return section

    @staticmethod
    def _normalize_line_role(value: Optional[str]) -> str:
        role = (value or DeliveryLineRole.MAIN.value).strip()
        allowed = {e.value for e in DeliveryLineRole}
        if role not in allowed:
            raise ValidationError(f"无效的主旁线角色: {role}")
        return role

    @staticmethod
    def _normalize_track_mode(value: Optional[str]) -> str:
        mode = (value or DeliveryTaskTrackMode.PROGRESS.value).strip()
        allowed = {e.value for e in DeliveryTaskTrackMode}
        if mode not in allowed:
            raise ValidationError(f"无效的任务跟踪方式: {mode}")
        return mode

    @staticmethod
    def _normalize_kit_status(value: Optional[str]) -> str:
        status = (value or DeliveryTaskKitStatus.NONE.value).strip()
        allowed = {e.value for e in DeliveryTaskKitStatus}
        if status not in allowed:
            raise ValidationError(f"无效的齐套状态: {status}")
        return status

    @staticmethod
    def _normalize_participant_mode(value: Optional[str]) -> str:
        mode = (value or DeliveryTaskParticipantMode.SOLO.value).strip()
        allowed = {e.value for e in DeliveryTaskParticipantMode}
        if mode not in allowed:
            raise ValidationError(f"无效的协作方式: {mode}")
        return mode

    @staticmethod
    def _requires_participant_actions(participant_mode: str) -> bool:
        return participant_mode != DeliveryTaskParticipantMode.SOLO.value

    @staticmethod
    def _resolve_participant_action_type(participant_mode: str, track_mode: str) -> str:
        if participant_mode in (
            DeliveryTaskParticipantMode.SIGNOFF_ALL.value,
            DeliveryTaskParticipantMode.SIGNOFF_ANY.value,
        ):
            return "signoff"
        if track_mode == DeliveryTaskTrackMode.KIT.value:
            return "kit"
        return "progress"

    @staticmethod
    def _parse_participant_actions(raw: Any) -> List[Dict[str, Any]]:
        if not raw:
            return []
        if isinstance(raw, str):
            raw = json.loads(raw)
        if not isinstance(raw, list):
            raise ValidationError("participant_actions_json 格式无效")
        out: List[Dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict) or item.get("user_id") is None:
                raise ValidationError("关联人员操作项缺少 user_id")
            out.append(dict(item))
        return out

    def _participant_actions_to_response(
        self, raw: Any
    ) -> List[DeliveryTaskParticipantActionResponse]:
        rows = self._parse_participant_actions(raw)
        return [
            DeliveryTaskParticipantActionResponse(
                user_id=int(item["user_id"]),
                user_name=str(item.get("user_name") or ""),
                role=str(item.get("role") or "member"),
                action=str(item.get("action") or "signoff"),
                status=str(item.get("status") or DeliveryTaskParticipantActionStatus.PENDING.value),
                acted_at=item.get("acted_at"),
                remark=item.get("remark"),
                kit_status=item.get("kit_status"),
                progress_percent=item.get("progress_percent"),
            )
            for item in rows
        ]

    @staticmethod
    def _build_participant_actions(
        *,
        owner_id: Optional[int],
        owner_name: Optional[str],
        members: List[Dict[str, Any]],
        participant_mode: str,
        track_mode: str,
        existing: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        if not DeliveryProjectService._requires_participant_actions(participant_mode):
            return []
        action = DeliveryProjectService._resolve_participant_action_type(
            participant_mode, track_mode
        )
        existing_by_user: Dict[int, Dict[str, Any]] = {}
        for item in existing or []:
            uid = item.get("user_id")
            if uid is not None:
                existing_by_user[int(uid)] = item

        def _row(uid: int, name: str, role: str) -> Dict[str, Any]:
            prior = existing_by_user.get(uid)
            if prior:
                return {
                    "user_id": uid,
                    "user_name": name or str(prior.get("user_name") or ""),
                    "role": role,
                    "action": str(prior.get("action") or action),
                    "status": str(prior.get("status") or DeliveryTaskParticipantActionStatus.PENDING.value),
                    "acted_at": prior.get("acted_at"),
                    "remark": prior.get("remark"),
                    "kit_status": prior.get("kit_status"),
                    "progress_percent": prior.get("progress_percent"),
                }
            return {
                "user_id": uid,
                "user_name": name,
                "role": role,
                "action": action,
                "status": DeliveryTaskParticipantActionStatus.PENDING.value,
                "acted_at": None,
                "remark": None,
                "kit_status": None,
                "progress_percent": None,
            }

        rows: List[Dict[str, Any]] = []
        seen: set[int] = set()
        if owner_id:
            rows.append(_row(int(owner_id), str(owner_name or ""), "owner"))
            seen.add(int(owner_id))
        for member in members or []:
            if not isinstance(member, dict) or member.get("user_id") is None:
                continue
            uid = int(member["user_id"])
            if uid in seen:
                continue
            rows.append(
                _row(uid, str(member.get("user_name") or ""), "member")
            )
            seen.add(uid)
        if not rows:
            raise ValidationError("协作型任务须指定负责人或成员")
        return rows

    def _apply_participant_completion(self, task: DeliveryProjectNodeTask) -> None:
        mode = self._normalize_participant_mode(getattr(task, "participant_mode", None))
        if not self._requires_participant_actions(mode):
            return
        actions = self._parse_participant_actions(task.participant_actions_json)
        if not actions:
            return
        done_count = sum(
            1
            for item in actions
            if item.get("status") == DeliveryTaskParticipantActionStatus.DONE.value
        )
        total = len(actions)
        if total == 0:
            return
        percent = Decimal(str(round(100 * done_count / total, 2)))
        task.progress_percent = percent
        completed = False
        if mode == DeliveryTaskParticipantMode.SIGNOFF_ANY.value:
            completed = done_count >= 1
        else:
            completed = done_count >= total
        if completed:
            task.status = DeliveryNodeTaskStatus.DONE.value
            task.progress_percent = Decimal("100")
            if not task.actual_end_date:
                task.actual_end_date = to_site_date(resolve_business_datetime())
        elif done_count > 0:
            if task.status == DeliveryNodeTaskStatus.TODO.value:
                task.status = DeliveryNodeTaskStatus.IN_PROGRESS.value
            if not task.actual_start_date:
                task.actual_start_date = to_site_date(resolve_business_datetime())
        else:
            if task.status == DeliveryNodeTaskStatus.DONE.value:
                task.status = DeliveryNodeTaskStatus.TODO.value
                task.progress_percent = Decimal("0")
                task.actual_end_date = None

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
            core_task=task.core_task,
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
            track_mode=getattr(task, "track_mode", None) or DeliveryTaskTrackMode.PROGRESS.value,
            kit_status=getattr(task, "kit_status", None) or DeliveryTaskKitStatus.NONE.value,
            participant_mode=self._normalize_participant_mode(
                getattr(task, "participant_mode", None)
            ),
            participant_actions=self._participant_actions_to_response(
                getattr(task, "participant_actions_json", None)
            ),
            attachments=task.attachments if isinstance(task.attachments, list) else None,
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
            tpl_owner_id = getattr(tpl_task, "owner_id", None)
            tpl_owner_name = getattr(tpl_task, "owner_name", None)
            if tpl_owner_id:
                owner_id = tpl_owner_id
                owner_name = tpl_owner_name
            else:
                owner_id, owner_name = await self._resolve_node_owner_from_role(
                    tenant_id, project, tpl_task.default_owner_role
                )
            participant_mode = self._normalize_participant_mode(
                getattr(tpl_task, "participant_mode", None)
            )
            track_mode = (
                getattr(tpl_task, "track_mode", None) or DeliveryTaskTrackMode.PROGRESS.value
            )
            tpl_members_raw = getattr(tpl_task, "members_json", None)
            tpl_members = (
                [
                    {"user_id": m.user_id, "user_name": m.user_name}
                    for m in self._parse_task_members(tpl_members_raw)
                ]
                if isinstance(tpl_members_raw, list) and tpl_members_raw
                else []
            )
            members_json: List[Dict[str, Any]] = tpl_members
            if not members_json and self._requires_participant_actions(participant_mode):
                project_members = await self._load_members(tenant_id, project.id)
                members_json = [
                    {"user_id": m.user_id, "user_name": m.user_name} for m in project_members
                ]
            participant_actions_json = self._build_participant_actions(
                owner_id=owner_id,
                owner_name=owner_name,
                members=members_json,
                participant_mode=participant_mode,
                track_mode=track_mode,
            )
            await DeliveryProjectNodeTask.create(
                tenant_id=tenant_id,
                project_id=project.id,
                node_id=node.id,
                template_task_id=tpl_task.id,
                task_key=tpl_task.task_key,
                task_name=tpl_task.task_name,
                core_task=getattr(tpl_task, "core_task", None),
                sort_order=tpl_task.sort_order,
                status=DeliveryNodeTaskStatus.TODO.value,
                owner_id=owner_id,
                owner_name=owner_name,
                members_json=members_json,
                planned_start_date=node.planned_start_date,
                planned_end_date=node.planned_end_date,
                progress_percent=Decimal("0"),
                track_mode=track_mode,
                kit_status=DeliveryTaskKitStatus.NONE.value,
                participant_mode=participant_mode,
                participant_actions_json=participant_actions_json or None,
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
        detail = DeliveryProjectResponse(
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
            config_attrs=self._normalize_config_attrs(getattr(row, "config_attrs", None)),
            board_section=getattr(row, "board_section", None) or DeliveryBoardSection.ACTIVE.value,
            parent_project_id=getattr(row, "parent_project_id", None),
            parent_project_code=None,
            parent_sync_task_key=getattr(row, "parent_sync_task_key", None),
            line_role=getattr(row, "line_role", None) or DeliveryLineRole.MAIN.value,
            sideline_count=0,
            nodes=node_payloads,
            created_at=row.created_at,
            updated_at=row.updated_at,
            created_by_name=getattr(row, "created_by_name", None),
            updated_by_name=getattr(row, "updated_by_name", None),
        )
        parent_id = getattr(row, "parent_project_id", None)
        if parent_id:
            parent = await DeliveryProject.get_or_none(
                tenant_id=row.tenant_id, id=parent_id, deleted_at__isnull=True
            )
            if parent:
                detail.parent_project_code = parent.project_code
        if (getattr(row, "line_role", None) or DeliveryLineRole.MAIN.value) == DeliveryLineRole.MAIN.value:
            detail.sideline_count = await DeliveryProject.filter(
                tenant_id=row.tenant_id,
                parent_project_id=row.id,
                deleted_at__isnull=True,
            ).count()
        return detail

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
            config_attrs=self._normalize_config_attrs(getattr(project, "config_attrs", None)),
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
                config_attrs=self._normalize_config_attrs(body.config_attrs),
                board_section=self._normalize_board_section(body.board_section),
                parent_project_id=body.parent_project_id,
                parent_sync_task_key=(body.parent_sync_task_key or None),
                line_role=self._normalize_line_role(body.line_role),
            )
            apply_create_audit(row, current_user)
            await row.save()
            line_role = self._normalize_line_role(body.line_role)
            if line_role == DeliveryLineRole.SIDELINE.value and not body.parent_project_id:
                raise ValidationError("旁线项目必须指定 parent_project_id")
            if body.parent_project_id:
                if line_role != DeliveryLineRole.SIDELINE.value:
                    raise ValidationError("指定主项目时 line_role 须为 sideline")
                parent = await DeliveryProject.get_or_none(
                    tenant_id=tenant_id, id=body.parent_project_id, deleted_at__isnull=True
                )
                if not parent:
                    raise ValidationError(f"主线项目不存在: {body.parent_project_id}")
                if (getattr(parent, "line_role", None) or DeliveryLineRole.MAIN.value) != DeliveryLineRole.MAIN.value:
                    raise ValidationError("旁线只能挂在主线项目下")
                if not (body.parent_sync_task_key or "").strip():
                    raise ValidationError("旁线须指定 parent_sync_task_key")
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
        board_section: Optional[str] = None,
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
        if board_section:
            qs = qs.filter(board_section=self._normalize_board_section(board_section))
        order_field = "-delivery_date"
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

    @staticmethod
    def _append_workbench_attachment_items(
        items: List[Dict[str, Any]],
        *,
        attachments: Any,
        source_type: str,
        source_id: int,
        source_label: str,
        node_name: Optional[str] = None,
    ) -> None:
        if not isinstance(attachments, list):
            return
        for file in attachments:
            if not isinstance(file, dict):
                continue
            uid = str(file.get("uid") or "").strip()
            if not uid:
                continue
            items.append(
                {
                    "uid": uid,
                    "name": (file.get("name") or "").strip() or None,
                    "url": (file.get("url") or "").strip() or None,
                    "source_type": source_type,
                    "source_id": source_id,
                    "source_label": source_label,
                    "node_name": (node_name or "").strip() or None,
                }
            )

    async def _collect_workbench_related_attachments(
        self, tenant_id: int, project_id: int
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        report_rows = await DeliveryNodeReport.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            deleted_at__isnull=True,
        ).values("id", "report_code", "node_name", "attachments")
        for report in report_rows:
            self._append_workbench_attachment_items(
                items,
                attachments=report.get("attachments"),
                source_type="node_report",
                source_id=int(report["id"]),
                source_label=str(report.get("report_code") or report["id"]),
                node_name=report.get("node_name"),
            )

        task_rows = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            deleted_at__isnull=True,
        ).values("id", "task_name", "node_id", "attachments")
        node_name_by_id: Dict[int, str] = {}
        if task_rows:
            node_ids = list({int(row["node_id"]) for row in task_rows if row.get("node_id") is not None})
            if node_ids:
                node_rows = await DeliveryProjectNode.filter(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    id__in=node_ids,
                ).values("id", "node_name")
                node_name_by_id = {int(row["id"]): str(row.get("node_name") or "") for row in node_rows}
        for task in task_rows:
            node_id = task.get("node_id")
            self._append_workbench_attachment_items(
                items,
                attachments=task.get("attachments"),
                source_type="node_task",
                source_id=int(task["id"]),
                source_label=str(task.get("task_name") or task["id"]),
                node_name=node_name_by_id.get(int(node_id)) if node_id is not None else None,
            )
        return items

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
            DeliveryWorkbenchRelatedAttachment,
        )

        return DeliveryProjectWorkbenchResponse.model_validate(
            {
                **detail.model_dump(),
                "recent_reports": [
                    DeliveryNodeReportResponse.model_validate(r) for r in reports
                ],
                "open_issues": [DeliveryIssueResponse.model_validate(i) for i in issues],
                "linked_rd_project": linked_rd_project,
                "node_documents": await self.list_node_documents(tenant_id, project_id),
                "related_attachments": [
                    DeliveryWorkbenchRelatedAttachment.model_validate(item)
                    for item in await self._collect_workbench_related_attachments(
                        tenant_id, project_id
                    )
                ],
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
        if body.customer_id is not None:
            if row.sales_order_id:
                raise ValidationError("已关联销售订单的交付项目不可更改客户")
            customer = await Customer.get_or_none(id=body.customer_id, tenant_id=tenant_id)
            if not customer:
                raise ValidationError(f"客户不存在: {body.customer_id}")
            row.customer_id = body.customer_id
            row.customer_name = customer.name
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
        if body.config_attrs is not None:
            row.config_attrs = self._normalize_config_attrs(body.config_attrs)
        if body.board_section is not None:
            row.board_section = self._normalize_board_section(body.board_section)
        if body.parent_sync_task_key is not None:
            row.parent_sync_task_key = body.parent_sync_task_key.strip() or None
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
        if body.config_attrs is not None and row.status == DeliveryProjectStatus.DRAFT.value:
            await self._recalculate_draft_schedule(tenant_id, row, current_user)
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
        await self._sync_sideline_kit_to_parent(tenant_id, row, current_user)
        return await self._to_detail(row, nodes)

    async def _apply_template_planned_schedule(
        self,
        tenant_id: int,
        project: DeliveryProject,
        current_user: User,
        *,
        skip_completed_nodes: bool = False,
    ) -> bool:
        """按流程模板（含并行组）重算项目与各节点计划起止。返回是否写入。"""
        if not project.process_template_id:
            return False
        nodes = await self._load_nodes(tenant_id, project.id)
        if not nodes:
            return False
        template_nodes = await self._template_service._load_nodes(
            tenant_id, project.process_template_id
        )
        by_key = {n.node_key: n for n in template_nodes}
        start = project.planned_start_date or to_site_date(resolve_business_datetime())
        ordered = sorted(
            [n for n in nodes if n.node_key in by_key],
            key=lambda n: (n.sort_order, n.id),
        )
        if not ordered:
            return False
        tpl_ordered = [by_key[n.node_key] for n in ordered]
        planned = self._template_service.compute_node_planned_dates(
            start,
            tpl_ordered,
            config_attrs=self._normalize_config_attrs(getattr(project, "config_attrs", None)),
        )
        updated = False
        for node, (_tpl, p_start, p_end) in zip(ordered, planned):
            if skip_completed_nodes and node.status == DeliveryNodeStatus.COMPLETED.value:
                continue
            node.planned_start_date = p_start
            node.planned_end_date = p_end
            await node.save()
            await DeliveryProjectNodeTask.filter(
                tenant_id=tenant_id,
                project_id=project.id,
                node_id=node.id,
                deleted_at__isnull=True,
            ).update(planned_start_date=p_start, planned_end_date=p_end)
            updated = True
        if planned:
            project.planned_start_date = planned[0][1]
            project.planned_end_date = planned[-1][2]
            apply_update_audit(project, current_user)
            await project.save()
            updated = True
        return updated

    async def recalculate_project_planned_schedule(
        self,
        tenant_id: int,
        project_id: int,
        current_user: User,
        *,
        skip_completed_nodes: bool = False,
    ) -> DeliveryProjectResponse:
        row = await self._get_or_404(tenant_id, project_id)
        await self._apply_template_planned_schedule(
            tenant_id,
            row,
            current_user,
            skip_completed_nodes=skip_completed_nodes,
        )
        nodes = await self._load_nodes(tenant_id, project_id)
        return await self._to_detail(row, nodes)

    async def _recalculate_draft_schedule(
        self,
        tenant_id: int,
        project: DeliveryProject,
        current_user: User,
    ) -> None:
        """草稿且节点均未开始时，按规格档位重算计划日期。"""
        nodes = await self._load_nodes(tenant_id, project.id)
        if not nodes:
            return
        if any(n.status != DeliveryNodeStatus.NOT_STARTED.value for n in nodes):
            return
        await self._apply_template_planned_schedule(
            tenant_id,
            project,
            current_user,
            skip_completed_nodes=False,
        )

    async def _sync_sideline_kit_to_parent(
        self,
        tenant_id: int,
        sideline: DeliveryProject,
        current_user: Optional[User],
    ) -> None:
        if (getattr(sideline, "line_role", None) or "") != DeliveryLineRole.SIDELINE.value:
            return
        parent_id = getattr(sideline, "parent_project_id", None)
        task_key = (getattr(sideline, "parent_sync_task_key", None) or "").strip()
        if not parent_id or not task_key:
            raise ValidationError("旁线结案须配置主线齐套回写任务标识 parent_sync_task_key")
        parent = await DeliveryProject.get_or_none(
            tenant_id=tenant_id, id=parent_id, deleted_at__isnull=True
        )
        if not parent:
            raise ValidationError(f"旁线主项目不存在: {parent_id}")
        task = await DeliveryProjectNodeTask.get_or_none(
            tenant_id=tenant_id,
            project_id=parent.id,
            task_key=task_key,
            deleted_at__isnull=True,
        )
        if not task:
            raise ValidationError(f"主线未找到齐套任务标识: {task_key}")
        today = to_site_date(resolve_business_datetime())
        task.track_mode = DeliveryTaskTrackMode.KIT.value
        task.kit_status = DeliveryTaskKitStatus.READY.value
        task.status = DeliveryNodeTaskStatus.DONE.value
        task.progress_percent = Decimal("100")
        if not task.actual_end_date:
            task.actual_end_date = today
        if not task.actual_start_date:
            task.actual_start_date = today
        apply_update_audit(task, current_user)
        await task.save()

    async def create_sideline(
        self,
        tenant_id: int,
        parent_project_id: int,
        body: DeliverySidelineCreate,
        current_user: User,
    ) -> DeliveryProjectResponse:
        parent = await self._get_or_404(tenant_id, parent_project_id)
        if (getattr(parent, "line_role", None) or DeliveryLineRole.MAIN.value) != DeliveryLineRole.MAIN.value:
            raise ValidationError("仅主线项目可创建旁线")
        sync_key = (body.parent_sync_task_key or "").strip()
        if not sync_key:
            raise ValidationError("旁线须指定回写主线的齐套任务标识")
        create_body = DeliveryProjectCreate(
            project_name=body.project_name.strip(),
            process_template_id=body.process_template_id or parent.process_template_id,
            sales_order_id=parent.sales_order_id,
            customer_id=parent.customer_id,
            delivery_date=body.delivery_date or parent.delivery_date,
            owner_id=body.owner_id if body.owner_id is not None else parent.owner_id,
            members=body.members or [],
            notes=body.notes,
            config_attrs=body.config_attrs
            if body.config_attrs is not None
            else self._normalize_config_attrs(getattr(parent, "config_attrs", None)),
            board_section=DeliveryBoardSection.ACTIVE.value,
            parent_project_id=parent.id,
            parent_sync_task_key=sync_key,
            line_role=DeliveryLineRole.SIDELINE.value,
            planned_start_date=body.planned_start_date or parent.planned_start_date,
        )
        return await self.create_project(tenant_id, create_body, current_user)

    async def list_sidelines(
        self, tenant_id: int, parent_project_id: int
    ) -> DeliveryProjectListEnvelope:
        await self._get_or_404(tenant_id, parent_project_id)
        rows = await DeliveryProject.filter(
            tenant_id=tenant_id,
            parent_project_id=parent_project_id,
            deleted_at__isnull=True,
        ).order_by("-id")
        items = [await self._to_list_item(r) for r in rows]
        return DeliveryProjectListEnvelope(items=items, total=len(items))

    async def apply_work_order_completed(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        actor_user: Optional[User] = None,
    ) -> int:
        """工单完工显式回写已挂链的交付节点进度。不修改已审汇报；进度只升不降。"""
        links = await DeliveryProjectNodeDocument.filter(
            tenant_id=tenant_id,
            doc_type="work_order",
            doc_id=work_order_id,
        )
        if not links:
            return 0
        updated = 0
        today = to_site_date(resolve_business_datetime())
        for link in links:
            project = await DeliveryProject.get_or_none(
                tenant_id=tenant_id, id=link.project_id, deleted_at__isnull=True
            )
            if not project or project.status not in (
                DeliveryProjectStatus.IN_PROGRESS.value,
                DeliveryProjectStatus.PAUSED.value,
            ):
                continue
            node = await DeliveryProjectNode.get_or_none(
                tenant_id=tenant_id, id=link.node_id, project_id=project.id
            )
            if not node or node.status == DeliveryNodeStatus.COMPLETED.value:
                continue
            current = Decimal(str(node.progress_percent or 0))
            if current >= Decimal("100"):
                continue
            if node.status == DeliveryNodeStatus.NOT_STARTED.value:
                node.status = DeliveryNodeStatus.IN_PROGRESS.value
                if not node.actual_start_date:
                    node.actual_start_date = today
            node.progress_percent = Decimal("100")
            # 非里程碑且门禁可通过时自动完成；里程碑仅推进进度，由人工完成
            if not node.is_milestone:
                try:
                    await self._assert_node_complete_gate(tenant_id, project.id, node)
                    tasks = await DeliveryProjectNodeTask.filter(
                        tenant_id=tenant_id,
                        project_id=project.id,
                        node_id=node.id,
                        deleted_at__isnull=True,
                    )
                    open_tasks = [
                        t
                        for t in tasks
                        if t.status
                        not in (
                            DeliveryNodeTaskStatus.CANCELLED.value,
                            DeliveryNodeTaskStatus.DONE.value,
                        )
                    ]
                    if not open_tasks:
                        node.status = DeliveryNodeStatus.COMPLETED.value
                        if not node.actual_end_date:
                            node.actual_end_date = today
                except ValidationError:
                    pass
            apply_update_audit(node, actor_user)
            await node.save()
            apply_update_audit(project, actor_user)
            nodes = await self._load_nodes(tenant_id, project.id)
            await self._sync_project_progress(project, nodes)
            updated += 1
        return updated

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

    @staticmethod
    def _format_node_schedule_value(field: str, value) -> Optional[str]:
        if value is None or value == "":
            return None
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    async def _collect_node_schedule_changes(
        self,
        tenant_id: int,
        node: DeliveryProjectNode,
        body: DeliveryProjectNodeUpdate,
    ) -> List[Dict[str, Optional[str]]]:
        changes: List[Dict[str, Optional[str]]] = []
        if body.owner_id is not None:
            new_owner_id = body.owner_id or None
            if new_owner_id != node.owner_id:
                if new_owner_id:
                    _, new_owner_name = await self._resolve_owner(tenant_id, new_owner_id)
                else:
                    new_owner_name = None
                changes.append(
                    {
                        "field": "owner_name",
                        "before": self._format_node_schedule_value("owner_name", node.owner_name),
                        "after": self._format_node_schedule_value("owner_name", new_owner_name),
                    }
                )
        field_pairs = (
            ("planned_start_date", body.planned_start_date),
            ("planned_end_date", body.planned_end_date),
            ("actual_start_date", body.actual_start_date),
            ("actual_end_date", body.actual_end_date),
        )
        for field, new_value in field_pairs:
            if new_value is None:
                continue
            old_value = getattr(node, field)
            if new_value != old_value:
                changes.append(
                    {
                        "field": field,
                        "before": self._format_node_schedule_value(field, old_value),
                        "after": self._format_node_schedule_value(field, new_value),
                    }
                )
        return changes

    def _to_node_schedule_revision_response(
        self, row: DeliveryProjectNodeScheduleRevision
    ) -> DeliveryProjectNodeScheduleRevisionResponse:
        raw_changes = row.changes_json if isinstance(row.changes_json, list) else []
        changes = [
            DeliveryProjectNodeScheduleChangeItem(
                field=str(item.get("field") or ""),
                before=item.get("before"),
                after=item.get("after"),
            )
            for item in raw_changes
            if isinstance(item, dict)
        ]
        return DeliveryProjectNodeScheduleRevisionResponse(
            id=row.id,
            project_id=row.project_id,
            node_id=row.node_id,
            edit_reason=row.edit_reason,
            changes=changes,
            edited_by_id=row.edited_by_id,
            edited_by_name=row.edited_by_name,
            edited_at=row.edited_at,
        )

    async def list_node_schedule_revisions(
        self,
        tenant_id: int,
        project_id: int,
        node_id: int,
    ) -> List[DeliveryProjectNodeScheduleRevisionResponse]:
        await self._get_or_404(tenant_id, project_id)
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {node_id}")
        rows = await DeliveryProjectNodeScheduleRevision.filter(
            tenant_id=tenant_id, project_id=project_id, node_id=node_id
        ).order_by("-edited_at", "-id")
        return [self._to_node_schedule_revision_response(row) for row in rows]

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
        changes = await self._collect_node_schedule_changes(tenant_id, node, body)
        if changes:
            edit_reason = (body.edit_reason or "").strip()
            if not edit_reason:
                raise ValidationError("请填写编辑原因")
        if node.status == DeliveryNodeStatus.COMPLETED.value:
            if any(
                v is not None
                for v in (
                    body.planned_start_date,
                    body.planned_end_date,
                    body.actual_start_date,
                    body.actual_end_date,
                )
            ):
                raise ValidationError("已完成节点不可修改计划或实际日期")
        if body.owner_id is not None:
            if body.owner_id:
                owner_id, owner_name = await self._resolve_owner(tenant_id, body.owner_id)
                node.owner_id = owner_id
                node.owner_name = owner_name
            else:
                node.owner_id = None
                node.owner_name = None
        planned_start = body.planned_start_date if body.planned_start_date is not None else node.planned_start_date
        planned_end = body.planned_end_date if body.planned_end_date is not None else node.planned_end_date
        if body.planned_start_date is not None or body.planned_end_date is not None:
            self._validate_date_range(planned_start, planned_end, label="节点计划")
            node.planned_start_date = body.planned_start_date
            node.planned_end_date = body.planned_end_date
        if body.actual_start_date is not None:
            node.actual_start_date = body.actual_start_date
        if body.actual_end_date is not None:
            node.actual_end_date = body.actual_end_date
        if body.actual_start_date is not None or body.actual_end_date is not None:
            self._validate_date_range(node.actual_start_date, node.actual_end_date, label="节点实际")
        await node.save()
        if changes:
            await DeliveryProjectNodeScheduleRevision.create(
                tenant_id=tenant_id,
                project_id=project_id,
                node_id=node.id,
                edit_reason=(body.edit_reason or "").strip(),
                changes_json=changes,
                edited_by_id=current_user.id,
                edited_by_name=operator_name_from_user(current_user),
                edited_at=resolve_business_datetime(),
            )
        apply_update_audit(row, current_user)
        await row.save()
        nodes = await self._load_nodes(tenant_id, project_id)
        await self._refresh_node_overdue(tenant_id, nodes)
        await self._sync_project_progress(row, nodes)
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

    async def start_project_node(
        self,
        tenant_id: int,
        project_id: int,
        node_id: int,
        current_user: User,
    ) -> DeliveryProjectNodeResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status not in (
            DeliveryProjectStatus.IN_PROGRESS.value,
            DeliveryProjectStatus.PAUSED.value,
        ):
            raise ValidationError("仅进行中或暂停的项目可开始节点")
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {node_id}")
        if node.status == DeliveryNodeStatus.COMPLETED.value:
            raise ValidationError("节点已完成")
        node.status = DeliveryNodeStatus.IN_PROGRESS.value
        if not node.actual_start_date:
            node.actual_start_date = to_site_date(resolve_business_datetime())
        await node.save()
        apply_update_audit(row, current_user)
        nodes = await self._load_nodes(tenant_id, project_id)
        await self._sync_project_progress(row, nodes)
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

    async def complete_project_node(
        self,
        tenant_id: int,
        project_id: int,
        node_id: int,
        current_user: User,
    ) -> DeliveryProjectNodeResponse:
        row = await self._get_or_404(tenant_id, project_id)
        if row.status not in (
            DeliveryProjectStatus.IN_PROGRESS.value,
            DeliveryProjectStatus.PAUSED.value,
        ):
            raise ValidationError("仅进行中或暂停的项目可完成节点")
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {node_id}")
        if node.status == DeliveryNodeStatus.COMPLETED.value:
            raise ValidationError("节点已完成")
        await self._assert_node_complete_gate(tenant_id, project_id, node)
        if not node.is_milestone:
            has_approved = await DeliveryNodeReport.filter(
                tenant_id=tenant_id,
                project_id=project_id,
                node_id=node.id,
                status="approved",
                deleted_at__isnull=True,
            ).exists()
            if not has_approved:
                tasks = await DeliveryProjectNodeTask.filter(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    node_id=node.id,
                    deleted_at__isnull=True,
                )
                open_tasks = [
                    t
                    for t in tasks
                    if t.status != DeliveryNodeTaskStatus.CANCELLED.value
                    and t.status != DeliveryNodeTaskStatus.DONE.value
                ]
                if open_tasks:
                    raise ValidationError(
                        "完成节点前，该节点下未取消的子任务须全部完成，或存在已通过的节点汇报"
                    )
        node.status = DeliveryNodeStatus.COMPLETED.value
        node.progress_percent = Decimal("100")
        if not node.actual_end_date:
            node.actual_end_date = to_site_date(resolve_business_datetime())
        if not node.actual_start_date:
            node.actual_start_date = to_site_date(resolve_business_datetime())
        await node.save()
        apply_update_audit(row, current_user)
        nodes = await self._load_nodes(tenant_id, project_id)
        await self._sync_project_progress(row, nodes)
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
        planned_start = body.planned_start_date or node.planned_start_date
        planned_end = body.planned_end_date or node.planned_end_date
        self._validate_task_planned_dates_against_node(node, planned_start, planned_end)
        members_json = await self._serialize_task_members(
            tenant_id, body.members or [], owner_id=owner_id
        )
        participant_mode = self._normalize_participant_mode(body.participant_mode)
        track_mode = self._normalize_track_mode(body.track_mode)
        participant_actions_json = self._build_participant_actions(
            owner_id=owner_id,
            owner_name=owner_name,
            members=members_json,
            participant_mode=participant_mode,
            track_mode=track_mode,
        )
        task = await DeliveryProjectNodeTask.create(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            task_name=body.task_name.strip(),
            core_task=(body.core_task or "").strip() or None,
            sort_order=body.sort_order,
            status=DeliveryNodeTaskStatus.TODO.value,
            owner_id=owner_id,
            owner_name=owner_name,
            members_json=members_json,
            planned_start_date=planned_start,
            planned_end_date=planned_end,
            progress_percent=Decimal("0"),
            track_mode=track_mode,
            kit_status=self._normalize_kit_status(body.kit_status),
            participant_mode=participant_mode,
            participant_actions_json=participant_actions_json or None,
            attachments=body.attachments,
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
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=task.node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {task.node_id}")
        participant_mode = self._normalize_participant_mode(
            body.participant_mode
            if body.participant_mode is not None
            else getattr(task, "participant_mode", None)
        )
        if body.task_name is not None:
            task.task_name = body.task_name.strip()
        if body.core_task is not None:
            task.core_task = (body.core_task or "").strip() or None
        if body.sort_order is not None:
            task.sort_order = body.sort_order
        if body.status is not None:
            if (
                self._requires_participant_actions(participant_mode)
                and body.status == DeliveryNodeTaskStatus.DONE.value
            ):
                raise ValidationError("协作型任务须由关联人员分别确认，不可直接标记完成")
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
        if body.participant_mode is not None:
            task.participant_mode = participant_mode
        track_mode = (
            self._normalize_track_mode(body.track_mode)
            if body.track_mode is not None
            else self._normalize_track_mode(getattr(task, "track_mode", None))
        )
        if (
            body.participant_mode is not None
            or body.owner_id is not None
            or body.members is not None
            or body.track_mode is not None
        ):
            task.participant_actions_json = self._build_participant_actions(
                owner_id=task.owner_id,
                owner_name=task.owner_name,
                members=task.members_json if isinstance(task.members_json, list) else [],
                participant_mode=participant_mode,
                track_mode=track_mode,
                existing=self._parse_participant_actions(task.participant_actions_json),
            ) or None
            if not self._requires_participant_actions(participant_mode):
                task.participant_actions_json = None
        if body.planned_start_date is not None:
            task.planned_start_date = body.planned_start_date
        if body.planned_end_date is not None:
            task.planned_end_date = body.planned_end_date
        if body.planned_start_date is not None or body.planned_end_date is not None:
            self._validate_task_planned_dates_against_node(
                node, task.planned_start_date, task.planned_end_date
            )
        if body.actual_start_date is not None:
            task.actual_start_date = body.actual_start_date
        if body.actual_end_date is not None:
            task.actual_end_date = body.actual_end_date
        if body.actual_start_date is not None or body.actual_end_date is not None:
            self._validate_date_range(task.actual_start_date, task.actual_end_date, label="任务实际")
        if body.progress_percent is not None:
            task.progress_percent = body.progress_percent
        if body.track_mode is not None:
            task.track_mode = self._normalize_track_mode(body.track_mode)
        if body.kit_status is not None:
            if self._requires_participant_actions(participant_mode):
                raise ValidationError("协作型任务齐套须由关联人员分别操作")
            task.kit_status = self._normalize_kit_status(body.kit_status)
            if task.kit_status == DeliveryTaskKitStatus.READY.value:
                task.status = DeliveryNodeTaskStatus.DONE.value
                task.progress_percent = Decimal("100")
                if not task.actual_end_date:
                    task.actual_end_date = to_site_date(resolve_business_datetime())
            elif task.track_mode == DeliveryTaskTrackMode.KIT.value and task.kit_status in (
                DeliveryTaskKitStatus.NONE.value,
                DeliveryTaskKitStatus.NA.value,
            ):
                if task.status == DeliveryNodeTaskStatus.DONE.value:
                    task.status = DeliveryNodeTaskStatus.TODO.value
                    task.progress_percent = Decimal("0")
        if body.attachments is not None:
            task.attachments = body.attachments
        apply_update_audit(task, current_user)
        await task.save()
        await self._maybe_sync_node_progress_from_tasks(tenant_id, project_id, task.node_id)
        return self._to_node_task_response(task)

    async def submit_node_task_participant_action(
        self,
        tenant_id: int,
        project_id: int,
        task_id: int,
        body: DeliveryTaskParticipantActionSubmit,
        current_user: User,
    ) -> DeliveryProjectNodeTaskResponse:
        await self._get_or_404(tenant_id, project_id)
        task = await DeliveryProjectNodeTask.get_or_none(
            tenant_id=tenant_id, id=task_id, project_id=project_id, deleted_at__isnull=True
        )
        if not task:
            raise NotFoundError(f"节点任务不存在: {task_id}")
        participant_mode = self._normalize_participant_mode(getattr(task, "participant_mode", None))
        if not self._requires_participant_actions(participant_mode):
            raise ValidationError("该任务为负责人模式，无需关联人员确认")
        actions = self._parse_participant_actions(task.participant_actions_json)
        if not actions:
            raise ValidationError("任务未配置关联人员操作")
        actor_id = int(current_user.id)
        target = next((item for item in actions if int(item["user_id"]) == actor_id), None)
        if not target:
            raise ValidationError("您不是该任务的关联人员，无法操作")
        if target.get("status") == DeliveryTaskParticipantActionStatus.DONE.value:
            raise ValidationError("您已确认过该任务")
        action_type = str(target.get("action") or "signoff")
        if action_type == "signoff":
            target["status"] = DeliveryTaskParticipantActionStatus.DONE.value
            target["acted_at"] = to_api_isoformat(resolve_business_datetime())
            if body.remark is not None:
                target["remark"] = body.remark.strip() or None
        elif action_type == "kit":
            if body.kit_status is None:
                raise ValidationError("请提交齐套状态")
            kit_status = self._normalize_kit_status(body.kit_status)
            target["status"] = DeliveryTaskParticipantActionStatus.DONE.value
            target["kit_status"] = kit_status
            target["acted_at"] = to_api_isoformat(resolve_business_datetime())
            if body.remark is not None:
                target["remark"] = body.remark.strip() or None
        else:
            if body.progress_percent is None:
                raise ValidationError("请提交进度")
            progress = Decimal(str(body.progress_percent))
            if progress < 0 or progress > 100:
                raise ValidationError("进度须在 0～100 之间")
            target["status"] = DeliveryTaskParticipantActionStatus.DONE.value
            target["progress_percent"] = progress
            target["acted_at"] = to_api_isoformat(resolve_business_datetime())
            if body.remark is not None:
                target["remark"] = body.remark.strip() or None
        task.participant_actions_json = actions
        self._apply_participant_completion(task)
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

    @staticmethod
    def _node_doc_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return to_site_date(value)
        return None

    @staticmethod
    def _clamp_node_doc_progress_percent(value: float) -> float:
        if value < 0:
            return 0.0
        if value > 100:
            return 100.0
        return round(value, 1)

    @staticmethod
    def _node_doc_progress_from_status(status: Optional[str]) -> Optional[float]:
        normalized = (status or "").strip()
        if not normalized:
            return None
        completed = {
            "已入库",
            "已出库",
            "已完成",
            "completed",
            "COMPLETED",
            "DONE",
            "done",
        }
        zero = {
            "草稿",
            "draft",
            "DRAFT",
            "待入库",
            "待出库",
            "待检验",
            "CANCELLED",
            "cancelled",
            "已取消",
        }
        if normalized in completed:
            return 100.0
        if normalized in zero:
            return 0.0
        return None

    @staticmethod
    def _node_doc_summary(
        *,
        party_name: Optional[str] = None,
        doc_date: Any = None,
        status: Optional[str] = None,
        review_status: Optional[str] = None,
        progress_percent: Optional[float] = None,
    ) -> Dict[str, Any]:
        return {
            "party_name": (party_name or "").strip() or None,
            "doc_date": DeliveryProjectService._node_doc_date(doc_date),
            "status": (status or "").strip() or None,
            "review_status": (review_status or "").strip() or None,
            "progress_percent": progress_percent,
        }

    async def _load_node_document_summaries(
        self,
        tenant_id: int,
        rows: List[DeliveryProjectNodeDocument],
    ) -> Dict[Tuple[str, int], Dict[str, Any]]:
        if not rows:
            return {}
        by_type: Dict[str, List[int]] = {}
        for row in rows:
            by_type.setdefault(row.doc_type, []).append(row.doc_id)
        summaries: Dict[Tuple[str, int], Dict[str, Any]] = {}

        async def _store(doc_type: str, doc_id: int, payload: Dict[str, Any]) -> None:
            summaries[(doc_type, doc_id)] = payload

        if ids := by_type.get("sales_order"):
            from apps.kuaizhizao.services.sales_order_service import SalesOrderService

            orders = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            )
            items_by_order: Dict[int, List[SalesOrderItem]] = {}
            if orders:
                order_ids = [int(o.id) for o in orders if o.id is not None]
                item_rows = await SalesOrderItem.filter(
                    tenant_id=tenant_id, sales_order_id__in=order_ids
                ).all()
                for item in item_rows:
                    items_by_order.setdefault(int(item.sales_order_id), []).append(item)
            sales_order_service = SalesOrderService()
            shipped_by_order = await sales_order_service._shipped_qty_by_sales_order(
                tenant_id, [int(o.id) for o in orders if o.id is not None]
            )
            for order in orders:
                ship_q = shipped_by_order.get(order.id, Decimal("0"))
                items = items_by_order.get(int(order.id), [])
                delivery_progress = sales_order_service._merged_delivery_progress(
                    order, items, ship_q
                )
                await _store(
                    "sales_order",
                    order.id,
                    self._node_doc_summary(
                        party_name=order.customer_name,
                        doc_date=order.order_date,
                        status=order.status,
                        review_status=order.review_status,
                        progress_percent=self._clamp_node_doc_progress_percent(delivery_progress),
                    ),
                )

        if ids := by_type.get("purchase_order"):
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder
            from apps.kuaizhizao.services.purchase_service import PurchaseService

            orders = await PurchaseOrder.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            )
            receipt_totals = await PurchaseService()._batch_order_receipt_totals(
                tenant_id, ids
            )
            for order in orders:
                totals = receipt_totals.get(order.id, {})
                ordered_total = Decimal(str(totals.get("ordered_total") or 0))
                received_total = Decimal(str(totals.get("received_total") or 0))
                receipt_progress = (
                    self._clamp_node_doc_progress_percent(
                        float((received_total / ordered_total) * Decimal("100"))
                    )
                    if ordered_total > 0
                    else 0.0
                )
                await _store(
                    "purchase_order",
                    order.id,
                    self._node_doc_summary(
                        party_name=order.supplier_name,
                        doc_date=order.order_date,
                        status=order.status,
                        review_status=order.review_status,
                        progress_percent=receipt_progress,
                    ),
                )

        if ids := by_type.get("work_order"):
            from apps.kuaizhizao.models.work_order import WorkOrder
            from apps.kuaizhizao.services.work_order_service import WorkOrderService

            orders = await WorkOrder.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            )
            completion_by_wo = await WorkOrderService()._batch_work_order_downstream_push_progress(
                tenant_id, orders
            )
            for order in orders:
                completion = completion_by_wo.get(int(order.id), 0.0)
                await _store(
                    "work_order",
                    order.id,
                    self._node_doc_summary(
                        party_name=order.product_name or order.name,
                        doc_date=order.planned_start_date,
                        status=order.status,
                        progress_percent=self._clamp_node_doc_progress_percent(completion),
                    ),
                )

        if ids := by_type.get("purchase_receipt"):
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

            for receipt in await PurchaseReceipt.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            ):
                progress = self._node_doc_progress_from_status(receipt.status)
                await _store(
                    "purchase_receipt",
                    receipt.id,
                    self._node_doc_summary(
                        party_name=receipt.supplier_name,
                        doc_date=receipt.receipt_time or receipt.created_at,
                        status=receipt.status,
                        review_status=receipt.review_status,
                        progress_percent=progress,
                    ),
                )

        if ids := by_type.get("sales_delivery"):
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            for delivery in await SalesDelivery.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            ):
                progress = self._node_doc_progress_from_status(delivery.status)
                await _store(
                    "sales_delivery",
                    delivery.id,
                    self._node_doc_summary(
                        party_name=delivery.customer_name,
                        doc_date=delivery.delivery_time or delivery.created_at,
                        status=delivery.status,
                        review_status=delivery.review_status,
                        progress_percent=progress,
                    ),
                )

        if ids := by_type.get("rd_project"):
            from apps.kuaiplm.constants.rd_project import RdProjectStatus, RdTaskStatus
            from apps.kuaiplm.models.rd_project import RdProject, RdProjectTask

            projects = await RdProject.filter(
                tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
            )
            task_rows = await RdProjectTask.filter(
                tenant_id=tenant_id, project_id__in=ids, deleted_at__isnull=True
            ).values("project_id", "status")
            task_totals: Dict[int, Dict[str, int]] = {}
            for row in task_rows:
                pid = int(row["project_id"])
                bucket = task_totals.setdefault(pid, {"total": 0, "done": 0})
                bucket["total"] += 1
                if str(row.get("status") or "") == RdTaskStatus.DONE.value:
                    bucket["done"] += 1
            for project in projects:
                totals = task_totals.get(int(project.id), {"total": 0, "done": 0})
                if totals["total"] > 0:
                    progress = self._clamp_node_doc_progress_percent(
                        (totals["done"] / totals["total"]) * 100.0
                    )
                elif str(project.status or "") == RdProjectStatus.COMPLETED.value:
                    progress = 100.0
                elif str(project.status or "") in {
                    RdProjectStatus.DRAFT.value,
                    RdProjectStatus.CANCELLED.value,
                }:
                    progress = 0.0
                else:
                    progress = None
                await _store(
                    "rd_project",
                    project.id,
                    self._node_doc_summary(
                        party_name=project.project_name,
                        doc_date=project.planned_start_date,
                        status=project.status,
                        progress_percent=progress,
                    ),
                )

        if ids := by_type.get("quality_inspection"):
            from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
            from apps.kuaizhizao.models.oqc_inspection import OQCInspection
            from apps.kuaizhizao.models.process_inspection import ProcessInspection

            inspection_models = (
                IncomingInspection,
                ProcessInspection,
                FinishedGoodsInspection,
                OQCInspection,
            )
            for model in inspection_models:
                found = await model.filter(tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True)
                for row in found:
                    party = getattr(row, "supplier_name", None) or getattr(row, "customer_name", None)
                    party = party or getattr(row, "material_name", None)
                    doc_dt = getattr(row, "inspection_time", None) or getattr(row, "created_at", None)
                    status = getattr(row, "status", None)
                    progress = self._node_doc_progress_from_status(status)
                    await _store(
                        "quality_inspection",
                        row.id,
                        self._node_doc_summary(
                            party_name=party,
                            doc_date=doc_dt,
                            status=status,
                            review_status=getattr(row, "review_status", None),
                            progress_percent=progress,
                        ),
                    )

        return summaries

    def _to_node_document_response(
        self,
        row: DeliveryProjectNodeDocument,
        *,
        node_name: Optional[str],
        summary: Optional[Dict[str, Any]] = None,
    ) -> DeliveryProjectNodeDocumentResponse:
        snap = summary or {}
        return DeliveryProjectNodeDocumentResponse(
            id=row.id,
            project_id=row.project_id,
            node_id=row.node_id,
            node_name=node_name,
            doc_type=row.doc_type,
            doc_id=row.doc_id,
            doc_code=row.doc_code,
            title=row.title,
            party_name=snap.get("party_name"),
            doc_date=snap.get("doc_date"),
            status=snap.get("status"),
            review_status=snap.get("review_status"),
            progress_percent=snap.get("progress_percent"),
            linked_at=row.linked_at,
            linked_by_name=row.linked_by_name,
        )

    async def list_node_documents(
        self, tenant_id: int, project_id: int, *, node_id: Optional[int] = None
    ) -> List[DeliveryProjectNodeDocumentResponse]:
        await self._get_or_404(tenant_id, project_id)
        query = DeliveryProjectNodeDocument.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            deleted_at__isnull=True,
        )
        if node_id is not None:
            query = query.filter(node_id=node_id)
        rows = await query.order_by("-linked_at", "-id")
        node_name_map: Dict[int, str] = {}
        if rows:
            node_ids = {r.node_id for r in rows}
            nodes = await DeliveryProjectNode.filter(
                tenant_id=tenant_id, project_id=project_id, id__in=list(node_ids)
            )
            node_name_map = {n.id: n.node_name for n in nodes}
        summaries = await self._load_node_document_summaries(tenant_id, rows)
        return [
            self._to_node_document_response(
                r,
                node_name=node_name_map.get(r.node_id),
                summary=summaries.get((r.doc_type, r.doc_id)),
            )
            for r in rows
        ]

    async def link_node_document(
        self,
        tenant_id: int,
        project_id: int,
        body: DeliveryProjectNodeDocumentCreate,
        current_user: User,
    ) -> DeliveryProjectNodeDocumentResponse:
        row = await self._get_or_404(tenant_id, project_id)
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=body.node_id, project_id=project_id
        )
        if not node:
            raise NotFoundError(f"节点不存在: {body.node_id}")
        doc_type = (body.doc_type or "").strip().lower()
        if doc_type not in DELIVERY_NODE_DOCUMENT_TYPES:
            raise ValidationError(f"不支持的单据类型: {body.doc_type}")
        doc_code = body.doc_code.strip()
        if not doc_code:
            raise ValidationError("单据编码不能为空")
        existing = await DeliveryProjectNodeDocument.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            doc_type=doc_type,
            doc_id=body.doc_id,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError("该单据已关联到此节点")
        operator_name = operator_name_from_user(current_user)
        linked = await DeliveryProjectNodeDocument.create(
            tenant_id=tenant_id,
            project_id=project_id,
            node_id=node.id,
            doc_type=doc_type,
            doc_id=body.doc_id,
            doc_code=doc_code,
            title=(body.title or doc_code).strip() or doc_code,
            linked_at=resolve_business_datetime(),
            linked_by=current_user.id,
            linked_by_name=operator_name,
        )
        apply_update_audit(row, current_user)
        await row.save()
        summaries = await self._load_node_document_summaries(tenant_id, [linked])
        return self._to_node_document_response(
            linked,
            node_name=node.node_name,
            summary=summaries.get((linked.doc_type, linked.doc_id)),
        )

    async def unlink_node_document(
        self,
        tenant_id: int,
        project_id: int,
        link_id: int,
        current_user: User,
    ) -> None:
        row = await self._get_or_404(tenant_id, project_id)
        linked = await DeliveryProjectNodeDocument.get_or_none(
            tenant_id=tenant_id,
            id=link_id,
            project_id=project_id,
            deleted_at__isnull=True,
        )
        if not linked:
            raise NotFoundError(f"关联单据不存在: {link_id}")
        linked.deleted_at = resolve_business_datetime()
        apply_update_audit(linked, current_user)
        await linked.save()
        apply_update_audit(row, current_user)
        await row.save()

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
                "quantity": str(it.order_quantity),
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
        # create_project 在绑定流程模板时已启动首节点；勿再 start 导致「当前状态不可启动」
        # 却已落库，二次下推才报「已存在交付项目」。
        if project.status == DeliveryProjectStatus.DRAFT.value:
            return await self.start_project(tenant_id, project.id, current_user)
        return await self.get_project(tenant_id, project.id)

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
        alerts = await self._alert_service.compute_alerts(tenant_id, limit=20)
        try:
            await self._alert_service.scan_and_notify(tenant_id)
        except Exception as exc:
            from loguru import logger

            logger.error("交付项目预警扫描失败 tenant={}: {}", tenant_id, exc)
        return DeliveryDashboardResponse(
            kpis=DeliveryDashboardKpi(
                active_projects=active_projects,
                overdue_nodes=overdue_nodes,
                at_risk_projects=at_risk,
                open_issues=open_issues,
                alert_count=len(alerts),
            ),
            recent_projects=[await self._to_list_item(r) for r in recent],
            overdue_nodes=overdue_payload,
            alerts=alerts,
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

    async def _resolve_workshop_board_columns(
        self,
        tenant_id: int,
        process_template_id: Optional[int],
    ) -> List[DeliveryWorkshopBoardColumn]:
        template: Optional[DeliveryProcessTemplate] = None
        if process_template_id:
            template = await DeliveryProcessTemplate.get_or_none(
                tenant_id=tenant_id, id=process_template_id, deleted_at__isnull=True
            )
            if not template:
                raise NotFoundError(f"流程模板不存在: {process_template_id}")
        if template is None:
            template = await DeliveryProcessTemplate.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, is_default=True, is_active=True
            ).first()
        if template is None:
            template = await DeliveryProcessTemplate.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
            ).order_by("id").first()
        if template is None:
            return []
        nodes = await DeliveryProcessTemplateNode.filter(
            tenant_id=tenant_id, template_id=template.id
        ).order_by("sort_order", "id")
        node_ids = [n.id for n in nodes]
        tasks = await DeliveryProcessTemplateNodeTask.filter(
            tenant_id=tenant_id, template_node_id__in=node_ids
        ).order_by("sort_order", "id") if node_ids else []
        tasks_by_node: Dict[int, List[DeliveryProcessTemplateNodeTask]] = {}
        for task in tasks:
            tasks_by_node.setdefault(task.template_node_id, []).append(task)
        columns: List[DeliveryWorkshopBoardColumn] = []
        col_order = 0
        for node in nodes:
            for task in tasks_by_node.get(node.id, []):
                col_order += 1
                columns.append(
                    DeliveryWorkshopBoardColumn(
                        task_key=task.task_key,
                        task_name=task.task_name,
                        node_key=node.node_key,
                        node_name=node.node_name,
                        track_mode=getattr(task, "track_mode", None)
                        or DeliveryTaskTrackMode.PROGRESS.value,
                        sort_order=col_order,
                    )
                )
        return columns

    async def list_workshop_board(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        board_section: Optional[str] = None,
        status: Optional[str] = None,
        process_template_id: Optional[int] = None,
    ) -> DeliveryWorkshopBoardEnvelope:
        columns = await self._resolve_workshop_board_columns(tenant_id, process_template_id)
        qs = DeliveryProject.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            qs = qs.filter(
                Q(project_code__icontains=kw)
                | Q(project_name__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(material_code__icontains=kw)
                | Q(material_name__icontains=kw)
            )
        if board_section:
            qs = qs.filter(board_section=self._normalize_board_section(board_section))
        if status:
            qs = qs.filter(status=status)
        if process_template_id:
            qs = qs.filter(process_template_id=process_template_id)
        total = await qs.count()
        rows = await qs.order_by("-updated_at", "-id").offset(skip).limit(limit)
        project_ids = [r.id for r in rows]
        tasks = await DeliveryProjectNodeTask.filter(
            tenant_id=tenant_id, project_id__in=project_ids, deleted_at__isnull=True
        ).order_by("sort_order", "id") if project_ids else []
        nodes = await DeliveryProjectNode.filter(
            tenant_id=tenant_id, project_id__in=project_ids
        ).all() if project_ids else []
        node_map = {n.id: n for n in nodes}
        tasks_by_project: Dict[int, List[DeliveryProjectNodeTask]] = {}
        for task in tasks:
            tasks_by_project.setdefault(task.project_id, []).append(task)

        items: List[DeliveryWorkshopBoardRow] = []
        for row in rows:
            project_tasks = tasks_by_project.get(row.id, [])
            by_key = {
                (t.task_key or f"id:{t.id}"): t for t in project_tasks if t.task_key or t.id
            }
            cells: List[DeliveryWorkshopBoardCell] = []
            if columns:
                for col in columns:
                    task = by_key.get(col.task_key)
                    if task:
                        cells.append(
                            DeliveryWorkshopBoardCell(
                                task_id=task.id,
                                task_key=col.task_key,
                                node_key=col.node_key,
                                track_mode=getattr(task, "track_mode", None) or col.track_mode,
                                kit_status=getattr(task, "kit_status", None)
                                or DeliveryTaskKitStatus.NONE.value,
                                status=task.status,
                                actual_end_date=task.actual_end_date,
                                owner_name=task.owner_name,
                            )
                        )
                    else:
                        cells.append(
                            DeliveryWorkshopBoardCell(
                                task_id=None,
                                task_key=col.task_key,
                                node_key=col.node_key,
                                track_mode=col.track_mode,
                                kit_status=DeliveryTaskKitStatus.NONE.value,
                            )
                        )
            else:
                for task in project_tasks:
                    node = node_map.get(task.node_id)
                    cells.append(
                        DeliveryWorkshopBoardCell(
                            task_id=task.id,
                            task_key=task.task_key or f"task_{task.id}",
                            node_key=node.node_key if node else "",
                            track_mode=getattr(task, "track_mode", None)
                            or DeliveryTaskTrackMode.PROGRESS.value,
                            kit_status=getattr(task, "kit_status", None)
                            or DeliveryTaskKitStatus.NONE.value,
                            status=task.status,
                            actual_end_date=task.actual_end_date,
                            owner_name=task.owner_name,
                        )
                    )
            items.append(
                DeliveryWorkshopBoardRow(
                    project_id=row.id,
                    project_code=row.project_code,
                    project_name=row.project_name,
                    customer_name=row.customer_name,
                    material_code=row.material_code,
                    material_name=row.material_name,
                    material_spec=row.material_spec,
                    delivery_date=row.delivery_date,
                    owner_name=row.owner_name,
                    status=row.status,
                    progress_percent=row.progress_percent or Decimal("0"),
                    board_section=getattr(row, "board_section", None)
                    or DeliveryBoardSection.ACTIVE.value,
                    config_attrs=self._normalize_config_attrs(getattr(row, "config_attrs", None)),
                    cells=cells,
                )
            )
        return DeliveryWorkshopBoardEnvelope(columns=columns, items=items, total=total)

    async def patch_workshop_board_cell(
        self,
        tenant_id: int,
        body: DeliveryWorkshopBoardCellPatch,
        current_user: User,
    ) -> DeliveryWorkshopBoardCell:
        await self._get_or_404(tenant_id, body.project_id)
        task = await DeliveryProjectNodeTask.get_or_none(
            tenant_id=tenant_id,
            id=body.task_id,
            project_id=body.project_id,
            deleted_at__isnull=True,
        )
        if not task:
            raise NotFoundError(f"节点任务不存在: {body.task_id}")
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=task.node_id, project_id=body.project_id
        )
        update = DeliveryProjectNodeTaskUpdate(
            kit_status=body.kit_status,
            actual_end_date=body.actual_end_date,
            status=body.status,
        )
        updated = await self.update_node_task(
            tenant_id, body.project_id, body.task_id, update, current_user
        )
        return DeliveryWorkshopBoardCell(
            task_id=updated.id,
            task_key=updated.task_key or f"task_{updated.id}",
            node_key=node.node_key if node else "",
            track_mode=updated.track_mode,
            kit_status=updated.kit_status,
            status=updated.status,
            actual_end_date=updated.actual_end_date,
            owner_name=updated.owner_name,
        )
