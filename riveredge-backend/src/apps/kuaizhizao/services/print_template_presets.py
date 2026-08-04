"""加载快制造打印模板预设到租户。

约定：库内 PrintTemplate.content 为版式唯一真源。
预设仅在「租户尚无该 code」时创建；已存在则绝不覆盖 content / designer_schema。

例外：设备卡/模具卡仍带 compileMode=asset_card_table 的旧内置模板，
可升级为可视化 blocks 真源（用户若已去掉 compileMode 则视为已定制，不覆盖）。
"""

from __future__ import annotations

from loguru import logger

from apps.kuaizhizao.print.preset_templates import KUAIZHIZAO_PRESET_PRINT_TEMPLATES
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateCreate
from core.services.print.print_template_service import PrintTemplateService

# 仍使用代码式表格编译的内置资产卡 → 可安全升级为可视化
_ASSET_CARD_VISUAL_UPGRADE_CODES = frozenset({"EQUIPMENT_CARD_PRINT", "MOLD_CARD_PRINT"})


def _is_legacy_asset_card_table_schema(config: object) -> bool:
    if not isinstance(config, dict):
        return False
    schema = config.get("designer_schema")
    if not isinstance(schema, dict):
        return False
    return str(schema.get("compileMode") or "").strip() == "asset_card_table"


async def _upgrade_legacy_asset_card_preset(tenant_id: int, item: dict) -> bool:
    """将仍为 asset_card_table 的内置设备/模具卡升级为可视化预设。"""
    code = str(item.get("code") or "").strip().upper()
    if code not in _ASSET_CARD_VISUAL_UPGRADE_CODES:
        return False
    tpl = await PrintTemplate.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        code=code,
    ).first()
    if not tpl or not _is_legacy_asset_card_table_schema(tpl.config):
        return False
    tpl.name = item["name"]
    tpl.description = item.get("description")
    tpl.content = item["content"]
    tpl.config = item.get("config")
    tpl.is_active = item.get("is_active", True)
    tpl.is_default = item.get("is_default", False)
    await tpl.save()
    logger.info("已升级资产卡打印模板为可视化: tenant={} code={}", tenant_id, code)
    return True


async def load_kuaizhizao_print_template_presets(tenant_id: int) -> int:
    """按 code 去重：只创建缺失模板；资产卡旧表格模式可升级一次。"""
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
            try:
                if await _upgrade_legacy_asset_card_preset(tenant_id, item):
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
