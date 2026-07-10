"""Tests for material source_config nesting normalization."""

from apps.kuaizhizao.utils.material_source_helper import (
    normalize_source_config_payload,
    resolve_computation_item_source_config,
)


def test_normalize_source_config_payload_flattens_double_nesting():
    raw = {
        "source_config": {
            "default_supplier_id": 30,
            "default_supplier_name": "深圳联创电子元器件有限公司",
        }
    }
    assert normalize_source_config_payload(raw) == {
        "default_supplier_id": 30,
        "default_supplier_name": "深圳联创电子元器件有限公司",
    }


def test_normalize_source_config_payload_keeps_flat_buy_config():
    raw = {
        "source_types": ["Buy"],
        "default_supplier_id": 30,
        "purchase_lead_time": 10,
    }
    assert normalize_source_config_payload(raw) == raw


def test_resolve_computation_item_source_config_from_legacy_snapshot():
    snapshot = {
        "source_type": "Buy",
        "source_config": {
            "source_config": {
                "default_supplier_id": 30,
                "default_supplier_name": "深圳联创电子元器件有限公司",
            }
        },
        "default_supplier_id": None,
        "default_supplier_name": None,
    }
    resolved = resolve_computation_item_source_config(snapshot)
    assert resolved["default_supplier_id"] == 30
    assert resolved["default_supplier_name"] == "深圳联创电子元器件有限公司"


def test_resolve_computation_item_source_config_prefers_top_level_fields():
    snapshot = {
        "source_type": "Buy",
        "source_config": {"default_supplier_id": 30},
        "default_supplier_id": 99,
        "purchase_lead_time": 5,
    }
    resolved = resolve_computation_item_source_config(snapshot)
    assert resolved["default_supplier_id"] == 99
    assert resolved["purchase_lead_time"] == 5
