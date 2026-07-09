from apps.haoligo.utils.finance_spec_key import normalize_finance_material_spec_key


def test_normalize_finance_material_spec_key_strips_spaces_and_brackets():
    assert normalize_finance_material_spec_key("5000 B2 5GY 125") == "5000B25GY125"
    assert normalize_finance_material_spec_key("4002SGO 4Y(L12)") == "4002SGO4YL12"
    assert normalize_finance_material_spec_key("4002SGO 4Y（L12）") == "4002SGO4YL12"
    assert normalize_finance_material_spec_key("  EP5001【Y05】  ") == "EP5001Y05"
