"""加载快制造打印模板预设到租户。

约定：库内 PrintTemplate.content 为版式唯一真源。
预设在「租户尚无该 code」时创建。

升级：exact code 匹配的预置若尚非可视化（无 designer_schema.blocks，
或仍为 asset_card_table），用当前可视化预置覆盖 content/config。
用户自建的 code_001 等后缀模板不覆盖。
"""

from __future__ import annotations

from loguru import logger

from apps.kuaizhizao.print.preset_templates import KUAIZHIZAO_PRESET_PRINT_TEMPLATES
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateCreate
from core.services.print.print_template_service import PrintTemplateService
from core.services.print.print_template_visual import is_visual_designer_config


async def _upgrade_non_visual_builtin_preset(tenant_id: int, item: dict) -> bool:
    """将 exact-code 预置从纯 HTML / 旧资产卡模式升级为可视化预设。"""
    code = str(item.get("code") or "").strip().upper()
    if not code:
        return False
    tpl = await PrintTemplate.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        code=code,
    ).first()
    if not tpl or is_visual_designer_config(tpl.config):
        return False
    tpl.name = item["name"]
    tpl.description = item.get("description")
    tpl.content = item["content"]
    tpl.config = item.get("config")
    tpl.is_active = item.get("is_active", True)
    if item.get("is_default") is not None:
        tpl.is_default = bool(item.get("is_default"))
    await tpl.save()
    logger.info("已升级打印模板为可视化: tenant={} code={}", tenant_id, code)
    return True


async def load_kuaizhizao_print_template_presets(tenant_id: int) -> int:
    """按 code 去重：创建缺失模板；非可视化预置可升级一次。"""
    created = 0
    for item in KUAIZHIZAO_PRESET_PRINT_TEMPLATES:
        base_code = str(item["code"]).strip().upper()
        if await PrintTemplateService.preset_code_family_exists(tenant_id, base_code):
            try:
                if await _upgrade_non_visual_builtin_preset(tenant_id, item):
                    created += 1
            except Exception as e:
                logger.warning("升级快制造打印模板 {} 失败: {}", item["code"], e)
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
