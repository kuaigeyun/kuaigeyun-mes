from core.schemas.print_template import PrintTemplateCompileRequest
from core.services.print.print_template_service import PrintTemplateService


def _compile_detail_table(schema: dict) -> str:
    result = PrintTemplateService.compile_designer_schema(
        PrintTemplateCompileRequest(source_type="designer_json", source=schema)
    )
    return str(result.get("compiled_template") or "")


def test_detail_table_fixed_layout_and_equal_column_widths():
    html = _compile_detail_table(
        {
            "blocks": [
                {
                    "id": "tbl-1",
                    "type": "detail_table",
                    "collection": "items",
                    "row_alias": "row",
                    "columns": [
                        {"key": "a", "label": "A"},
                        {"key": "b", "label": "B"},
                        {"key": "c", "label": "备注"},
                    ],
                    "tableStyle": {"fontSize": "10px", "cellPadding": 4},
                }
            ]
        }
    )
    assert 'class="print-detail-table"' in html
    assert "table-layout:fixed" in html
    assert "max-width:100%" in html
    assert '<col style="width:33.333333%" />' in html
    assert "min-width:0" in html
    assert "overflow-wrap:anywhere" in html


def test_detail_table_respects_explicit_column_width():
    html = _compile_detail_table(
        {
            "blocks": [
                {
                    "id": "tbl-2",
                    "type": "detail_table",
                    "collection": "items",
                    "row_alias": "row",
                    "columns": [
                        {"key": "img", "label": "图片", "width": "60px"},
                        {"key": "name", "label": "名称"},
                    ],
                }
            ]
        }
    )
    assert '<col style="width:60px" />' in html
    assert "<col />" in html
    assert "table-layout:fixed" in html
