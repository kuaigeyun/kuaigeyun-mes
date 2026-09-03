"""交付项目节点临期/逾期预警（站内信 + 去重）"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple

from loguru import logger

from apps.kuaizhizao.constants.delivery_project import (
    DELIVERY_ALERT_KIND_DUE_SOON,
    DELIVERY_ALERT_KIND_MILESTONE_OVERDUE,
    DELIVERY_ALERT_KIND_OVERDUE,
    DELIVERY_NODE_DUE_SOON_DAYS,
    DeliveryNodeStatus,
    DeliveryProjectStatus,
)
from apps.kuaizhizao.models.delivery_project import (
    DeliveryProject,
    DeliveryProjectNode,
    DeliveryProjectNodeAlertSent,
)
from apps.kuaizhizao.schemas.delivery_project import DeliveryAlertRow
from apps.kuaizhizao.services.kuaizhizao_business_notification import (
    notify_delivery_node_due_soon,
    notify_delivery_node_milestone_overdue,
    notify_delivery_node_overdue,
)
from core.services.business.business_notification_service import register_notification_scope_resolver
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


def ensure_delivery_alert_scope_resolvers() -> None:
    async def _scope_node_owner(_tenant_id: int, context: Dict) -> List[int]:
        raw = context.get("node_owner_user_id")
        if raw is None:
            return []
        try:
            uid = int(raw)
        except (TypeError, ValueError):
            return []
        return [uid] if uid > 0 else []

    async def _scope_project_owner(_tenant_id: int, context: Dict) -> List[int]:
        raw = context.get("project_owner_user_id")
        if raw is None:
            return []
        try:
            uid = int(raw)
        except (TypeError, ValueError):
            return []
        return [uid] if uid > 0 else []

    register_notification_scope_resolver("node_owner", _scope_node_owner)
    register_notification_scope_resolver("project_owner", _scope_project_owner)


ensure_delivery_alert_scope_resolvers()


class DeliveryProjectAlertService:
    @staticmethod
    def _dedup_key(alert_kind: str, node_id: int, bucket: str) -> str:
        return f"{alert_kind}:{node_id}:{bucket}"

    @staticmethod
    def _bucket_for_due_soon(planned_end: date) -> str:
        return planned_end.isoformat()

    @staticmethod
    def _bucket_for_overdue(planned_end: date) -> str:
        return planned_end.isoformat()

    async def compute_alerts(
        self,
        tenant_id: int,
        *,
        project_statuses: Optional[List[str]] = None,
        limit: int = 50,
    ) -> List[DeliveryAlertRow]:
        active_statuses = project_statuses or [
            DeliveryProjectStatus.IN_PROGRESS.value,
            DeliveryProjectStatus.PAUSED.value,
        ]
        projects = await DeliveryProject.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=active_statuses,
        ).all()
        if not projects:
            return []
        project_map = {p.id: p for p in projects}
        project_ids = list(project_map.keys())
        nodes = await DeliveryProjectNode.filter(
            tenant_id=tenant_id,
            project_id__in=project_ids,
        ).order_by("planned_end_date", "id")
        today = to_site_date(resolve_business_datetime())
        due_soon_until = today + timedelta(days=DELIVERY_NODE_DUE_SOON_DAYS)
        rows: List[DeliveryAlertRow] = []
        for node in nodes:
            if node.status == DeliveryNodeStatus.COMPLETED.value:
                continue
            project = project_map.get(node.project_id)
            if not project:
                continue
            planned_end = node.planned_end_date
            if not planned_end:
                continue
            if planned_end < today:
                days_overdue = (today - planned_end).days
                kind = (
                    DELIVERY_ALERT_KIND_MILESTONE_OVERDUE
                    if node.is_milestone
                    else DELIVERY_ALERT_KIND_OVERDUE
                )
                rows.append(
                    DeliveryAlertRow(
                        alert_kind=kind,
                        project_id=project.id,
                        project_code=project.project_code,
                        project_name=project.project_name,
                        node_id=node.id,
                        node_name=node.node_name,
                        is_milestone=bool(node.is_milestone),
                        planned_end_date=planned_end,
                        days_overdue=days_overdue,
                        owner_name=node.owner_name,
                        project_owner_name=project.owner_name,
                    )
                )
            elif today <= planned_end <= due_soon_until:
                rows.append(
                    DeliveryAlertRow(
                        alert_kind=DELIVERY_ALERT_KIND_DUE_SOON,
                        project_id=project.id,
                        project_code=project.project_code,
                        project_name=project.project_name,
                        node_id=node.id,
                        node_name=node.node_name,
                        is_milestone=bool(node.is_milestone),
                        planned_end_date=planned_end,
                        days_remaining=(planned_end - today).days,
                        owner_name=node.owner_name,
                        project_owner_name=project.owner_name,
                    )
                )
        rows.sort(
            key=lambda r: (
                0 if r.alert_kind == DELIVERY_ALERT_KIND_MILESTONE_OVERDUE else 1,
                0 if r.alert_kind == DELIVERY_ALERT_KIND_OVERDUE else 1,
                r.planned_end_date or today,
            )
        )
        return rows[:limit]

    async def scan_and_notify(self, tenant_id: int) -> int:
        alerts = await self.compute_alerts(tenant_id, limit=200)
        if not alerts:
            return 0
        existing_keys: Set[str] = set(
            await DeliveryProjectNodeAlertSent.filter(tenant_id=tenant_id).values_list(
                "dedup_key", flat=True
            )
        )
        sent_count = 0
        now = resolve_business_datetime()
        for alert in alerts:
            if not alert.planned_end_date:
                continue
            if alert.alert_kind == DELIVERY_ALERT_KIND_DUE_SOON:
                bucket = self._bucket_for_due_soon(alert.planned_end_date)
                dedup = self._dedup_key(alert.alert_kind, alert.node_id, bucket)
                if dedup in existing_keys:
                    continue
                count = await notify_delivery_node_due_soon(
                    tenant_id,
                    project_id=alert.project_id,
                    project_code=alert.project_code,
                    project_name=alert.project_name,
                    node_id=alert.node_id,
                    node_name=alert.node_name,
                    planned_end_date=str(alert.planned_end_date),
                    days_remaining=alert.days_remaining or 0,
                    node_owner_user_id=await self._resolve_node_owner_id(tenant_id, alert.node_id),
                    project_owner_user_id=await self._resolve_project_owner_id(
                        tenant_id, alert.project_id
                    ),
                )
                if count > 0:
                    await DeliveryProjectNodeAlertSent.create(
                        tenant_id=tenant_id,
                        dedup_key=dedup,
                        sent_at=now,
                    )
                    existing_keys.add(dedup)
                    sent_count += count
            elif alert.alert_kind in (
                DELIVERY_ALERT_KIND_OVERDUE,
                DELIVERY_ALERT_KIND_MILESTONE_OVERDUE,
            ):
                bucket = self._bucket_for_overdue(alert.planned_end_date)
                dedup = self._dedup_key(alert.alert_kind, alert.node_id, bucket)
                if dedup in existing_keys:
                    continue
                node_owner_id = await self._resolve_node_owner_id(tenant_id, alert.node_id)
                project_owner_id = await self._resolve_project_owner_id(
                    tenant_id, alert.project_id
                )
                if alert.alert_kind == DELIVERY_ALERT_KIND_MILESTONE_OVERDUE:
                    count = await notify_delivery_node_milestone_overdue(
                        tenant_id,
                        project_id=alert.project_id,
                        project_code=alert.project_code,
                        project_name=alert.project_name,
                        node_id=alert.node_id,
                        node_name=alert.node_name,
                        planned_end_date=str(alert.planned_end_date),
                        days_overdue=alert.days_overdue or 0,
                        node_owner_user_id=node_owner_id,
                        project_owner_user_id=project_owner_id,
                    )
                else:
                    count = await notify_delivery_node_overdue(
                        tenant_id,
                        project_id=alert.project_id,
                        project_code=alert.project_code,
                        project_name=alert.project_name,
                        node_id=alert.node_id,
                        node_name=alert.node_name,
                        planned_end_date=str(alert.planned_end_date),
                        days_overdue=alert.days_overdue or 0,
                        node_owner_user_id=node_owner_id,
                        project_owner_user_id=project_owner_id,
                    )
                if count > 0:
                    await DeliveryProjectNodeAlertSent.create(
                        tenant_id=tenant_id,
                        dedup_key=dedup,
                        sent_at=now,
                    )
                    existing_keys.add(dedup)
                    sent_count += count
        return sent_count

    @staticmethod
    async def _resolve_node_owner_id(tenant_id: int, node_id: int) -> Optional[int]:
        node = await DeliveryProjectNode.get_or_none(tenant_id=tenant_id, id=node_id)
        return node.owner_id if node and node.owner_id else None

    @staticmethod
    async def _resolve_project_owner_id(tenant_id: int, project_id: int) -> Optional[int]:
        project = await DeliveryProject.get_or_none(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        )
        return project.owner_id if project and project.owner_id else None
