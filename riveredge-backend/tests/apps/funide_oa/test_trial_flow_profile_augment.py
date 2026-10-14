"""试流 profile 增补：物料名称、供应商头字段。"""

from __future__ import annotations

from apps.funide_oa.trial_flow_profile import augment_funide_trial_flow_profile


def test_augment_adds_material_name_and_supplier_after_title_sort():
    base = {
        "header_fields": [
            {"key": "urgency_level", "label": "级别", "sort": 10, "type": "select"},
        ],
        "field_labels": {"urgency_level": "级别"},
    }
    out = augment_funide_trial_flow_profile(base)
    keys = [h["key"] for h in out["header_fields"]]
    assert "material_name" in keys
    assert "supplier_name" in keys
    by_key = {h["key"]: h for h in out["header_fields"]}
    assert by_key["material_name"]["sort"] == 5
    assert by_key["supplier_name"]["sort"] == 6


def test_augment_idempotent_when_keys_exist():
    base = {
        "header_fields": [
            {"key": "material_name", "label": "物料名称", "sort": 5},
            {"key": "supplier_name", "label": "供应商", "sort": 6},
        ],
    }
    out = augment_funide_trial_flow_profile(base)
    assert len(out["header_fields"]) == 2
