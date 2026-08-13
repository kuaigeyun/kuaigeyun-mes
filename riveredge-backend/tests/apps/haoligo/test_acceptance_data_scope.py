"""设备验收单厂外厂家数据范围资源键。"""

from apps.haoligo.api._data_scope import (
    RESOURCE_EQUIPMENT_ACCEPTANCE,
    RESOURCE_INJECTION_ACCEPTANCE,
    acceptance_data_scope_resource,
)


def test_acceptance_data_scope_resource_by_family():
    assert acceptance_data_scope_resource("injection") == RESOURCE_INJECTION_ACCEPTANCE
    assert acceptance_data_scope_resource("general") == RESOURCE_EQUIPMENT_ACCEPTANCE
    assert acceptance_data_scope_resource("") == RESOURCE_EQUIPMENT_ACCEPTANCE
