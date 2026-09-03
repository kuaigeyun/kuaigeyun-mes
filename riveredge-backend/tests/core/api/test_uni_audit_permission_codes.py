"""uni-audit 审核门控与前端 hasReviewPermission 对齐。"""

from core.api.uni_audit.uni_audit import _uni_audit_required_permission_codes


def test_review_actions_accept_any_review_permission() -> None:
    codes = _uni_audit_required_permission_codes("kuaizhizao:sales-order", "approve")
    assert codes == [
        "kuaizhizao:sales-order:approve",
        "kuaizhizao:sales-order:audit",
        "kuaizhizao:sales-order:reject",
    ]
    assert _uni_audit_required_permission_codes("kuaizhizao:sales-order", "reject") == codes


def test_non_review_actions_stay_exact() -> None:
    assert _uni_audit_required_permission_codes("kuaizhizao:sales-order", "submit") == [
        "kuaizhizao:sales-order:submit"
    ]
    assert _uni_audit_required_permission_codes("kuaizhizao:sales-order", "revoke") == [
        "kuaizhizao:sales-order:revoke"
    ]
