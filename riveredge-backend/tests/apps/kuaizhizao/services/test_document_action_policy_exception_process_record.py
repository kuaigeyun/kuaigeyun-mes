"""异常处理记录 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.exception_process_record import (
    assert_exception_process_record_capability,
    derive_exception_process_record_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def test_active_cancel_allowed():
    caps = derive_exception_process_record_capabilities(SimpleNamespace(process_status="processing"))
    assert caps.cancel.allowed
    assert caps.print.allowed


def test_terminal_cancel_denied():
    caps = derive_exception_process_record_capabilities(SimpleNamespace(process_status="resolved"))
    assert not caps.cancel.allowed


def test_assert_cancel_on_resolved_raises():
    with pytest.raises(BusinessLogicError):
        assert_exception_process_record_capability(
            SimpleNamespace(process_status="cancelled"),
            "cancel",
        )
