"""audit.resource 须与 manifest 模块权限前缀一致（uni-audit 鉴权真源）。"""

from core.config.audit_registry import entry_by_entity_type
from core.api.uni_audit.uni_audit import _uni_audit_required_permission_codes


def test_purchase_request_audit_resource_matches_module_permissions():
    entry = entry_by_entity_type("purchase_request")
    assert entry is not None
    assert entry.resource == "kuaizhizao:purchase-requisition"

    codes = _uni_audit_required_permission_codes(entry.resource, "approve")
    assert "kuaizhizao:purchase-requisition:audit" in codes
    assert "kuaizhizao:purchase-requisition:approve" in codes
