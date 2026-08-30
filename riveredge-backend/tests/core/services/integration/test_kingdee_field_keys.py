import importlib.util
import json
from pathlib import Path

_SRC = Path(__file__).resolve().parents[4] / "src"
_MODULE_PATH = _SRC / "core/services/integration/kingdee_field_keys.py"
_spec = importlib.util.spec_from_file_location("kingdee_field_keys_mod", _MODULE_PATH)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

extract_kingdee_field_keys = _mod.extract_kingdee_field_keys


def test_extract_field_keys_from_kdsvc_parameters_json_string():
    query = {
        "FormId": "SAL_SaleOrder",
        "FieldKeys": "FBillNo,FMaterialId.FNumber,FQty",
        "Limit": 2000,
    }
    body = {"parameters": [json.dumps(query, ensure_ascii=False)]}
    assert extract_kingdee_field_keys(body) == ["FBillNo", "FMaterialId.FNumber", "FQty"]


def test_extract_field_keys_from_parameters_dict():
    body = {
        "parameters": [
            {
                "FormId": "BD_Customer",
                "FieldKeys": "FNumber,FName",
            }
        ]
    }
    assert extract_kingdee_field_keys(body) == ["FNumber", "FName"]


def test_extract_field_keys_returns_none_when_missing():
    assert extract_kingdee_field_keys(None) is None
    assert extract_kingdee_field_keys({}) is None
    assert extract_kingdee_field_keys({"parameters": ["not-json"]}) is None
