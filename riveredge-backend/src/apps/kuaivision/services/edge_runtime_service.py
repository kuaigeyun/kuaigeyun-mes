"""边缘 Agent 配置拉取与心跳。"""

from __future__ import annotations

from apps.kuaivision.models.vision import (
    VisionCamera,
    VisionModelArtifact,
    VisionRecipe,
    VisionRecipeVersion,
    VisionStationBind,
)
from apps.kuaivision.schemas.vision import (
    EdgeAgentConfigResponse,
    EdgeCameraConfig,
    EdgeHeartbeatPayload,
    EdgeHeartbeatResponse,
    EdgeModelConfig,
    EdgeRecipeConfig,
)
from apps.kuaivision.services.agent_service import AgentService
from apps.kuaivision.services.ops_alert_service import OpsAlertService
from apps.kuaivision.services.settings_service import SettingsService
from core.utils.timezone_utils import resolve_business_datetime


class EdgeRuntimeService:
    @staticmethod
    async def _model_config(tenant_id: int, model_artifact_id: int | None) -> EdgeModelConfig | None:
        if not model_artifact_id:
            return None
        art = await VisionModelArtifact.get_or_none(
            tenant_id=tenant_id, id=model_artifact_id, deleted_at__isnull=True, is_enabled=True
        )
        if not art:
            return None
        return EdgeModelConfig(
            code=art.code,
            framework=art.framework or "onnx",
            object_key=art.object_key,
            checksum=art.checksum,
            input_width=art.input_width,
            input_height=art.input_height,
            label_map=art.label_map,
        )

    @staticmethod
    async def pull_config(device_token: str) -> EdgeAgentConfigResponse:
        agent = await AgentService.get_by_token(device_token)
        settings = await SettingsService.get(agent.tenant_id)

        cameras_out: list[EdgeCameraConfig] = []
        cams = await VisionCamera.filter(
            tenant_id=agent.tenant_id, deleted_at__isnull=True, is_enabled=True
        ).order_by("id")
        for cam in cams:
            bind = await VisionStationBind.filter(
                tenant_id=agent.tenant_id, camera_id=cam.id, deleted_at__isnull=True
            ).order_by("id").first()
            cameras_out.append(
                EdgeCameraConfig(
                    code=cam.code,
                    name=cam.name,
                    sdk_type=cam.sdk_type,
                    serial_no=cam.serial_no,
                    station_code=bind.station_code if bind else None,
                    is_enabled=cam.is_enabled,
                )
            )

        recipes_out: list[EdgeRecipeConfig] = []
        recipes = await VisionRecipe.filter(
            tenant_id=agent.tenant_id, deleted_at__isnull=True, is_enabled=True
        ).order_by("id")
        for recipe in recipes:
            pub = await VisionRecipeVersion.get_or_none(
                tenant_id=agent.tenant_id,
                recipe_id=recipe.id,
                status="published",
                deleted_at__isnull=True,
            )
            if not pub:
                continue
            recipes_out.append(
                EdgeRecipeConfig(
                    code=recipe.code,
                    name=recipe.name,
                    recipe_type=recipe.recipe_type,
                    version=pub.version,
                    review_threshold=recipe.review_threshold,
                    default_camera_code=recipe.default_camera_code,
                    trigger_mode=recipe.trigger_mode or "manual",
                    trigger_interval_seconds=recipe.trigger_interval_seconds,
                    params=pub.params,
                    model=await EdgeRuntimeService._model_config(agent.tenant_id, pub.model_artifact_id),
                )
            )

        return EdgeAgentConfigResponse(
            agent_code=agent.code,
            agent_name=agent.name,
            run_mode=agent.run_mode or "local_pipeline",
            config_version=int(agent.config_version or 1),
            offline_timeout_seconds=int(settings.offline_timeout_seconds or 60),
            require_published_recipe=bool(settings.require_published_recipe),
            cameras=cameras_out,
            recipes=recipes_out,
        )

    @staticmethod
    async def heartbeat(device_token: str, payload: EdgeHeartbeatPayload) -> EdgeHeartbeatResponse:
        agent = await AgentService.get_by_token(device_token)
        now = resolve_business_datetime()
        agent.last_heartbeat_at = now
        if payload.agent_version is not None:
            agent.agent_version = payload.agent_version
        agent.last_error = payload.last_error
        agent.buffer_pending_count = int(payload.buffer_pending_count or 0)
        if payload.disk_free_mb is not None:
            agent.disk_free_mb = payload.disk_free_mb
        await agent.save(
            update_fields=[
                "last_heartbeat_at",
                "agent_version",
                "last_error",
                "buffer_pending_count",
                "disk_free_mb",
                "updated_at",
            ]
        )
        await OpsAlertService.maybe_alert_on_heartbeat(agent)
        return EdgeHeartbeatResponse(
            ok=True,
            config_version=int(agent.config_version or 1),
            server_time=now,
        )
