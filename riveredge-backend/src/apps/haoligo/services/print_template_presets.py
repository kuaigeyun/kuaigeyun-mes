"""加载好力 GO 打印模板预设到租户。"""

from __future__ import annotations

from loguru import logger

from apps.haoligo.print.preset_templates import HAOLIGO_PRESET_PRINT_TEMPLATES
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateCreate
from core.services.print.print_template_service import PrintTemplateService


async def load_haoligo_print_template_presets(tenant_id: int) -> int:
    """按 code 去重创建缺失的维保完成单打印模板。"""
    created = 0
    for item in HAOLIGO_PRESET_PRINT_TEMPLATES:
        base_code = str(item["code"]).strip().upper()
        exists = (
            await PrintTemplate.filter(tenant_id=tenant_id, deleted_at__isnull=True, code=base_code).exists()
            or await PrintTemplate.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__startswith=f"{base_code}_",
            ).exists()
        )
        if exists:
            rows = await PrintTemplate.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__startswith=base_code,
            ).all()
            preset_cfg = item.get("config") or {}
            preset_dt = preset_cfg.get("document_type")
            preset_content = item.get("content") or ""
            for row in rows:
                update_fields: list[str] = []
                if preset_dt and (row.config or {}).get("document_type") != preset_dt:
                    row.config = {**(row.config or {}), **preset_cfg}
                    update_fields.append("config")
                if preset_content and row.content != preset_content:
                    row.content = preset_content
                    update_fields.append("content")
                if update_fields:
                    update_fields.append("updated_at")
                    await row.save(update_fields=update_fields)
            continue
        try:
            data = PrintTemplateCreate(
                name=item["name"],
                code=item["code"],
                type=item["type"],
                description=item.get("description"),
                content=item["content"],
                config=item.get("config"),
                is_active=item.get("is_active", True),
            )
            await PrintTemplateService.create_print_template(tenant_id, data)
            created += 1
        except Exception as e:
            logger.warning("创建好力 GO 打印模板 {} 失败: {}", item["code"], e)
    return created
