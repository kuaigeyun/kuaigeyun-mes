"""BOM 子件行查询须同时匹配 bom_code 与 version。"""

from types import SimpleNamespace

from apps.kuaizhizao.utils.bom_helper import bom_component_lines_filter


def test_bom_component_lines_filter_matches_code_and_version():
    header = SimpleNamespace(tenant_id=1, bom_code="BOM-X-1.0", version="1.1")
    assert bom_component_lines_filter(header, 99) == {
        "tenant_id": 1,
        "material_id": 99,
        "deleted_at__isnull": True,
        "bom_code": "BOM-X-1.0",
        "version": "1.1",
    }


def test_bom_component_lines_filter_version_only_when_no_code():
    header = SimpleNamespace(tenant_id=2, bom_code=None, version="2.0")
    assert bom_component_lines_filter(header, 10) == {
        "tenant_id": 2,
        "material_id": 10,
        "deleted_at__isnull": True,
        "version": "2.0",
    }
