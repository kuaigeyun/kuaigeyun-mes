"""系统预置接口库目录（含金蝶AI苍穹 OpenAPI 包）。"""

from core.services.application.api_library_catalog import (
    get_api_library_pack,
    list_api_library_catalog,
)


def test_system_api_library_includes_kingdee_cosmic_pack():
    items = list_api_library_catalog()
    pack_ids = {item["pack_id"] for item in items}
    assert "kingdee_galaxy" in pack_ids
    assert "kingdee_cosmic" in pack_ids

    cosmic = get_api_library_pack("kingdee_cosmic")
    assert cosmic is not None
    assert cosmic["connector_type"] == "kingdee_cosmic"

    cosmic_item = next(item for item in items if item["pack_id"] == "kingdee_cosmic")
    assert cosmic_item["api_count"] >= 8
    assert cosmic_item["source"] == "system"


def test_kingdee_cosmic_presets_use_concrete_sys_query_paths():
    from core.services.integration.kingdee_cosmic_api_presets import list_kingdee_cosmic_api_presets

    presets = list_kingdee_cosmic_api_presets()
    suffixes = {item["code_suffix"] for item in presets}
    assert "query_material" in suffixes
    assert "query_purchase_order" in suffixes
    assert "op_query" not in suffixes
    material = next(p for p in presets if p["code_suffix"] == "query_material")
    assert material["path"] == "kapi/v2/basedata/bd_material/batchQuery"
    customer = next(p for p in presets if p["code_suffix"] == "query_customer")
    assert customer["path"] == "kapi/v2/basedata/bd_customer/batchQuery"
    assert customer.get("request_body", {}).get("pageSize") == 100
    assert "__API_NUMBER__" not in material["path"]
