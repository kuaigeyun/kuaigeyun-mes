"""document_push_mapping 单测。"""

from core.services.integration.document_push_mapping import apply_field_map, set_path


def test_set_path_list_index():
    model: dict = {"FTreeEntity": [{}]}
    set_path(model, "FTreeEntity.0.FUnitId.FNumber", "006")
    assert model["FTreeEntity"][0]["FUnitId"]["FNumber"] == "006"


def test_set_path_rebuilds_bad_intermediate():
    model: dict = {"FTreeEntity": [{"FUnitId": "bad"}]}
    set_path(model, "FTreeEntity.0.FUnitId.FNumber", "006")
    assert model["FTreeEntity"][0]["FUnitId"]["FNumber"] == "006"


def test_apply_field_map_skips_empty():
    model: dict = {"FTreeEntity": [{}]}
    apply_field_map(
        model,
        {"unit_number": "FTreeEntity.0.FUnitId.FNumber", "qty": "FTreeEntity.0.FQty"},
        lambda k: "" if k == "unit_number" else 1.5,
    )
    assert "FUnitId" not in model["FTreeEntity"][0]
    assert model["FTreeEntity"][0]["FQty"] == 1.5
