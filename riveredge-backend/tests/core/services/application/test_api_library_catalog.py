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
    assert "kingdee_cosmic_mfg" in pack_ids

    cosmic = get_api_library_pack("kingdee_cosmic")
    assert cosmic is not None
    assert cosmic["connector_type"] == "kingdee_cosmic"

    cosmic_item = next(item for item in items if item["pack_id"] == "kingdee_cosmic")
    assert cosmic_item["api_count"] >= 8
    assert cosmic_item["source"] == "system"

    mfg = get_api_library_pack("kingdee_cosmic_mfg")
    assert mfg is not None
    assert mfg["connector_type"] == "kingdee_cosmic"
    assert mfg["preset_loader"] == "kingdee_cosmic_mfg"
    mfg_item = next(item for item in items if item["pack_id"] == "kingdee_cosmic_mfg")
    assert mfg_item["api_count"] >= 100
    assert any("库存" in (it.get("name") or "") for it in mfg_item["items"])


def test_kingdee_cosmic_presets_use_concrete_sys_query_paths():
    from core.services.integration.kingdee_cosmic_api_presets import list_kingdee_cosmic_api_presets

    presets = list_kingdee_cosmic_api_presets()
    suffixes = {item["code_suffix"] for item in presets}
    assert "query_material" in suffixes
    assert "query_purchase_order" in suffixes
    assert "query_measureunits" in suffixes
    assert "query_goods_class" in suffixes
    assert "op_query" not in suffixes
    material = next(p for p in presets if p["code_suffix"] == "query_material")
    assert material["path"] == "kapi/v2/basedata/bd_material/batchQuery"
    material_select = str((material.get("request_body") or {}).get("select") or "")
    assert "baseunit.number" in material_select
    assert "number" in material_select
    measureunits = next(p for p in presets if p["code_suffix"] == "query_measureunits")
    assert measureunits["path"] == "kapi/v2/basedata/bd_material/batchQuery"
    assert "基础单位" in (measureunits.get("name") or "")
    assert "baseunit.number" in str(measureunits.get("request_body", {}).get("select") or "")
    material_group = next(p for p in presets if p["code_suffix"] == "query_material_group")
    assert material_group["path"] == "kapi/v2/gmc/mdr_goodsclass/getMalGoodsClass"
    assert "data" not in (material_group.get("request_body") or {})
    goods_class = next(p for p in presets if p["code_suffix"] == "query_goods_class")
    assert goods_class["path"] == "kapi/v2/gmc/mdr_goodsclass/getMalGoodsClass"
    assert goods_class.get("request_body", {}).get("pageSize") == 100
    assert "data" not in (goods_class.get("request_body") or {})
    customer = next(p for p in presets if p["code_suffix"] == "query_customer")
    assert customer["path"] == "kapi/v2/basedata/bd_customer/batchQuery"
    assert customer.get("request_body", {}).get("pageSize") == 100
    assert "__API_NUMBER__" not in material["path"]


def test_measureunits_preset_needs_upgrade_detects_legacy_path():
    from core.services.integration.kingdee_cosmic_api_presets import (
        measureunits_preset_needs_upgrade,
    )

    assert measureunits_preset_needs_upgrade("kapi/v2/basedata/bd_measureunits/batchQuery")
    assert measureunits_preset_needs_upgrade(
        "kapi/v2/basedata/bd_multimeasureunit/batchQuery"
    )
    assert measureunits_preset_needs_upgrade(
        "kapi/v2/basedata/bd_material/batchQuery",
        {"data": {}, "pageNo": 1, "pageSize": 100},
    )
    assert not measureunits_preset_needs_upgrade(
        "kapi/v2/basedata/bd_material/batchQuery",
        {
            "data": {},
            "pageNo": 1,
            "pageSize": 100,
            "select": "number,name,baseunit.number,baseunit.name",
        },
    )


def test_material_group_preset_needs_upgrade_detects_legacy_path():
    from core.services.integration.kingdee_cosmic_api_presets import (
        material_group_preset_needs_upgrade,
    )

    assert material_group_preset_needs_upgrade(
        "kapi/v2/basedata/bd_materialgroup/batchQuery"
    )
    assert not material_group_preset_needs_upgrade(
        "kapi/v2/gmc/mdr_goodsclass/getMalGoodsClass"
    )


def test_material_preset_needs_upgrade_when_select_missing():
    from core.services.integration.kingdee_cosmic_api_presets import (
        material_preset_needs_upgrade,
    )

    path = "kapi/v2/basedata/bd_material/batchQuery"
    assert material_preset_needs_upgrade(path, {"data": {}, "pageNo": 1, "pageSize": 100})
    assert not material_preset_needs_upgrade(
        path,
        {
            "data": {},
            "pageNo": 1,
            "pageSize": 100,
            "select": "number,name,baseunit.number,baseunit.name,group.number,group.name",
        },
    )


def test_kingdee_cosmic_mfg_presets_include_inventory_params_body():
    from core.services.integration.kingdee_cosmic_mfg_api_presets import (
        list_kingdee_cosmic_mfg_api_presets,
    )

    presets = list_kingdee_cosmic_mfg_api_presets()
    detail = next(p for p in presets if p["path"].endswith("getInventoryDetail"))
    body = detail.get("request_body") or {}
    assert "params" in body
    assert "org" in (body.get("params") or {})
    assert body.get("pageSize") == 100


def test_kingdee_cosmic_mfg_presets_include_production_aux_basedata():
    from core.services.integration.kingdee_cosmic_mfg_api_presets import (
        list_kingdee_cosmic_mfg_api_presets,
    )

    presets = list_kingdee_cosmic_mfg_api_presets()
    paths = {p["path"] for p in presets}
    assert "kapi/v2/basedata/bd_material/batchQuery" in paths
    assert "kapi/v2/basedata/bd_multimeasureunit/batchQuery" in paths
    assert "kapi/v2/basedata/bd_customer/query" in paths
    assert "kapi/v2/basedata/bd_supplier/query" in paths
    assert len([p for p in presets if "/basedata/" in p["path"]]) >= 12
    multi = next(p for p in presets if p["path"].endswith("bd_multimeasureunit/batchQuery"))
    assert "计量单位" in (multi.get("description") or "")
