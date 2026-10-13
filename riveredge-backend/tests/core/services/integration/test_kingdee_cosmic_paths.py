import importlib.util
from pathlib import Path

_SRC = Path(__file__).resolve().parents[4] / "src"
_PATHS = _SRC / "core/services/integration/kingdee_cosmic_paths.py"
_spec = importlib.util.spec_from_file_location("kingdee_cosmic_paths_mod", _PATHS)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
normalize = _mod.normalize_kingdee_cosmic_api_path
strip_base = _mod.strip_kingdee_cosmic_ierp_suffix_from_base


def test_strip_ierp_suffix_from_base():
    assert strip_base("https://tenant.kdgalaxy.com/ierp") == "https://tenant.kdgalaxy.com"
    assert strip_base("https://tenant.kdgalaxy.com") == "https://tenant.kdgalaxy.com"


def test_cosmic_url_no_double_ierp():
    base = strip_base("https://tenant.kdgalaxy.com/ierp")
    path = normalize("ierp/kapi/sys/bd_material/query")
    url = f"{base}/{path.lstrip('/')}"
    assert url == "https://tenant.kdgalaxy.com/ierp/kapi/sys/bd_material/query"


def test_normalize_sys_query_adds_ierp_prefix():
    assert normalize("kapi/sys/bd_material/query") == "ierp/kapi/sys/bd_material/query"
    assert normalize("ierp/kapi/sys/bd_material/query") == "ierp/kapi/sys/bd_material/query"


def test_rewrite_saved_supplier_sys_query_to_batch_query():
    rewrite = _mod.rewrite_basedata_sys_query_path
    assert rewrite("kapi/sys/bd_supplier/query") == "kapi/v2/basedata/bd_supplier/query"
    assert rewrite("kapi/v2/basedata/bd_supplier/batchQuery") == "kapi/v2/basedata/bd_supplier/batchQuery"
    assert rewrite("kapi/sys/bd_customer/query") == "kapi/v2/basedata/bd_customer/batchQuery"
    assert rewrite("kapi/sys/bd_warehouse/query") == "kapi/v2/basedata/bd_warehouse/batchQuery"


def test_normalize_cosmic_openapi_endpoint_fixes_v2_prefix():
    norm = _mod.normalize_cosmic_openapi_endpoint
    assert norm("v2/basedata/bd_supplier/query") == "kapi/v2/basedata/bd_supplier/query"
    assert norm("kapi/v2/basedata/b") == "kapi/v2/basedata/bd_supplier/query"


def test_strip_invalid_base_url_suffix():
    strip = _mod.strip_invalid_kingdee_cosmic_base_url_suffix
    assert (
        strip("https://lzhtech.test.kdgalaxy.com/kapi/v2/basedata/b")
        == "https://lzhtech.test.kdgalaxy.com"
    )


def test_normalize_oauth_path_unchanged():
    assert normalize("kapi/oauth2/getToken") == "kapi/oauth2/getToken"


def test_v2_body_wraps_data_when_missing():
    ensure = _mod.ensure_kingdee_v2_request_body
    url = "https://lzhtech.kdgalaxy.com/kapi/v2/basedata/bd_material/batchQuery"
    assert ensure(url, {}) == {"data": {}, "pageNo": 1, "pageSize": 100}
    assert ensure(url, {"data": {"number": ["A"]}, "pageSize": 20}) == {
        "data": {"number": ["A"]},
        "pageNo": 1,
        "pageSize": 20,
    }
    assert ensure("https://lzhtech.kdgalaxy.com/kapi/oauth2/getToken", {"client_id": "a"}) == {
        "client_id": "a"
    }


def test_v2_query_and_batchequery_also_get_paging():
    ensure = _mod.ensure_kingdee_v2_request_body
    assert ensure("https://x/kapi/v2/sm/sm_salorder/query", {}) == {
        "data": {},
        "pageNo": 1,
        "pageSize": 100,
    }
    assert ensure("https://x/kapi/v2/im/im_mdc_mftfeedorder/batcheQuery", {"data": {}}) == {
        "data": {},
        "pageNo": 1,
        "pageSize": 100,
    }
    # 写操作不塞分页
    assert ensure("https://x/kapi/v2/sm/sm_salorder/batchSubmit", {"data": []}) == {"data": []}


def test_v2_inventory_params_body_not_wrapped_as_data():
    ensure = _mod.ensure_kingdee_v2_request_body
    body = {"params": {"org": "100"}, "pageNo": 1, "pageSize": 100}
    assert ensure("https://x/kapi/v2/im/getInventoryDetail", body) == body
    assert ensure("https://x/kapi/v2/im/getInventorySum", {"params": {"org": "100"}}) == {
        "params": {"org": "100"},
        "pageNo": 1,
        "pageSize": 100,
    }
    # 旧错误包法应还原
    assert ensure(
        "https://x/kapi/v2/im/getInventoryDetail",
        {"data": {"params": {"org": "100"}}, "pageNo": 1, "pageSize": 100},
    ) == {"params": {"org": "100"}, "pageNo": 1, "pageSize": 100}


def test_warehouse_list_query_rewrites_to_batchquery_and_injects_org():
    prepare = _mod.prepare_kingdee_cosmic_outbound
    method, url, params, body = prepare(
        {"org_number": "WANG"},
        "https://x/kapi/v2/basedata/bd_warehouse/query",
        "GET",
        {},
        {"data": {}, "pageNo": 1, "pageSize": 1000},
    )
    assert method == "POST"
    assert url.endswith("/bd_warehouse/batchQuery")
    assert body == {
        "data": {"createorg_number": "WANG"},
        "pageNo": 1,
        "pageSize": 1000,
    }


def test_warehouse_batchquery_puts_createorg_in_data():
    prepare = _mod.prepare_kingdee_cosmic_outbound
    method, url, params, body = prepare(
        {},
        "https://x/kapi/v2/basedata/bd_warehouse/batchQuery",
        "POST",
        {},
        {"data": {}, "pageNo": 1, "pageSize": 1000},
    )
    assert method == "POST"
    assert body == {
        "data": {"createorg_number": "WANG"},
        "pageNo": 1,
        "pageSize": 1000,
    }


def test_warehouse_query_with_number_keeps_get_and_injects_param():
    prepare = _mod.prepare_kingdee_cosmic_outbound
    method, url, params, body = prepare(
        {"org_number": "WANG"},
        "https://x/kapi/v2/basedata/bd_warehouse/query",
        "GET",
        {"number": "CK01"},
        {},
    )
    assert method == "GET"
    assert url.endswith("/bd_warehouse/query")
    assert params["createorg_number"] == "WANG"
    assert params["number"] == "CK01"


def test_warehouse_body_keeps_existing_createorg():
    prepare = _mod.prepare_kingdee_cosmic_outbound
    method, url, params, body = prepare(
        {},
        "https://x/kapi/v2/basedata/bd_warehouse/batchQuery",
        "POST",
        {},
        {"data": {"createorg_number": "ORG01"}, "pageNo": 1, "pageSize": 1000},
    )
    assert body["data"]["createorg_number"] == "ORG01"
    assert body["pageSize"] == 1000


def test_project_row_by_select_reads_nested_group_and_baseunit():
    project = _mod.project_row_by_select
    row = {
        "number": "M001",
        "name": "螺丝",
        "modelnum": "M8",
        "baseunit": {"number": "kg", "name": "KG"},
        "group": {"number": "G01", "name": "紧固件"},
    }
    select = (
        "number,name,modelnum,baseunit.number,baseunit.name,group.number,group.name"
    ).split(",")
    out = project(row, select)
    assert out["number"] == "M001"
    assert out["name"] == "螺丝"
    assert out["modelnum"] == "M8"
    assert out["baseunit_number"] == "kg"
    assert out["baseunit_name"] == "KG"
    assert out["group_number"] == "G01"
    assert out["group_name"] == "紧固件"
    # 不得把 baseunit.number 误匹配成物料 number 后丢掉嵌套
    assert out.get("baseunit") is None
