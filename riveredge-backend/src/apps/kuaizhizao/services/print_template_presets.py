"""加载快制造打印模板预设到租户。"""

from __future__ import annotations

from loguru import logger

from apps.kuaizhizao.print.preset_templates import KUAIZHIZAO_PRESET_PRINT_TEMPLATES
from apps.kuaizhizao.print.designer_presets import compile_designer_schema, ensure_header_qrcode
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateCreate
from core.services.print.print_template_service import PrintTemplateService


def _apply_preset_config_updates(row: PrintTemplate, preset_cfg: dict) -> list[str]:
    """将预设 config（含 designer_schema）合并到已有模板，必要时重编译 content。"""
    update_fields: list[str] = []
    cfg = dict(row.config or {})
    preset_schema = preset_cfg.get("designer_schema")
    if preset_schema and not cfg.get("designer_schema"):
        cfg.update(preset_cfg)
        row.config = cfg
        update_fields.append("config")
        try:
            row.content = compile_designer_schema(preset_schema)
            update_fields.append("content")
        except Exception as e:
            logger.warning("重编译打印模板 designer_schema 失败: {}", e)
    elif preset_schema and cfg.get("designer_schema"):
        # 已有 schema：仅同步编译产物与元数据（不覆盖用户改过的 blocks）
        preset_content = preset_cfg.get("content")
        if preset_content and row.content != preset_content and cfg.get("source_type") != "designer_json":
            row.content = preset_content
            update_fields.append("content")
        dt = preset_cfg.get("document_type") or cfg.get("document_type")
        if dt and isinstance(cfg.get("designer_schema"), dict):
            existing_schema = dict(cfg["designer_schema"])
            patched_schema = ensure_header_qrcode(existing_schema, dt)
            if patched_schema != existing_schema:
                row.config = {**cfg, "designer_schema": patched_schema}
                update_fields.append("config")
                try:
                    row.content = compile_designer_schema(patched_schema)
                    update_fields.append("content")
                except Exception as e:
                    logger.warning("补齐页眉二维码后重编译失败: {}", e)
    preset_content = preset_cfg.get("content")
    preset_dt = preset_cfg.get("document_type")
    if preset_dt and (row.config or {}).get("document_type") != preset_dt:
        row.config = {**(row.config or {}), **{"document_type": preset_dt}}
        update_fields.append("config")
    if preset_content and not preset_schema:
        if row.content != preset_content:
            row.content = preset_content
            update_fields.append("content")
    return update_fields


async def load_kuaizhizao_print_template_presets(tenant_id: int) -> int:
    """按 code 去重创建缺失的业务单据打印模板。"""
    created = 0
    for item in KUAIZHIZAO_PRESET_PRINT_TEMPLATES:
        base_code = str(item["code"]).strip().upper()
        preset_cfg = item.get("config") or {}
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
            for row in rows:
                update_fields = _apply_preset_config_updates(row, preset_cfg)
                if update_fields:
                    update_fields.append("updated_at")
                    await row.save(update_fields=list(dict.fromkeys(update_fields)))
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
