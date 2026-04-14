import asyncio
import json
import os
import sys

sys.path.append(os.path.abspath("F:\\dev\\riveredge\\riveredge-backend\\src"))

from tortoise import Tortoise

async def run():
    print("Initiating DB...")
    from infra.infrastructure.database.database import get_dynamic_tortoise_config
    config = await get_dynamic_tortoise_config()
    await Tortoise.init(config=config)
    
    from core.models.print_template import PrintTemplate
    
    template_json = {
        "basePdf": {
            "width": 210,
            "height": 297,
            "padding": [10, 10, 10, 10]
        },
        "schemas": [
            [
                {
                    "name": "items",
                    "type": "table",
                    "position": { "x": 10, "y": 15 },
                    "width": 190,
                    "height": 48,
                    "showHead": True,
                    "head": ["中文简称", "型号", "图片", "单位", "数量", "单价\n(含税)", "总价\n(含税)"],
                    "columns": [
                        { "key": "chinese_short_name", "label": "中文简称" },
                        { "key": "model_number", "label": "型号" },
                        { "key": "image_url", "label": "图片" },
                        { "key": "material_unit", "label": "单位" },
                        { "key": "quote_quantity", "label": "数量" },
                        { "key": "unit_price", "label": "单价\n(含税)" },
                        { "key": "total_amount", "label": "总价\n(含税)" }
                    ],
                    "headWidthPercentages": [18, 18, 20, 8, 10, 13, 13],
                    "tableStyles": { "borderColor": "#000000", "borderWidth": 0.3 },
                    "headStyles": {
                        "fontName": "NotoSansSC",
                        "fontSize": 10,
                        "alignment": "center",
                        "verticalAlignment": "middle",
                        "backgroundColor": "#bdd7ee",
                        "textColor": "#000000",
                        "lineHeight": 1.2
                    },
                    "bodyStyles": {
                        "fontName": "NotoSansSC",
                        "fontSize": 10,
                        "alignment": "center",
                        "verticalAlignment": "middle",
                        "lineHeight": 1.2
                    },
                    "columnStyles": {
                        "alignment": { "0": "center", "1": "center" }
                    },
                    "detailTableRowHeight": { "mode": "auto", "headMm": 14, "bodyMm": 22 }
                },
                {
                    "name": "total_bg_rect",
                    "type": "rectangle",
                    "position": { "x": 10, "y": 63 },
                    "width": 190,
                    "height": 10,
                    "color": "#bdd7ee",
                    "borderColor": "#000000",
                    "borderWidth": 0.3
                },
                {
                    "name": "total_label_text",
                    "type": "text",
                    "position": { "x": 10, "y": 63 },
                    "width": 160.3,
                    "height": 10,
                    "content": "合计",
                    "fontName": "NotoSansSC",
                    "fontSize": 12,
                    "alignment": "right",
                    "verticalAlignment": "middle",
                    "lineHeight": 1
                },
                {
                    "name": "total_amount",
                    "type": "text",
                    "position": { "x": 170.3, "y": 63 },
                    "width": 29.7,
                    "height": 10,
                    "content": "{total_amount}",
                    "fontName": "NotoSansSC",
                    "fontSize": 12,
                    "alignment": "center",
                    "verticalAlignment": "middle",
                    "lineHeight": 1
                },
                {
                    "name": "notes_bg_rect",
                    "type": "rectangle",
                    "position": { "x": 10, "y": 76 },
                    "width": 190,
                    "height": 30,
                    "color": "#bdd7ee",
                    "borderColor": "#000000",
                    "borderWidth": 0.3,
                    "opacity": 0.5
                },
                {
                    "name": "notes_label_text",
                    "type": "text",
                    "position": { "x": 12, "y": 78 },
                    "width": 15,
                    "height": 6,
                    "content": "备注:",
                    "fontName": "NotoSansSC",
                    "fontSize": 11,
                    "alignment": "left",
                    "verticalAlignment": "top"
                },
                {
                    "name": "notes",
                    "type": "text",
                    "position": { "x": 30, "y": 78 },
                    "width": 166,
                    "height": 26,
                    "content": "{notes}",
                    "fontName": "NotoSansSC",
                    "fontSize": 11,
                    "alignment": "left",
                    "verticalAlignment": "top",
                    "lineHeight": 1.5
                }
            ]
        ]
    }
    
    t = await PrintTemplate.filter(code="QUOTATION_PRINT").first()
    if t:
        t.content = json.dumps(template_json, ensure_ascii=False)
        await t.save()
        print(f"Updated template QUOTATION_PRINT for tenant {t.tenant_id}")
    else:
        print("Template QUOTATION_PRINT not found in DB")
        from core.models.print_template import PrintTemplate
        await PrintTemplate.create(
            name="商品报价单模板",
            code="QUOTATION_PRINT",
            type="pdfme",
            content=json.dumps(template_json, ensure_ascii=False),
            config={"document_type": "quotation"},
            tenant_id=1
        )
        print("Created new template")

    await Tortoise.close_connections()

if __name__ == '__main__':
    asyncio.run(run())
