"""快制造 — 模具卡打印预设（默认 60×50mm 标签）。

可视化 designer_schema（blocks）为打印真源；字段与标题为模具。
"""

from __future__ import annotations

from typing import Any

from apps.kuaizhizao.print.designer_presets import _field, _id, _text
from apps.kuaizhizao.print.equipment_card import (
    ASSET_CARD_LAYOUT_BY_PAGE,
    resolve_asset_card_layout,
)

MOLD_CARD_PAGE_SIZE = "ASSET-60x50"

MOLD_CARD_ROWS: list[tuple[str, str]] = [
    ("编号", "item.code"),
    ("名称", "item.name"),
    ("型号", "item.model"),
    ("类型", "item.type"),
    ("位置", "item.affiliation"),
    ("购买", "item.purchase_date"),
    ("启用", "item.installation_date"),
]


def build_mold_card_config() -> dict[str, Any]:
    layout = ASSET_CARD_LAYOUT_BY_PAGE[MOLD_CARD_PAGE_SIZE]
    return {
        "titleExpr": "{{ card_title or '模具卡' }}",
        "labelWidthMm": layout["label_width_mm"],
        "qrWidthMm": layout["qr_width_mm"],
        "qrImgPx": layout["qr_img_px"],
        "cardHeightMm": layout["card_height_mm"],
        "qrImgMm": layout["qr_img_mm"],
        "qrUrlExpr": "{{ item.qrcode_image }}",
        "rows": [{"label": label, "key": key} for label, key in MOLD_CARD_ROWS],
    }


def _label_value_row(label: str, field_key: str, *, label_w: int) -> dict[str, Any]:
    return {
        "id": _id("row"),
        "type": "columns",
        "gap": 0,
        "verticalAlign": "stretch",
        "style": {
            "border": "1px solid #000",
            "borderBottom": "1px solid #000",
            "width": "100%",
        },
        "cols": [
            {
                "id": _id("c"),
                "width": f"{label_w}mm",
                "horizontalAlign": "center",
                "verticalAlign": "middle",
                "blocks": [
                    _text(
                        label,
                        style={
                            "fontSize": "9px",
                            "fontWeight": "600",
                            "textAlign": "center",
                            "padding": "1px 0",
                            "whiteSpace": "nowrap",
                            "borderRight": "1px solid #000",
                        },
                    )
                ],
            },
            {
                "id": _id("c"),
                "width": "1",
                "horizontalAlign": "center",
                "verticalAlign": "middle",
                "blocks": [
                    {
                        **_field(field_key, label, show_label=False),
                        "style": {
                            "fontSize": "10px",
                            "textAlign": "center",
                            "padding": "1px 2px",
                            "whiteSpace": "nowrap",
                            "overflow": "hidden",
                        },
                    }
                ],
            },
        ],
    }


def build_mold_card_designer_schema() -> dict[str, Any]:
    layout = resolve_asset_card_layout(MOLD_CARD_PAGE_SIZE, build_mold_card_config())
    label_w = int(layout["label_width_mm"])
    qr_w = int(layout["qr_width_mm"])
    qr_px = int(layout["qr_img_px"])
    card_h = int(layout["card_height_mm"])
    rows = [_label_value_row(label, key, label_w=label_w) for label, key in MOLD_CARD_ROWS]
    return {
        "version": "v1",
        "cardKind": "mold",
        "pageSize": MOLD_CARD_PAGE_SIZE,
        "orientation": "portrait",
        "margins": {"top": 2, "right": 2, "bottom": 2, "left": 2},
        "itemSpacing": 0,
        "repeatCollection": "items",
        "repeatItem": "item",
        "blocks": [
            {
                "id": _id("card"),
                "type": "columns",
                "gap": 0,
                "verticalAlign": "stretch",
                "style": {
                    "border": "1.5px solid #000",
                    "width": "100%",
                    "minHeight": f"{card_h}mm",
                    "boxSizing": "border-box",
                    "backgroundColor": "#ffffff",
                },
                "cols": [
                    {
                        "id": _id("c"),
                        "width": "1",
                        "horizontalAlign": "stretch",
                        "verticalAlign": "top",
                        "blocks": [
                            _text(
                                "{{ card_title or '模具卡' }}",
                                style={
                                    "fontSize": "12px",
                                    "fontWeight": "700",
                                    "textAlign": "center",
                                    "letterSpacing": "2px",
                                    "padding": "1.5mm 1mm",
                                    "border": "1px solid #000",
                                    "borderBottom": "1.5px solid #000",
                                    "width": "100%",
                                },
                            ),
                            {
                                "id": _id("body"),
                                "type": "columns",
                                "gap": 0,
                                "verticalAlign": "stretch",
                                "style": {
                                    "width": "100%",
                                    "border": "1px solid #000",
                                },
                                "cols": [
                                    {
                                        "id": _id("c"),
                                        "width": "1",
                                        "horizontalAlign": "stretch",
                                        "verticalAlign": "top",
                                        "blocks": rows,
                                    },
                                    {
                                        "id": _id("c"),
                                        "width": f"{qr_w}mm",
                                        "horizontalAlign": "center",
                                        "verticalAlign": "middle",
                                        "blocks": [
                                            {
                                                "id": _id("img"),
                                                "type": "image",
                                                "url": "{{ item.qrcode_image }}",
                                                "width": qr_px,
                                                "height": qr_px,
                                                "preserveAspectRatio": True,
                                                "style": {
                                                    "textAlign": "center",
                                                    "padding": "1mm",
                                                    "border": "1px solid #000",
                                                    "borderLeft": "1px solid #000",
                                                    "width": "100%",
                                                    "boxSizing": "border-box",
                                                },
                                            }
                                        ],
                                    },
                                ],
                            },
                        ],
                    }
                ],
            }
        ],
    }


def build_mold_card_preset() -> dict[str, Any]:
    from apps.kuaizhizao.print.designer_presets import compile_designer_schema

    designer_schema = build_mold_card_designer_schema()
    compiled = compile_designer_schema(designer_schema)
    return {
        "name": "模具卡",
        "code": "MOLD_CARD_PRINT",
        "type": "html",
        "description": "模具信息卡（60×50mm 可视化标签；纸张可改预设或自定义 mm；支持批量）",
        "content": compiled,
        "config": {
            "document_type": "mold_card",
            "engine": "jinja2",
            "strict_variables": False,
            "source_type": "designer_json",
            "designer_version": "v1",
            "designer_schema": designer_schema,
            "page": {
                "size": MOLD_CARD_PAGE_SIZE,
                "orientation": "portrait",
                "margin": "2mm",
            },
        },
        "is_active": True,
        "is_default": True,
    }


MOLD_CARD_PRINT_PRESET = build_mold_card_preset()
