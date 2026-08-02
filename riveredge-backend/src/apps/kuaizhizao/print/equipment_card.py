"""快制造 — 设备卡（固定资产信息卡）打印预设。

市面常见规格：
- 资产标签：40×30 / 60×40 / 80×60 mm
- 设备信息挂牌卡：100×70 / 120×80 mm
默认 100×70mm 横版单卡。

版式用 HTML table 画完整格子线（分栏 flex 在预览里框线常看不见）。
设计器仍保存 designer_schema，编译时走 compileMode=asset_card_table。
"""

from __future__ import annotations

from typing import Any

from apps.kuaizhizao.print.designer_presets import (
    _field,
    _id,
    _text,
)

# 标签 | 内容 | 二维码 — 固定列宽（mm）
ASSET_CARD_LABEL_WIDTH_MM = 12
ASSET_CARD_QR_WIDTH_MM = 40
ASSET_CARD_QR_IMG_PX = 148

ASSET_CARD_ROWS: list[tuple[str, str]] = [
    ("编号", "item.code"),
    ("名称", "item.name"),
    ("型号", "item.model"),
    ("类型", "item.type"),
    ("所属", "item.affiliation"),
    ("购买", "item.purchase_date"),
    ("启用", "item.installation_date"),
]


def build_asset_card_config() -> dict[str, Any]:
    return {
        "titleExpr": "{{ card_title or '设备卡' }}",
        "labelWidthMm": ASSET_CARD_LABEL_WIDTH_MM,
        "qrWidthMm": ASSET_CARD_QR_WIDTH_MM,
        "qrImgPx": ASSET_CARD_QR_IMG_PX,
        "qrUrlExpr": "{{ item.qrcode_image }}",
        "rows": [{"label": label, "key": key} for label, key in ASSET_CARD_ROWS],
    }


def render_asset_card_table_html(card: dict[str, Any] | None = None) -> str:
    """生成带完整框线的设备卡 table HTML（单卡本体，不含 for 循环）。"""
    cfg = card or build_asset_card_config()
    label_w = int(cfg.get("labelWidthMm") or ASSET_CARD_LABEL_WIDTH_MM)
    qr_w = int(cfg.get("qrWidthMm") or ASSET_CARD_QR_WIDTH_MM)
    qr_px = int(cfg.get("qrImgPx") or ASSET_CARD_QR_IMG_PX)
    title_expr = str(cfg.get("titleExpr") or "{{ card_title or '设备卡' }}")
    qr_url = str(cfg.get("qrUrlExpr") or "{{ item.qrcode_image }}")
    rows = cfg.get("rows") if isinstance(cfg.get("rows"), list) else []
    if not rows:
        rows = [{"label": label, "key": key} for label, key in ASSET_CARD_ROWS]

    row_count = max(len(rows), 1)
    body_rows: list[str] = []
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        label = str(row.get("label") or "").strip() or "—"
        key = str(row.get("key") or "").strip()
        value_expr = f"{{{{ {key} or '—' }}}}" if key else "—"
        if idx == 0:
            body_rows.append(
                "<tr>"
                f'<td class="eq-label">{label}</td>'
                f'<td class="eq-value">{value_expr}</td>'
                f'<td class="eq-qr" rowspan="{row_count}">'
                f'<img src="{qr_url}" alt="QR" width="{qr_px}" height="{qr_px}" />'
                "</td>"
                "</tr>"
            )
        else:
            body_rows.append(
                "<tr>"
                f'<td class="eq-label">{label}</td>'
                f'<td class="eq-value">{value_expr}</td>'
                "</tr>"
            )

    return f"""
<table class="eq-asset-card">
  <colgroup>
    <col style="width:{label_w}mm" />
    <col />
    <col style="width:{qr_w}mm" />
  </colgroup>
  <thead>
    <tr>
      <th class="eq-title" colspan="3">{title_expr}</th>
    </tr>
  </thead>
  <tbody>
    {"".join(body_rows)}
  </tbody>
</table>
""".strip()


def asset_card_table_css() -> str:
    return """
  table.eq-asset-card {
    width: 100%;
    height: 66mm;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1.5px solid #000;
    background: #fff;
    color: #000;
  }
  table.eq-asset-card th,
  table.eq-asset-card td {
    border: 1px solid #000;
    vertical-align: middle;
    box-sizing: border-box;
  }
  table.eq-asset-card .eq-title {
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 3px;
    padding: 2.5mm 2mm;
    height: 10mm;
  }
  table.eq-asset-card .eq-label {
    width: 12mm;
    max-width: 12mm;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    padding: 0 1px;
    overflow: hidden;
  }
  table.eq-asset-card .eq-value {
    text-align: center;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 1mm 2mm;
  }
  table.eq-asset-card .eq-qr {
    text-align: center;
    padding: 2mm;
    width: 40mm;
    max-width: 40mm;
  }
  table.eq-asset-card .eq-qr img {
    width: 36mm !important;
    height: 36mm !important;
    max-width: 36mm !important;
    max-height: 36mm !important;
    display: block;
    margin: 0 auto;
    object-fit: contain;
  }
""".strip()


def _label_value_row(label: str, field_key: str) -> dict[str, Any]:
    """设计器画布用的近似行（真正打印以 table 为准）。"""
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
                "width": f"{ASSET_CARD_LABEL_WIDTH_MM}mm",
                "horizontalAlign": "center",
                "verticalAlign": "middle",
                "blocks": [
                    _text(
                        label,
                        style={
                            "fontSize": "11px",
                            "fontWeight": "600",
                            "textAlign": "center",
                            "padding": "2px 0",
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
                            "fontSize": "12px",
                            "textAlign": "center",
                            "padding": "2px 4px",
                            "whiteSpace": "nowrap",
                            "overflow": "hidden",
                        },
                    }
                ],
            },
        ],
    }


def build_equipment_card_designer_schema() -> dict[str, Any]:
    """可视化 schema：设计器可调；compileMode 强制按表格编译出完整框线。"""
    rows = [_label_value_row(label, key) for label, key in ASSET_CARD_ROWS]
    return {
        "version": "v1",
        "compileMode": "asset_card_table",
        "assetCard": build_asset_card_config(),
        "pageSize": "ASSET-100x70",
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
                    "minHeight": "66mm",
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
                                "{{ card_title or '设备卡' }}",
                                style={
                                    "fontSize": "16px",
                                    "fontWeight": "700",
                                    "textAlign": "center",
                                    "letterSpacing": "3px",
                                    "padding": "3mm 2mm",
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
                                        "width": f"{ASSET_CARD_QR_WIDTH_MM}mm",
                                        "horizontalAlign": "center",
                                        "verticalAlign": "middle",
                                        "blocks": [
                                            {
                                                "id": _id("img"),
                                                "type": "image",
                                                "url": "{{ item.qrcode_image }}",
                                                "width": ASSET_CARD_QR_IMG_PX,
                                                "height": ASSET_CARD_QR_IMG_PX,
                                                "preserveAspectRatio": True,
                                                "style": {
                                                    "textAlign": "center",
                                                    "padding": "2mm",
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


def compile_asset_card_table_schema(schema: dict[str, Any]) -> str:
    """按 asset_card_table 模式编译完整 Jinja 模板。"""
    from core.services.print.print_template_service import _PRINT_TEMPLATE_BODY_FONT_STACK

    paper_size_map = {
        "A4": "210mm 297mm",
        "A5": "148mm 210mm",
        "ASSET-100x70": "100mm 70mm",
        "ASSET-120x80": "120mm 80mm",
        "ASSET-80x60": "80mm 60mm",
    }
    page_size = str(schema.get("pageSize") or "ASSET-100x70")
    orientation = str(schema.get("orientation") or "portrait")
    page_size_val = paper_size_map.get(page_size, page_size)
    margins = schema.get("margins") if isinstance(schema.get("margins"), dict) else {}
    margin_str = (
        f"{margins.get('top', 2)}mm {margins.get('right', 2)}mm "
        f"{margins.get('bottom', 2)}mm {margins.get('left', 2)}mm"
    )
    card = schema.get("assetCard") if isinstance(schema.get("assetCard"), dict) else None
    table_html = render_asset_card_table_html(card)
    repeat_collection = str(schema.get("repeatCollection") or "items").strip() or "items"
    repeat_item = str(schema.get("repeatItem") or "item").strip() or "item"
    body = (
        f"{{% for {repeat_item} in {repeat_collection} %}}"
        f'<div class="print-repeat-page">{table_html}</div>'
        f"{{% endfor %}}"
    )

    return f"""<style>
  @page {{ size: {page_size_val} {orientation}; margin: {margin_str}; }}
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  html, body {{ width: 100%; margin: 0 !important; padding: 0 !important; font-family: {_PRINT_TEMPLATE_BODY_FONT_STACK}; color: #000; }}
  .print-repeat-page {{ page-break-after: always; break-after: page; }}
  .print-repeat-page:last-child {{ page-break-after: auto; break-after: auto; }}
  {asset_card_table_css()}
</style>
{body}""".strip()


def build_equipment_card_preset() -> dict[str, Any]:
    designer_schema = build_equipment_card_designer_schema()
    # 走专用表格编译，保证框线；designer_schema 仍可供设计器打开
    compiled = compile_asset_card_table_schema(designer_schema)
    return {
        "name": "设备卡",
        "code": "EQUIPMENT_CARD_PRINT",
        "type": "html",
        "description": "固定资产/设备信息卡（100×70mm 表格框线单卡，可视化设计；支持批量）",
        "content": compiled,
        "config": {
            "document_type": "equipment_card",
            "engine": "jinja2",
            "strict_variables": False,
            "source_type": "designer_json",
            "designer_version": "v1",
            "designer_schema": designer_schema,
            "page": {
                "size": "ASSET-100x70",
                "orientation": "portrait",
                "margin": "2mm",
            },
        },
        "is_active": True,
        "is_default": True,
    }


# 兼容旧导入名
EQUIPMENT_CARD_PRINT_PRESET = build_equipment_card_preset()
