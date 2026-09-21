"""document_push_codes 单测。"""

from core.services.integration.document_push_codes import (
    DEFAULT_UNIT_NUMBER,
    apply_unit_code_map,
    extract_unit_code_map_from_conversion,
)


def test_apply_unit_code_map_builtin_piece():
    assert apply_unit_code_map("个") == "006"
    assert apply_unit_code_map("kg") == "004"


def test_apply_unit_code_map_api_map_overrides_builtin():
    assert apply_unit_code_map("个", {"个": "999"}) == "999"


def test_extract_unit_code_map_from_conversion():
    entries = [
        {"field_name": "source_type", "mapping": {"1": "Make"}},
        {"field_name": "FUnitId.FNumber", "mapping": {"个": "006", "台": "001"}},
        {"field_name": "unit", "mapping": {"箱": "010"}},
    ]
    got = extract_unit_code_map_from_conversion(entries)
    assert got == {"个": "006", "台": "001", "箱": "010"}


def test_extract_unit_code_map_ignores_flat_dict():
    assert extract_unit_code_map_from_conversion({"个": "006"}) == {}


def test_extract_unit_code_map_case_insensitive_field():
    got = extract_unit_code_map_from_conversion(
        [{"field_name": "fbaseunitid.fnumber", "mapping": {"Pcs": "006"}}]
    )
    assert got == {"Pcs": "006"}


def test_default_unit_number():
    assert DEFAULT_UNIT_NUMBER == "006"
