"""打印模板可视化形态约定与升级辅助。

可视化真源：config.source_type == designer_json 且 config.designer_schema.blocks 非空。
库内预置按 exact code 升级时，仅覆盖「尚非可视化」或「资产卡旧表格编译模式」的记录。
"""

from __future__ import annotations

from typing import Any


def is_visual_designer_config(config: object) -> bool:
    """是否已是可进入可视化设计器的形态。"""
    if not isinstance(config, dict):
        return False
    schema = config.get("designer_schema")
    if not isinstance(schema, dict):
        return False
    blocks = schema.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        return False
    # 旧资产卡表格编译模式：虽有 schema，仍视为待升级的非可视化
    if str(schema.get("compileMode") or "").strip() == "asset_card_table":
        return False
    return True


def wrap_html_as_designer_schema(
    content: str,
    *,
    page_size: str = "A4",
    orientation: str = "portrait",
    margins: dict[str, int] | None = None,
) -> dict[str, Any]:
    """将已有 Jinja HTML 包进 designer_schema（html 区块），便于统一走可视化配置。"""
    margin = margins or {"top": 14, "right": 12, "bottom": 16, "left": 12}
    return {
        "version": "v1",
        "pageSize": page_size,
        "orientation": orientation,
        "margins": margin,
        "itemSpacing": 0,
        "blocks": [
            {
                "id": "html-body",
                "type": "html",
                "content": content or "",
            }
        ],
    }


def build_visual_config_from_html(
    *,
    document_type: str,
    content: str,
    page_size: str = "A4",
    orientation: str = "portrait",
    margin_css: str = "14mm 12mm",
    extra_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造带 designer_schema 的 config（content 仍为可打印 HTML）。"""
    designer_schema = wrap_html_as_designer_schema(
        content,
        page_size=page_size,
        orientation=orientation,
    )
    cfg: dict[str, Any] = {
        "document_type": document_type,
        "engine": "jinja2",
        "strict_variables": False,
        "source_type": "designer_json",
        "designer_version": "v1",
        "designer_schema": designer_schema,
        "page": {
            "size": page_size,
            "orientation": orientation,
            "margin": margin_css,
        },
    }
    if extra_config:
        cfg.update(extra_config)
        cfg["document_type"] = document_type
        cfg["source_type"] = "designer_json"
        cfg["designer_schema"] = designer_schema
    return cfg
