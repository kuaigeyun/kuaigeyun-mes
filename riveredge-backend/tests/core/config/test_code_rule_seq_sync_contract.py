"""编码规则序号校准契约：页面、实体映射、派生表三者一致。"""

import importlib

from core.models.model_fields import model_has_field

from core.config.code_rule_entity_models import ENTITY_MODEL_BY_RULE_CODE
from core.config.code_rule_pages import (
    CODE_RULE_PAGES,
    RULE_CODE_ENTITY_FOR_SEQ_SYNC,
    build_rule_code_entity_for_seq_sync,
)


def test_build_rule_code_entity_for_seq_sync_covers_all_auto_generate_pages():
    auto_rule_codes = sorted(
        (page.get("rule_code") or "").strip()
        for page in CODE_RULE_PAGES
        if page.get("auto_generate") and (page.get("rule_code") or "").strip()
    )
    built = build_rule_code_entity_for_seq_sync()
    assert sorted(built.keys()) == auto_rule_codes
    assert built == RULE_CODE_ENTITY_FOR_SEQ_SYNC


def test_entity_models_are_importable():
    for rule_code, (module_path, class_name, attr_name) in RULE_CODE_ENTITY_FOR_SEQ_SYNC.items():
        mod = importlib.import_module(module_path)
        model_cls = getattr(mod, class_name)
        assert model_has_field(model_cls, attr_name), (
            f"{rule_code} missing field {attr_name} on {class_name}"
        )


def test_quotation_uses_series_code_for_seq_sync():
    cfg = RULE_CODE_ENTITY_FOR_SEQ_SYNC["QUOTATION_CODE"]
    assert cfg[2] == "quotation_series_code"


def test_entity_registry_matches_auto_pages():
    auto_pages = {
        (page.get("rule_code") or "").strip()
        for page in CODE_RULE_PAGES
        if page.get("auto_generate") and (page.get("rule_code") or "").strip()
    }
    assert set(ENTITY_MODEL_BY_RULE_CODE.keys()) == auto_pages
