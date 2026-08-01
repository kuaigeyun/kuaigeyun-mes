"""客户/供应商同名规范化与校验文案单测。"""

from apps.master_data.services.supply_chain_service import _normalize_partner_name


def test_normalize_partner_name_strips_whitespace():
    assert _normalize_partner_name("  五金商  ") == "五金商"
    assert _normalize_partner_name(None) == ""
    assert _normalize_partner_name("") == ""
