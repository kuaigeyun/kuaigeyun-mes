from core.config.permission_action_spec import canonical_action, is_standard_action


def test_alias_action_mapping():
    assert canonical_action("view") == "read"
    assert canonical_action("confirm") == "approve"
    assert canonical_action("withdraw") == "revoke"
    assert canonical_action("send") == "submit"


def test_standard_action_guard():
    assert is_standard_action("read")
    assert is_standard_action("view")
    assert is_standard_action("execute")
    assert not is_standard_action("unknown_action")
