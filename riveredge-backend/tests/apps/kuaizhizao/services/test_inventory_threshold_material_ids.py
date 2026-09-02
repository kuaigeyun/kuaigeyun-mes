"""库存预警规则 material_ids 匹配。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.inventory_threshold_resolver import pick_matching_rule


def _rule(**kwargs):
    defaults = {
        "alert_type": "low_stock",
        "is_enabled": True,
        "material_id": None,
        "material_ids": None,
        "material_group_id": None,
        "warehouse_id": None,
        "updated_at": "",
        "id": 1,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_pick_matching_rule_material_ids():
    rules = [
        _rule(id=1, material_ids=[10, 20], material_group_id=3),
        _rule(id=2, material_group_id=3),
    ]
    matched = pick_matching_rule(
        rules,
        alert_type="low_stock",
        material_id=20,
        warehouse_id=None,
        material_group_id=3,
    )
    assert matched is not None
    assert matched.id == 1


def test_pick_matching_rule_material_ids_not_in_list():
    rules = [_rule(id=1, material_ids=[10, 20])]
    matched = pick_matching_rule(
        rules,
        alert_type="low_stock",
        material_id=99,
        warehouse_id=None,
        material_group_id=None,
    )
    assert matched is None
