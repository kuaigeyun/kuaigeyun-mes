"""状态值 → i18n key 映射（不含展示文案）。"""

from __future__ import annotations

from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES, normalize_status

# 工单等执行类状态（normalize_status 未覆盖的别名）
_EXTRA_STATUS_ALIASES: dict[str, str] = {
    "split": "SPLIT",
    "已拆分": "SPLIT",
    "released": "RELEASED",
    "已下达": "RELEASED",
    "执行中": "IN_PROGRESS",
    "进行中": "IN_PROGRESS",
    "生产中": "IN_PROGRESS",
}


def _normalize_document_status(raw: str | None) -> str:
    if not raw:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if text in _EXTRA_STATUS_ALIASES:
        return _EXTRA_STATUS_ALIASES[text]
    lower = text.lower().replace("-", "_")
    if lower in _EXTRA_STATUS_ALIASES:
        return _EXTRA_STATUS_ALIASES[lower]
    return normalize_status(text)


def document_status_i18n_key(raw: str | None) -> str:
    norm = _normalize_document_status(raw)
    if not norm:
        return "documentStatus.draft"
    suffix = norm.lower()
    return f"documentStatus.{suffix}"


def review_status_i18n_key(raw: str | None) -> str:
    if not raw:
        return "reviewStatus.pending"
    text = str(raw).strip()
    norm = REVIEW_STATUS_ALIASES.get(text, text).lower()
    return f"reviewStatus.{norm}"


def operation_status_i18n_key(raw: str | None) -> str:
    if not raw:
        return "operationStatus.pending"
    suffix = str(raw).strip().lower().replace("-", "_").replace(" ", "_")
    return f"operationStatus.{suffix}"
