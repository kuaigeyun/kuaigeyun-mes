import sys
import types

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.services.business_config_service import (
    _build_process_registry_schema,
    _build_parameter_registry_schema,
    _build_process_registry_meta_schema,
    _build_parameter_registry_meta_schema,
    _build_process_registry_param_meta_schema,
    _build_parameter_registry_param_meta_schema,
    _build_process_registry_control_meta_schema,
    _build_parameter_registry_control_meta_schema,
)


def _assert_registry_shape_consistent(
    registry: dict,
    category_meta: dict,
    param_meta: dict,
    control_meta: dict,
):
    # 分类文案可为子集（允许前端 fallback），但不允许出现无效分类
    assert set(category_meta.keys()).issubset(set(registry.keys()))

    # 参数文案元数据与控件元数据必须完整覆盖 registry
    assert set(param_meta.keys()) == set(registry.keys())
    assert set(control_meta.keys()) == set(registry.keys())

    for category, keys in registry.items():
        assert set(param_meta[category].keys()) == set(keys)
        assert set(control_meta[category].keys()) == set(keys)
        for key in keys:
            ctrl = control_meta[category][key]
            assert ctrl.get("type") in {"boolean", "number", "string", "color"}


@pytest.mark.unit
def test_process_registry_schema_contract():
    _assert_registry_shape_consistent(
        _build_process_registry_schema(),
        _build_process_registry_meta_schema(),
        _build_process_registry_param_meta_schema(),
        _build_process_registry_control_meta_schema(),
    )


@pytest.mark.unit
def test_parameter_registry_schema_contract():
    _assert_registry_shape_consistent(
        _build_parameter_registry_schema(),
        _build_parameter_registry_meta_schema(),
        _build_parameter_registry_param_meta_schema(),
        _build_parameter_registry_control_meta_schema(),
    )
