"""敏感词检测：开源词库 + AC 自动机，写入请求唯一审核入口。"""

from __future__ import annotations

import unicodedata
from pathlib import Path
from typing import Any, Iterable, Iterator, Optional

import ahocorasick
from loguru import logger

from core.services.content.lexicon_pack import PACK_FILENAME, load_pack, read_source_lines
from infra.exceptions.exceptions import ValidationError

_LEXICON_DIR = Path(__file__).resolve().parents[2] / "data" / "sensitive_words"
_ALLOWLIST_FILE = "allowlist.txt"

_ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff\u00ad"), None)
_SKIP_CHARS = frozenset(" \t\n\r*_·•-—~.|/\\`'\",;:!?()[]{}<>@#$%^&+=　")

_SKIP_FIELD_NAMES = frozenset(
    {
        "password",
        "token",
        "secret",
        "access_key",
        "refresh_token",
        "authorization",
        "private_key",
        "connection_string",
        "old_password",
        "new_password",
        "confirm_password",
        "client_secret",
        "app_secret",
        "api_key",
        "apikey",
    }
)
_SKIP_FIELD_SUFFIXES = ("_password", "_token", "_secret", "_key")

_REJECT_MESSAGE = "内容包含不当用语，请修改后重试"

_CJK_START = "\u4e00"
_CJK_END = "\u9fff"


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(_ZERO_WIDTH)
    return text.lower()


def compact_text(text: str) -> str:
    return "".join(ch for ch in text if ch not in _SKIP_CHARS)


def _has_cjk(text: str) -> bool:
    return any(_CJK_START <= ch <= _CJK_END for ch in text)


def _is_ascii_word(text: str) -> bool:
    return bool(text) and all(ch.isascii() and (ch.isalnum() or ch in "-_") for ch in text)


def _ascii_word_bounded(text: str, end_index: int, word: str) -> bool:
    start = end_index - len(word) + 1
    before = text[start - 1] if start > 0 else ""
    after = text[end_index + 1] if end_index + 1 < len(text) else ""
    return not ((before and before.isalnum()) or (after and after.isalnum()))


def should_skip_field_name(name: str) -> bool:
    key = name.lower()
    if key in _SKIP_FIELD_NAMES:
        return True
    return any(key.endswith(suffix) for suffix in _SKIP_FIELD_SUFFIXES)


def _accept_lexicon_word(word: str) -> bool:
    if len(word) < 2:
        return False
    if _is_ascii_word(word) and len(word) < 3:
        return False
    return True


class SensitiveWordService:
    """进程内单例：启动时建自动机，请求期只做匹配。"""

    _instance: Optional["SensitiveWordService"] = None

    def __init__(
        self,
        words: Optional[Iterable[str]] = None,
        allowlist: Optional[Iterable[str]] = None,
        lexicon_dir: Optional[Path] = None,
    ) -> None:
        if words is None:
            directory = lexicon_dir or _LEXICON_DIR
            raw_words = load_pack(directory / PACK_FILENAME)
            raw_allow = read_source_lines(directory / _ALLOWLIST_FILE)
        else:
            raw_words = list(words)
            raw_allow = list(allowlist or [])

        self._allowlist = {normalize_text(item) for item in raw_allow if item.strip()}
        accepted: set[str] = set()
        for item in raw_words:
            normalized = normalize_text(item)
            if not _accept_lexicon_word(normalized):
                continue
            if normalized in self._allowlist:
                continue
            accepted.add(normalized)

        automaton = ahocorasick.Automaton()
        for word in accepted:
            automaton.add_word(word, word)
        if accepted:
            automaton.make_automaton()
        self._automaton = automaton
        self._word_count = len(accepted)
        logger.info("敏感词自动机已加载 words={}", self._word_count)

    @classmethod
    def instance(cls) -> "SensitiveWordService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        cls._instance = None

    def find_sensitive_word(self, text: Optional[str]) -> Optional[str]:
        if not text or not str(text).strip():
            return None
        if self._word_count == 0:
            return None
        normalized = normalize_text(str(text))
        hit = self._first_hit(normalized, cjk_only=False)
        if hit:
            return hit
        compacted = compact_text(normalized)
        if compacted != normalized:
            return self._first_hit(compacted, cjk_only=True)
        return None

    def assert_text_clean(self, text: Optional[str]) -> None:
        matched = self.find_sensitive_word(text)
        if matched:
            raise ValidationError(_REJECT_MESSAGE, details={"matched": matched})

    def find_in_payload(self, payload: Any) -> Optional[tuple[str, str]]:
        for path, value in _iter_text_values(payload):
            matched = self.find_sensitive_word(value)
            if matched:
                return path, matched
        return None

    def _first_hit(self, text: str, *, cjk_only: bool) -> Optional[str]:
        for end_index, word in self._automaton.iter(text):
            if cjk_only and not _has_cjk(word):
                continue
            if _is_ascii_word(word) and not _ascii_word_bounded(text, end_index, word):
                continue
            if self._is_allowlisted(text, word):
                continue
            return word
        return None

    def _is_allowlisted(self, text: str, word: str) -> bool:
        if word in self._allowlist:
            return True
        for allowed in self._allowlist:
            if word in allowed and (allowed in text or compact_text(allowed) in text):
                return True
        return False


def _iter_text_values(payload: Any, prefix: str = "") -> Iterator[tuple[str, str]]:
    if isinstance(payload, str):
        yield prefix, payload
        return
    if isinstance(payload, dict):
        for key, value in payload.items():
            name = str(key)
            if should_skip_field_name(name):
                continue
            path = f"{prefix}.{name}" if prefix else name
            yield from _iter_text_values(value, path)
        return
    if isinstance(payload, list):
        for index, value in enumerate(payload):
            path = f"{prefix}[{index}]" if prefix else f"[{index}]"
            yield from _iter_text_values(value, path)


def find_sensitive_word(text: Optional[str]) -> Optional[str]:
    return SensitiveWordService.instance().find_sensitive_word(text)


def assert_text_clean(text: Optional[str]) -> None:
    SensitiveWordService.instance().assert_text_clean(text)
