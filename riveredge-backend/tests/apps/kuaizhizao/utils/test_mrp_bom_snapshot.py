"""MRP BOM 快照解析单元测试"""

from apps.kuaizhizao.utils.mrp_bom_snapshot import (
    bom_expand_kwargs_from_work_order,
    normalize_material_bom_versions,
    resolve_mrp_version_for_material,
)


class _Wo:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_normalize_material_bom_versions():
    assert normalize_material_bom_versions({"633": "2.0", 634: ""}) == {"633": "2.0"}


def test_resolve_per_material_version():
    params = {"material_bom_versions": {"633": "1.0"}, "bom_version": "9.9"}
    v, use_default = resolve_mrp_version_for_material(params, 633, seed_material_ids={100})
    assert v == "1.0"
    assert use_default is False


def test_resolve_global_seed_only():
    params = {"bom_version": "2.0"}
    v, use_default = resolve_mrp_version_for_material(params, 633, seed_material_ids={633})
    assert v == "2.0"
    assert use_default is False


def test_resolve_subassembly_default_when_mrp_params():
    params = {"bom_version": "2.0", "material_bom_versions": {"633": "1.0"}}
    v, use_default = resolve_mrp_version_for_material(params, 999, seed_material_ids={633})
    assert v is None
    assert use_default is True


def test_bom_expand_kwargs_from_work_order():
    wo = _Wo(bom_version="2.0", material_bom_versions={"633": "1.0"}, bom_id=10)
    kw = bom_expand_kwargs_from_work_order(wo)
    assert kw["bom_version"] == "2.0"
    assert kw["material_bom_versions"] == {"633": "1.0"}
    assert kw["use_default_bom"] is False


def test_bom_expand_kwargs_empty_without_snapshot():
    wo = _Wo(product_id=1)
    assert bom_expand_kwargs_from_work_order(wo) == {}
