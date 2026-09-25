"""文件版本可见性策略（INF-05）。

使用方只看最新生效版；制定方与全局总查看可看历史。
业务域实现「生效版本查询 / 历史版本查询」时必须调用本策略，禁止页面写人员名单。
"""

from __future__ import annotations

from enum import Enum
from typing import Iterable, Optional, Sequence, Set


class DocumentVersionAudience(str, Enum):
    CONSUMER = "consumer"  # 使用方：仅最新生效
    AUTHOR = "author"  # 制定方：自己的历史
    GLOBAL_VIEWER = "global_viewer"  # 全局总查看
    PRODUCTION = "production"  # 生产：仅当前生产生效版，旧生产版不可见


DOCUMENT_GLOBAL_VIEW_PERMISSION = "system:document-global-view:read"
# 资深制定方：可查看历史版本（等同全局总查看，禁止页面写人员名单）
DOCUMENT_SENIOR_AUTHOR_PERMISSION = "system:document-senior-author:read"


def resolve_audience(
    *,
    permission_codes: Optional[Iterable[str]] = None,
    is_author: bool = False,
    production_context: bool = False,
) -> DocumentVersionAudience:
    codes: Set[str] = {
        str(c or "").strip().lower() for c in (permission_codes or []) if str(c or "").strip()
    }
    if DOCUMENT_GLOBAL_VIEW_PERMISSION in codes:
        return DocumentVersionAudience.GLOBAL_VIEWER
    if DOCUMENT_SENIOR_AUTHOR_PERMISSION in codes:
        return DocumentVersionAudience.GLOBAL_VIEWER
    if production_context:
        return DocumentVersionAudience.PRODUCTION
    if is_author:
        return DocumentVersionAudience.AUTHOR
    return DocumentVersionAudience.CONSUMER


def can_view_historical_versions(audience: DocumentVersionAudience) -> bool:
    return audience in {
        DocumentVersionAudience.AUTHOR,
        DocumentVersionAudience.GLOBAL_VIEWER,
    }


def can_download_historical_versions(audience: DocumentVersionAudience) -> bool:
    """历史版下载：仅资深制定方 / 全局总查看；普通制定方仅可查看履历。"""
    return audience == DocumentVersionAudience.GLOBAL_VIEWER


def filter_version_rows(
    rows: Sequence[dict],
    *,
    audience: DocumentVersionAudience,
    author_user_id: Optional[int] = None,
    current_user_id: Optional[int] = None,
) -> list[dict]:
    """
    rows 项至少含：is_effective / is_latest_effective / status / created_by
    status: draft|effective|obsolete|rejected（rejected 永不进正式目录）
    """
    visible: list[dict] = []
    for row in rows:
        status = str(row.get("status") or "").strip().lower()
        if status == "rejected":
            continue
        if status == "draft" and audience == DocumentVersionAudience.CONSUMER:
            continue
        if audience == DocumentVersionAudience.CONSUMER:
            if row.get("is_latest_effective") or row.get("is_effective"):
                visible.append(row)
            continue
        if audience == DocumentVersionAudience.PRODUCTION:
            if row.get("is_production_effective") or row.get("is_latest_effective"):
                visible.append(row)
            continue
        if audience == DocumentVersionAudience.AUTHOR:
            owner = row.get("created_by")
            if current_user_id is not None and owner is not None and int(owner) == int(current_user_id):
                visible.append(row)
                continue
            if row.get("is_latest_effective") or row.get("is_effective"):
                visible.append(row)
            continue
        # global viewer
        visible.append(row)
    return visible
