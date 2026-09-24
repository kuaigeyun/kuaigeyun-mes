"""工程图纸打印水印策略"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from apps.common.audit_actor import apply_update_audit
from apps.master_data.models.drawing_watermark import (
    DEFAULT_DRAWING_WATERMARK_TEMPLATE,
    DrawingWatermarkPolicy,
)
from apps.master_data.schemas.drawing_watermark_schemas import (
    DrawingWatermarkPolicyResponse,
    DrawingWatermarkPolicyUpdate,
    DrawingWatermarkStyleResponse,
)
from apps.master_data.services.drawing_security import SECURITY_LEVEL_LABELS
from core.services.system.site_setting_service import SiteSettingService
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User


@dataclass(frozen=True)
class WatermarkRenderContext:
    user: str
    time: str
    code: str
    revision: str
    security_level: str
    site_name: str


def _default_policy_fields() -> dict:
    template = DEFAULT_DRAWING_WATERMARK_TEMPLATE
    return {
        "is_enabled": True,
        "force_on_print": True,
        "opacity": 0.15,
        "angle": -25,
        "font_size": 48,
        "color": "rgba(200,0,0,1)",
        "position": "diagonal",
        "template_public": template,
        "template_internal": template,
        "template_secret": template,
        "template_confidential": template,
    }


def _template_for_level(policy: dict, security_level: str) -> str:
    key = {
        "public": "template_public",
        "internal": "template_internal",
        "secret": "template_secret",
        "confidential": "template_confidential",
    }.get(security_level, "template_internal")
    raw = policy.get(key)
    if raw is None or str(raw).strip() == "":
        return DEFAULT_DRAWING_WATERMARK_TEMPLATE
    return str(raw).strip()


def render_watermark_template(template: str, ctx: WatermarkRenderContext) -> str:
    level_label = SECURITY_LEVEL_LABELS.get(ctx.security_level, ctx.security_level)
    replacements = {
        "{user}": ctx.user,
        "{time}": ctx.time,
        "{code}": ctx.code,
        "{revision}": ctx.revision,
        "{securityLevel}": level_label,
        "{siteName}": ctx.site_name,
    }
    text = template
    for key, value in replacements.items():
        text = text.replace(key, value)
    return " ".join(text.split())


class DrawingWatermarkService:
    @staticmethod
    def _policy_to_dict(policy: Optional[DrawingWatermarkPolicy]) -> dict:
        defaults = _default_policy_fields()
        if not policy:
            return defaults
        return {
            "is_enabled": policy.is_enabled,
            "force_on_print": policy.force_on_print,
            "opacity": float(policy.opacity),
            "angle": int(policy.angle),
            "font_size": int(policy.font_size),
            "color": policy.color or defaults["color"],
            "position": policy.position or defaults["position"],
            "template_public": policy.template_public or defaults["template_public"],
            "template_internal": policy.template_internal or defaults["template_internal"],
            "template_secret": policy.template_secret or defaults["template_secret"],
            "template_confidential": policy.template_confidential or defaults["template_confidential"],
        }

    @staticmethod
    async def get_policy_row(tenant_id: int) -> Optional[DrawingWatermarkPolicy]:
        return await DrawingWatermarkPolicy.get_or_none(tenant_id=tenant_id)

    @staticmethod
    async def get_effective_policy(tenant_id: int) -> dict:
        row = await DrawingWatermarkService.get_policy_row(tenant_id)
        return DrawingWatermarkService._policy_to_dict(row)

    @staticmethod
    def to_response(policy: dict) -> DrawingWatermarkPolicyResponse:
        return DrawingWatermarkPolicyResponse(
            is_enabled=policy["is_enabled"],
            force_on_print=policy["force_on_print"],
            opacity=policy["opacity"],
            angle=policy["angle"],
            font_size=policy["font_size"],
            color=policy["color"],
            position=policy["position"],
            template_public=policy["template_public"],
            template_internal=policy["template_internal"],
            template_secret=policy["template_secret"],
            template_confidential=policy["template_confidential"],
        )

    @staticmethod
    def to_style_response(policy: dict) -> DrawingWatermarkStyleResponse:
        return DrawingWatermarkStyleResponse(
            opacity=policy["opacity"],
            angle=policy["angle"],
            font_size=policy["font_size"],
            color=policy["color"],
            position=policy["position"],
        )

    @staticmethod
    async def get_policy(tenant_id: int) -> DrawingWatermarkPolicyResponse:
        policy = await DrawingWatermarkService.get_effective_policy(tenant_id)
        return DrawingWatermarkService.to_response(policy)

    @staticmethod
    async def update_policy(
        tenant_id: int,
        data: DrawingWatermarkPolicyUpdate,
        current_user: Optional[User],
    ) -> DrawingWatermarkPolicyResponse:
        row = await DrawingWatermarkService.get_policy_row(tenant_id)
        if not row:
            row = DrawingWatermarkPolicy(tenant_id=tenant_id)
        row.is_enabled = data.is_enabled
        row.force_on_print = data.force_on_print
        row.opacity = data.opacity
        row.angle = data.angle
        row.font_size = data.font_size
        row.color = data.color
        row.position = data.position
        row.template_public = data.template_public.strip()
        row.template_internal = data.template_internal.strip()
        row.template_secret = data.template_secret.strip()
        row.template_confidential = data.template_confidential.strip()
        apply_update_audit(row, current_user)
        await row.save()
        return DrawingWatermarkService.to_response(DrawingWatermarkService._policy_to_dict(row))

    @staticmethod
    async def resolve_site_name(tenant_id: int) -> str:
        settings = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        return str(settings.get("site_name") or "").strip()

    @staticmethod
    async def build_print_watermark(
        tenant_id: int,
        *,
        security_level: str,
        ctx: WatermarkRenderContext,
    ) -> tuple[str, Optional[DrawingWatermarkStyleResponse]]:
        policy = await DrawingWatermarkService.get_effective_policy(tenant_id)
        if not policy["is_enabled"]:
            return "", None
        template = _template_for_level(policy, security_level)
        watermark = render_watermark_template(template, ctx)
        if policy["force_on_print"] and not watermark.strip():
            raise ValidationError("当前密级水印模板渲染为空，请检查水印设置")
        style = DrawingWatermarkService.to_style_response(policy)
        return watermark, style
