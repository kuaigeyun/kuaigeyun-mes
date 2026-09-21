"""INF-05：文件版本可见性策略。"""

from core.services.file.document_version_policy import (
    DOCUMENT_SENIOR_AUTHOR_PERMISSION,
    DocumentVersionAudience,
    can_view_historical_versions,
    filter_version_rows,
    resolve_audience,
)


def test_senior_author_resolves_global_viewer():
    audience = resolve_audience(
        permission_codes=[DOCUMENT_SENIOR_AUTHOR_PERMISSION],
        is_author=False,
    )
    assert audience == DocumentVersionAudience.GLOBAL_VIEWER
    assert can_view_historical_versions(audience)


def test_global_view_outranks_consumer():
    audience = resolve_audience(
        permission_codes=["system:document-global-view:read"],
        is_author=False,
    )
    assert audience == DocumentVersionAudience.GLOBAL_VIEWER
    assert can_view_historical_versions(audience)


def test_consumer_only_sees_effective():
    rows = [
        {"version": "A0", "status": "obsolete", "is_effective": False},
        {"version": "A1", "status": "effective", "is_latest_effective": True},
        {"version": "A2", "status": "rejected"},
        {"version": "B0", "status": "draft"},
    ]
    out = filter_version_rows(rows, audience=DocumentVersionAudience.CONSUMER)
    assert [r["version"] for r in out] == ["A1"]


def test_author_sees_own_history_and_effective():
    rows = [
        {"version": "A0", "status": "obsolete", "created_by": 7},
        {"version": "A1", "status": "effective", "is_effective": True, "created_by": 8},
        {"version": "A2", "status": "draft", "created_by": 9},
    ]
    out = filter_version_rows(
        rows,
        audience=DocumentVersionAudience.AUTHOR,
        current_user_id=7,
    )
    assert [r["version"] for r in out] == ["A0", "A1"]
