"""需求计算 document_action_policy 单元测试。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.document_action_policy.demand_computation import (
    derive_demand_computation_capabilities,
)


def _comp(status: str):
    return SimpleNamespace(computation_status=status)


def test_execute_and_recompute_status_gates():
    exec_caps = derive_demand_computation_capabilities(_comp("进行中"))
    assert exec_caps.execute.allowed
    assert not exec_caps.recompute.allowed

    done_caps = derive_demand_computation_capabilities(_comp("完成"))
    assert not done_caps.execute.allowed
    assert done_caps.recompute.allowed
    assert done_caps.compare.allowed
    assert done_caps.export.allowed
