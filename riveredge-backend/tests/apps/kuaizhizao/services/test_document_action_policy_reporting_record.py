"""报工记录 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.reporting_record import (
    assert_reporting_record_capability,
    derive_reporting_record_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def test_pending_update_delete():
    caps = derive_reporting_record_capabilities(SimpleNamespace(status="pending"))
    assert caps.update.allowed
    assert caps.delete.allowed
    assert not caps.revoke_approval.allowed


def test_approved_revoke():
    caps = derive_reporting_record_capabilities(SimpleNamespace(status="approved"))
    assert caps.revoke_approval.allowed
    assert not caps.update.allowed


def test_assert_revoke_on_pending_raises():
    with pytest.raises(BusinessLogicError):
        assert_reporting_record_capability(SimpleNamespace(status="pending"), "revoke_approval")
