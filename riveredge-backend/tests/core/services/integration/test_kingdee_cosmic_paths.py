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
    assert rewrite("kapi/v2/basedata/bd_supplier/batchQuery") == "kapi/v2/basedata/bd_supplier/query"
    assert rewrite("kapi/sys/bd_customer/query") == "kapi/v2/basedata/bd_customer/batchQuery"
    assert rewrite("kapi/v2/basedata/bd_supplier/batchQuery") == (
        "kapi/v2/basedata/bd_supplier/batchQuery"
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
