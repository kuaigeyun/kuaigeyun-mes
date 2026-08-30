from core.schemas.print_template import PrintTemplateCompileRequest
from core.services.print.print_template_service import PrintTemplateService


def _compile_seal(schema: dict) -> str:
    result = PrintTemplateService.compile_designer_schema(
        PrintTemplateCompileRequest(source_type="designer_json", source=schema)
    )
    return str(result.get("compiled_template") or "")


def test_seal_overlay_default_size_40mm():
    html = _compile_seal(
        {
            "blocks": [
                {
                    "id": "seal-1",
                    "type": "seal_overlay",
                    "url": "{{ company_seal }}",
                    "width": 40,
                    "height": 40,
                    "sizeUnit": "mm",
                    "content": "供方（盖章）：",
                }
            ]
        }
    )
    assert "width:40mm" in html
    assert "height:40mm" in html
    assert "background-size:40mm auto" in html


def test_seal_overlay_legacy_px_preserved():
    html = _compile_seal(
        {
            "blocks": [
                {
                    "id": "seal-legacy",
                    "type": "seal_overlay",
                    "url": "{{ company_seal }}",
                    "width": 100,
                    "height": 100,
                    "content": "",
                }
            ]
        }
    )
    assert "width:100px" in html
    assert "height:100px" in html


def test_image_logo_block_empty_url_with_logo_id():
    html = _compile_seal(
        {
            "blocks": [
                {
                    "id": "logo-1",
                    "type": "image",
                    "url": "",
                    "width": 100,
                    "height": 60,
                }
            ]
        }
    )
    assert 'src="{{ company_logo }}"' in html


def test_image_logo_block_company_logo_variable():
    html = _compile_seal(
        {
            "blocks": [
                {
                    "id": "img-1",
                    "type": "image",
                    "url": "{{ company_logo }}",
                    "width": 80,
                    "height": 40,
                    "keepRatio": True,
                }
            ]
        }
    )
    assert 'src="{{ company_logo }}"' in html
    assert "height:auto" in html

    html = _compile_seal(
        {
            "blocks": [
                {
                    "id": "seal-2",
                    "type": "seal_overlay",
                    "url": "{{ company_seal }}",
                    "width": 40,
                    "height": 40,
                    "sizeUnit": "mm",
                    "content": "单位名称：示例\n账号：123",
                }
            ]
        }
    )
    assert "print-seal-overlay-mark" in html
    assert "min-height:" not in html
    assert "white-space:pre-wrap" in html
