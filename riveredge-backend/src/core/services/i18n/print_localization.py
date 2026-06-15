"""打印场景 i18n 解析：租户语言库 + 内置兜底 + 系统日期格式。"""

from __future__ import annotations

from typing import Any

from core.i18n.bundled_translations import BUNDLED_TRANSLATIONS, DEFAULT_LANGUAGE_CODE
from core.i18n.datetime_format import format_datetime_value
from core.i18n.status_keys import (
    document_status_i18n_key,
    operation_status_i18n_key,
    review_status_i18n_key,
)
from core.services.system.language_service import LanguageService
from core.services.system.system_parameter_service import SystemParameterService


class PrintLocalization:
    def __init__(
        self,
        *,
        tenant_id: int,
        language_code: str,
        translations: dict[str, str],
        datetime_pattern: str,
    ) -> None:
        self.tenant_id = tenant_id
        self.language_code = language_code
        self._translations = translations
        self._datetime_pattern = datetime_pattern
        self._bundled = BUNDLED_TRANSLATIONS.get(language_code) or BUNDLED_TRANSLATIONS[DEFAULT_LANGUAGE_CODE]
        self._fallback_bundled = BUNDLED_TRANSLATIONS[DEFAULT_LANGUAGE_CODE]

    @classmethod
    async def for_tenant(cls, tenant_id: int, *, language_code: str | None = None) -> "PrintLocalization":
        lang_code = (language_code or "").strip()
        if not lang_code:
            default_lang = await LanguageService.get_default_language(tenant_id)
            lang_code = (default_lang.code if default_lang else None) or DEFAULT_LANGUAGE_CODE

        tenant_translations: dict[str, str] = {}
        try:
            tenant_translations = await LanguageService.get_translations(tenant_id, lang_code) or {}
        except Exception:
            tenant_translations = {}

        dt_param = await SystemParameterService.get_parameter(tenant_id, "system.datetime_format")
        datetime_pattern = "YYYY-MM-DD HH:mm"
        if dt_param:
            raw = str(dt_param.get_value() or "").strip()
            if raw:
                datetime_pattern = raw

        return cls(
            tenant_id=tenant_id,
            language_code=lang_code,
            translations=tenant_translations,
            datetime_pattern=datetime_pattern,
        )

    def t(self, key: str, *, default: str | None = None) -> str:
        if key in self._translations and self._translations[key]:
            return self._translations[key]
        if key in self._bundled:
            return self._bundled[key]
        if key in self._fallback_bundled:
            return self._fallback_bundled[key]
        if default is not None:
            return default
        return key

    def document_status(self, raw: str | None) -> str:
        if not raw:
            return ""
        return self.t(document_status_i18n_key(raw), default=str(raw))

    def review_status(self, raw: str | None) -> str:
        if not raw:
            return ""
        return self.t(review_status_i18n_key(raw), default=str(raw))

    def operation_status(self, raw: str | None) -> str:
        if not raw:
            return ""
        return self.t(operation_status_i18n_key(raw), default=str(raw))

    def format_datetime(self, value: Any) -> str | None:
        if value is None or value == "":
            return None
        return format_datetime_value(value, pattern=self._datetime_pattern)
