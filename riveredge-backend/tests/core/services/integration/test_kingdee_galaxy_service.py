import importlib.util
from pathlib import Path

import pytest

_SRC = Path(__file__).resolve().parents[4] / "src"
_MODULE_PATH = _SRC / "core/services/integration/kingdee_galaxy_service.py"
_spec = importlib.util.spec_from_file_location("kingdee_galaxy_service_mod", _MODULE_PATH)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

normalize_kingdee_galaxy_base_url = _mod.normalize_kingdee_galaxy_base_url
build_kingdee_login_url = _mod.build_kingdee_login_url
build_kingdee_login_payload = _mod.build_kingdee_login_payload
parse_kingdee_login_response = _mod.parse_kingdee_login_response


def test_normalize_kingdee_galaxy_base_url_appends_slash():
    assert normalize_kingdee_galaxy_base_url("https://erp.example.com/K3Cloud") == (
        "https://erp.example.com/K3Cloud/"
    )


def test_normalize_kingdee_galaxy_base_url_rejects_empty():
    with pytest.raises(ValueError):
        normalize_kingdee_galaxy_base_url("")


def test_build_kingdee_login_url():
    url = build_kingdee_login_url("https://erp.example.com/k3cloud/")
    assert url.endswith("LoginByAppSecret.common.kdsvc")


def test_build_kingdee_login_payload_parameter_order():
    payload = build_kingdee_login_payload(
        acct_id="acct1",
        username="admin",
        app_id="app1",
        app_secret="sec1",
        lcid="2052",
    )
    assert payload["parameters"] == ["acct1", "admin", "app1", "sec1", "2052"]
    assert payload["v"] == "1.0"


def test_parse_kingdee_login_response_success_by_login_result_type():
    ok, msg, sid = parse_kingdee_login_response(
        {"Result": {"LoginResultType": 1, "ResponseStatus": {"IsSuccess": True}}},
        session_id="sess-1",
    )
    assert ok is True
    assert "成功" in msg
    assert sid == "sess-1"


def test_parse_kingdee_login_response_failure_with_errors():
    ok, msg, sid = parse_kingdee_login_response(
        {
            "Result": {
                "ResponseStatus": {
                    "IsSuccess": False,
                    "Errors": [{"Message": "应用密钥不正确"}],
                }
            }
        }
    )
    assert ok is False
    assert "应用密钥不正确" in msg
    assert sid is None
