"""职能域常量与解析。"""

import pytest

from core.config.functional_domain_spec import (
    normalize_functional_domain,
    resolve_functional_domain_from_role_code,
)


def test_resolve_functional_domain_from_preset_role_code():
    assert resolve_functional_domain_from_role_code("WAREHOUSE_MANAGER") == "warehouse"
    assert resolve_functional_domain_from_role_code("CK001") is None


def test_normalize_functional_domain_rejects_invalid():
    with pytest.raises(ValueError):
        normalize_functional_domain("invalid")
