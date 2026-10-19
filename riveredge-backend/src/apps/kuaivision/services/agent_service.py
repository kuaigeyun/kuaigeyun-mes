"""边缘节点服务。"""

from __future__ import annotations

import secrets
from datetime import timedelta
from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaivision.models.vision import VisionAgent
from apps.kuaivision.schemas.vision import AgentCreate, AgentResponse, AgentUpdate
from apps.kuaivision.services.settings_service import SettingsService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class AgentService:
    @staticmethod
    async def _offline_timeout(tenant_id: int) -> int:
        settings = await SettingsService.get(tenant_id)
        return int(settings.offline_timeout_seconds or 60)

    @staticmethod
    async def _to_response(item: VisionAgent, offline_timeout: int) -> AgentResponse:
        online = False
        if item.last_heartbeat_at is not None:
            delta = resolve_business_datetime() - item.last_heartbeat_at
            online = delta <= timedelta(seconds=max(offline_timeout, 1))
        return AgentResponse(
            uuid=item.uuid,
            id=item.id,
            code=item.code,
            name=item.name,
            device_token=item.device_token,
            is_enabled=item.is_enabled,
            is_online=online,
            last_heartbeat_at=item.last_heartbeat_at,
            config_version=item.config_version,
            run_mode=getattr(item, "run_mode", None) or "local_pipeline",
            agent_version=getattr(item, "agent_version", None),
            last_error=getattr(item, "last_error", None),
            buffer_pending_count=int(getattr(item, "buffer_pending_count", 0) or 0),
            disk_free_mb=getattr(item, "disk_free_mb", None),
            remark=item.remark,
            created_by_name=item.created_by_name,
            updated_by_name=item.updated_by_name,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    async def list_agents(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
    ) -> Tuple[List[AgentResponse], int]:
        qs = VisionAgent.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))
        total = await qs.count()
        items = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        timeout = await AgentService._offline_timeout(tenant_id)
        return [await AgentService._to_response(i, timeout) for i in items], total

    @staticmethod
    async def get_by_uuid(tenant_id: int, uuid: str) -> VisionAgent:
        item = await VisionAgent.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not item:
            raise NotFoundError("边缘节点不存在")
        return item

    @staticmethod
    async def get_response(tenant_id: int, uuid: str) -> AgentResponse:
        item = await AgentService.get_by_uuid(tenant_id, uuid)
        timeout = await AgentService._offline_timeout(tenant_id)
        return await AgentService._to_response(item, timeout)

    @staticmethod
    async def get_by_token(device_token: str) -> VisionAgent:
        item = await VisionAgent.get_or_none(device_token=device_token, deleted_at__isnull=True)
        if not item or not item.is_enabled:
            raise ValidationError("无效或已停用的视觉节点 token")
        return item

    @staticmethod
    async def create(tenant_id: int, data: AgentCreate, user: Optional[User]) -> AgentResponse:
        exists = await VisionAgent.filter(tenant_id=tenant_id, code=data.code, deleted_at__isnull=True).exists()
        if exists:
            raise ValidationError(f"节点编码已存在：{data.code}")
        item = VisionAgent(
            tenant_id=tenant_id,
            code=data.code.strip(),
            name=data.name.strip(),
            remark=data.remark,
            is_enabled=data.is_enabled,
            run_mode=data.run_mode or "local_pipeline",
        )
        apply_create_audit(item, user)
        await item.save()
        return await AgentService.get_response(tenant_id, item.uuid)

    @staticmethod
    async def update(tenant_id: int, uuid: str, data: AgentUpdate, user: Optional[User]) -> AgentResponse:
        item = await AgentService.get_by_uuid(tenant_id, uuid)
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(item, key, value)
        apply_update_audit(item, user)
        await item.save()
        return await AgentService.get_response(tenant_id, item.uuid)

    @staticmethod
    async def rotate_token(tenant_id: int, uuid: str, user: Optional[User]) -> AgentResponse:
        item = await AgentService.get_by_uuid(tenant_id, uuid)
        item.device_token = secrets.token_urlsafe(32)
        apply_update_audit(item, user)
        await item.save()
        return await AgentService.get_response(tenant_id, item.uuid)

    @staticmethod
    async def bump_config(tenant_id: int, uuid: str, user: Optional[User]) -> AgentResponse:
        item = await AgentService.get_by_uuid(tenant_id, uuid)
        item.config_version = int(item.config_version or 1) + 1
        apply_update_audit(item, user)
        await item.save()
        return await AgentService.get_response(tenant_id, item.uuid)

    @staticmethod
    async def soft_delete(tenant_id: int, uuid: str, user: Optional[User]) -> None:
        item = await AgentService.get_by_uuid(tenant_id, uuid)
        item.deleted_at = resolve_business_datetime()
        apply_update_audit(item, user)
        await item.save()
