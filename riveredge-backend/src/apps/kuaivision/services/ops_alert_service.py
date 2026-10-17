"""边缘节点磁盘 / 缓冲积压运维告警。"""

from __future__ import annotations

from datetime import timedelta

from apps.kuaivision.models.vision import VisionAgent
from apps.kuaivision.services.settings_service import SettingsService
from core.utils.timezone_utils import resolve_business_datetime


class OpsAlertService:
    COOLDOWN = timedelta(minutes=30)

    @staticmethod
    async def maybe_alert_on_heartbeat(agent: VisionAgent) -> None:
        settings = await SettingsService.get(agent.tenant_id)
        reasons: list[str] = []
        buffer_n = int(getattr(agent, "buffer_pending_count", 0) or 0)
        if buffer_n >= int(settings.buffer_alert_threshold or 50):
            reasons.append(f"本地缓冲积压 {buffer_n} 条")
        disk = getattr(agent, "disk_free_mb", None)
        if disk is not None and int(disk) < int(settings.disk_alert_mb or 1024):
            reasons.append(f"磁盘剩余 {disk} MB")
        if not reasons:
            return

        now = resolve_business_datetime()
        last = getattr(agent, "last_ops_alert_at", None)
        if last is not None and now - last < OpsAlertService.COOLDOWN:
            return

        message = "；".join(reasons)
        agent.last_ops_alert_at = now
        agent.last_error = message
        await agent.save(update_fields=["last_ops_alert_at", "last_error", "updated_at"])

        try:
            from core.services.business.business_notification_service import BusinessNotificationService

            await BusinessNotificationService.dispatch(
                agent.tenant_id,
                trigger_document="vision_agent",
                trigger_action="ops_alert",
                variables={
                    "agent_code": agent.code,
                    "agent_name": agent.name,
                    "message": message,
                    "buffer_pending_count": str(buffer_n),
                    "disk_free_mb": str(disk if disk is not None else ""),
                },
            )
        except Exception:
            return
