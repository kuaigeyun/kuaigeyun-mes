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


def test_conduct_maps_to_execute() -> None:
    action = resolve_kuaizhizao_module_action(
        "POST",
        "/api/v1/apps/kuaizhizao/process-inspections/1/conduct",
        module_code="quality-management-process-inspection",
    )
    assert action == "execute"


def test_revoke_conduct_maps_to_update() -> None:
    action = resolve_kuaizhizao_module_action(
        "POST",
        "/api/v1/apps/kuaizhizao/process-inspections/1/revoke-conduct",
        module_code="quality-management-process-inspection",
    )
    assert action == "update"


def test_ensure_for_purchase_receipt_defaults_to_create_action() -> None:
    """路径本身仍解析为 create；路由依赖另放行 inbound:execute（见 require_kuaizhizao_quality_execution_access）。"""
    action = resolve_kuaizhizao_module_action(
        "POST",
        "/api/v1/apps/kuaizhizao/incoming-inspections/ensure-for-purchase-receipt/12",
        module_code="quality-management-incoming-inspection",
    )
    assert action == "create"
    assert (
        resolve_kuaizhizao_quality_execution_module(
            "/api/v1/apps/kuaizhizao/incoming-inspections/ensure-for-purchase-receipt/12"
        )
        == "quality-management-incoming-inspection"
    )


def test_quality_management_router_mounts_dashboard_routes() -> None:
    from apps.kuaizhizao.api.productions.quality_management import router as qm

    paths = {getattr(r, "path", "") for r in qm.routes}
    assert "/quality/inspection-center-summary" in paths
    assert "/quality/anomalies" in paths
    assert "/quality/statistics" in paths
    assert "/inspection-plans" in paths
    assert "/quality-standards" in paths
