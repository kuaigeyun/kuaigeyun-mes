"""装箱绑定 document_action_policy 单元测试。"""

from datetime import datetime
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.packing_binding import (
    assert_packing_binding_capability,
    derive_packing_binding_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def test_active_binding_all_allowed():
    caps = derive_packing_binding_capabilities(SimpleNamespace(deleted_at=None))
    assert caps.update.allowed
    assert caps.delete.allowed
    assert caps.print.allowed


def test_deleted_binding_denied():
    caps = derive_packing_binding_capabilities(SimpleNamespace(deleted_at=datetime.now()))
    assert not caps.print.allowed


def test_assert_delete_on_deleted_raises():
    with pytest.raises(BusinessLogicError):
        assert_packing_binding_capability(
            SimpleNamespace(deleted_at=datetime.now()),
            "delete",
        )
