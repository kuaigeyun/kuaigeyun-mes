"""SensitiveWordService 契约：命中、白名单、跳过字段、夹杂符号、短词忽略。"""

import pytest

from core.services.content.sensitive_word_service import (
    SensitiveWordService,
    should_skip_field_name,
)
from infra.exceptions.exceptions import ValidationError


def _u(*codes: int) -> str:
    return "".join(chr(code) for code in codes)


CN = _u(0x50BB, 0x903C)
EN = _u(0x66, 0x75, 0x63, 0x6B)
GAN = _u(0x88AB, 0x5E72)
CAO = _u(0x64CD)
DRY = _u(0x88AB, 0x5E72, 0x71E5)
REUSE = _u(0x5E9F, 0x7269, 0x5229, 0x7528)


def _service() -> SensitiveWordService:
    return SensitiveWordService(
        words=[CN, EN, GAN, CAO, "sb", "ass"],
        allowlist=[DRY, REUSE],
    )


def test_finds_chinese_insult():
    assert _service().find_sensitive_word(f"物料备注{CN}测试") == CN


def test_finds_english_insult_as_word():
    assert _service().find_sensitive_word(f"what the {EN} happened") == EN


def test_spaced_and_punctuated_chinese():
    service = _service()
    assert service.find_sensitive_word(f"{CN[0]} {CN[1]}") == CN
    assert service.find_sensitive_word(f"{CN[0]}*{CN[1]}") == CN
    assert service.find_sensitive_word(f"{CN[0]}\u00b7{CN[1]}") == CN


def test_allowlist_covers_compound():
    service = _service()
    assert service.find_sensitive_word(f"{DRY}工艺") is None
    assert service.find_sensitive_word(f"你{GAN}了") == GAN


def test_short_words_are_ignored():
    service = _service()
    assert service.find_sensitive_word(CAO) is None
    assert service.find_sensitive_word("sb") is None
    assert service.find_sensitive_word("USB接口") is None


def test_ascii_requires_word_boundary():
    assert _service().find_sensitive_word("classification") is None


def test_empty_and_blank_are_clean():
    service = _service()
    assert service.find_sensitive_word("") is None
    assert service.find_sensitive_word("   ") is None
    assert service.find_sensitive_word(None) is None


def test_assert_text_clean_raises():
    with pytest.raises(ValidationError) as exc:
        _service().assert_text_clean(f"这里有{CN}")
    assert exc.value.code == "VALIDATION_ERROR"
    assert exc.value.status_code == 422
    assert exc.value.details["matched"] == CN
    assert "不当用语" in exc.value.message


def test_skip_password_and_token_fields():
    service = _service()
    assert service.find_in_payload({"password": f"{EN}you", "notes": "正常备注"}) is None
    assert service.find_in_payload({"refresh_token": EN, "name": "ok"}) is None
    hit = service.find_in_payload({"notes": CN, "password": "x"})
    assert hit == ("notes", CN)


def test_should_skip_field_name():
    assert should_skip_field_name("password") is True
    assert should_skip_field_name("NEW_PASSWORD") is True
    assert should_skip_field_name("access_token") is True
    assert should_skip_field_name("notes") is False


def test_nested_payload_path():
    hit = _service().find_in_payload({"header": {"lines": [{"remark": CN}]}})
    assert hit == ("header.lines[0].remark", CN)


def test_pack_loads_without_plaintext_sources():
    service = SensitiveWordService()
    assert service._word_count > 0
    assert service.find_sensitive_word(f"备注{CN}") == CN
    assert service.find_sensitive_word(f"{DRY}工艺") is None
