"""加载快制造打印模板预设到租户。

约定：库内 PrintTemplate.content 为版式唯一真源。
预设仅在「租户尚无该 code」时创建；已存在则绝不覆盖 content / designer_schema。
"""

from __future__ import annotations

from loguru import logger

from apps.kuaizhizao.print.preset_templates import KUAIZHIZAO_PRESET_PRINT_TEMPLATES
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateCreate
from core.services.print.print_template_service import PrintTemplateService


async def load_kuaizhizao_print_template_presets(tenant_id: int) -> int:
    """按 code 去重：只创建缺失模板，不改已有模板内容。"""
    created = 0
    for item in KUAIZHIZAO_PRESET_PRINT_TEMPLATES:
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
            # 已存在：库内为真源，跳过（避免打开打印弹窗时把手工改的版式冲掉）
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
                is_default=item.get("is_default", False),
            )
            await PrintTemplateService.create_print_template(tenant_id, data)
            created += 1
        except Exception as e:
            logger.warning("创建快制造打印模板 {} 失败: {}", item["code"], e)
    return created
