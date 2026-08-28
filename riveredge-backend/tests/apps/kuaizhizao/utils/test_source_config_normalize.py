"""Tests for material source_config nesting normalization."""

from types import SimpleNamespace

from apps.kuaizhizao.utils.material_source_helper import (
    is_make_and_buy_material,
    normalize_source_config_payload,
    resolve_computation_item_source_config,
    resolve_material_purchase_line_unit_price,
    resolve_mrp_supply_source_type,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_MAKE,
)


def _material(**kwargs):
    defaults = {
        "source_type": SOURCE_TYPE_MAKE,
        "source_config": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_resolve_mrp_supply_source_type_make_only():
    m = _material(source_type=SOURCE_TYPE_MAKE, source_config={"source_types": ["Make"]})
    assert resolve_mrp_supply_source_type(m) == SOURCE_TYPE_MAKE


def test_resolve_mrp_supply_source_type_buy_only():
    m = _material(source_type=SOURCE_TYPE_BUY, source_config={"source_types": ["Buy"]})
    assert resolve_mrp_supply_source_type(m) == SOURCE_TYPE_BUY


def test_resolve_mrp_supply_source_type_dual_make_buy_follows_primary_make():
    m = _material(
        source_type=SOURCE_TYPE_MAKE,
        source_config={"source_types": ["Make", "Buy"]},
    )
    assert is_make_and_buy_material(m) is True
    assert resolve_mrp_supply_source_type(m) == SOURCE_TYPE_MAKE


def test_resolve_mrp_supply_source_type_dual_make_buy_follows_primary_buy():
    m = _material(
        source_type=SOURCE_TYPE_BUY,
        source_config={"source_types": ["Make", "Buy"]},
    )
    assert is_make_and_buy_material(m) is True
    assert resolve_mrp_supply_source_type(m) == SOURCE_TYPE_BUY


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


def test_resolve_material_purchase_line_unit_price_from_computation_snapshot():
    material = _material(
        source_type=SOURCE_TYPE_BUY,
        source_config={"purchase_price": 8},
        defaults={"defaultPurchasePrice": 12},
    )
    price = resolve_material_purchase_line_unit_price(
        material=material,
        source_config={"purchase_price": 5.5},
    )
    assert price == 5.5


def test_resolve_material_purchase_line_unit_price_from_material_defaults():
    material = _material(
        source_type=SOURCE_TYPE_BUY,
        source_config={"purchase_price": 8},
        defaults={"defaultPurchasePrice": 12, "defaultPurchasePriceType": "tax_exclusive"},
    )
    price = resolve_material_purchase_line_unit_price(material=material)
    assert price == 12


def test_resolve_material_purchase_line_unit_price_converts_tax_inclusive_default():
    material = _material(
        source_type=SOURCE_TYPE_BUY,
        defaults={
            "defaultPurchasePrice": 113,
            "defaultPurchasePriceType": "tax_inclusive",
            "finance": {"defaultTaxRate": 13},
        },
    )
    price = resolve_material_purchase_line_unit_price(material=material)
    assert price == 100
