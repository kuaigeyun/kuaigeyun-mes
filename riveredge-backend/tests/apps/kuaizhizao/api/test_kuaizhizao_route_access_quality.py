"""质检/仓储执行 API 路径 → manifest 模块映射回归。"""

import pytest

from apps.kuaizhizao.api._kuaizhizao_route_access import (
    resolve_kuaizhizao_quality_execution_module,
    resolve_kuaizhizao_warehouse_execution_module,
    resolve_kuaizhizao_module_action,
)


@pytest.mark.parametrize(
    ("path", "module"),
    [
        ("/api/v1/apps/kuaizhizao/process-inspections", "quality-management-process-inspection"),
        ("/api/v1/apps/kuaizhizao/process-inspections/statistics", "quality-management-process-inspection"),
        ("/api/v1/apps/kuaizhizao/incoming-inspections", "quality-management-incoming-inspection"),
        ("/api/v1/apps/kuaizhizao/finished-goods-inspections", "quality-management-finished-goods-inspection"),
        ("/api/v1/apps/kuaizhizao/purchase-receipts", "inbound"),
        ("/api/v1/apps/kuaizhizao/production-returns/1/print", "inbound"),
    ],
)
def test_quality_and_warehouse_execution_path_modules(path: str, module: str) -> None:
    resolver = (
        resolve_kuaizhizao_quality_execution_module
        if "inspection" in path
        else resolve_kuaizhizao_warehouse_execution_module
    )
    assert resolver(path) == module


def test_conduct_maps_to_update() -> None:
    action = resolve_kuaizhizao_module_action(
        "POST",
        "/api/v1/apps/kuaizhizao/process-inspections/1/conduct",
        module_code="quality-management-process-inspection",
    )
    assert action == "update"
