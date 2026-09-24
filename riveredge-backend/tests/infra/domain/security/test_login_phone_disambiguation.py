"""登录手机号歧义消解规则单测。"""

from types import SimpleNamespace

from infra.domain.security.login_phone_disambiguation import (
    apply_phone_disambiguation,
    filter_same_entity_users,
    needs_phone_disambiguation,
    phones_same_entity,
)


def _user(tenant_id: int, phone: str | None) -> SimpleNamespace:
    return SimpleNamespace(id=tenant_id, tenant_id=tenant_id, username="001", phone=phone)


def test_phones_same_entity_both_empty():
    assert phones_same_entity(None, "") is True
    assert phones_same_entity("", None) is True


def test_phones_same_entity_same_number():
    assert phones_same_entity("13812345678", "138-1234-5678") is True


def test_phones_same_entity_different():
    assert phones_same_entity("13812345678", "13912345678") is False
    assert phones_same_entity("13812345678", None) is False


def test_needs_disambiguation_all_no_phone():
    users = [_user(1, None), _user(2, None)]
    assert needs_phone_disambiguation(users) is False


def test_needs_disambiguation_same_phone():
    users = [_user(1, "13812345678"), _user(2, "13812345678")]
    assert needs_phone_disambiguation(users) is False


def test_needs_disambiguation_different_phones():
    users = [_user(1, "13812345678"), _user(2, "13998765432")]
    assert needs_phone_disambiguation(users) is True


def test_needs_disambiguation_mixed_empty_and_phone():
    users = [_user(1, None), _user(2, "13812345678")]
    assert needs_phone_disambiguation(users) is True


def test_filter_by_phone_last4():
    users = [_user(1, "13812345678"), _user(2, "13900005678"), _user(3, None)]
    matched, primary = apply_phone_disambiguation(users, "5678")
    assert primary is not None
    assert {u.tenant_id for u in matched} == {1, 2}


def test_filter_same_entity_users():
    ref = _user(1, "13812345678")
    candidates = [
        _user(1, "13812345678"),
        _user(2, "13912345678"),
        _user(3, "13812345678"),
    ]
    same = filter_same_entity_users(ref, candidates)
    assert {u.tenant_id for u in same} == {1, 3}
