"""R-15 / INF-05：产品固件版本可见性映射。"""

from apps.kuaiplm.utils.firmware_version import (
    bump_firmware_version,
    firmware_policy_row,
    firmware_policy_status,
    is_firmware_file_uuid,
)
from core.services.file.document_version_policy import (
    DOCUMENT_SENIOR_AUTHOR_PERMISSION,
    DocumentVersionAudience,
    filter_version_rows,
    resolve_audience,
)


def _row(oid: int, status: str, created_by: int = 1):
    return type(
        "F",
        (),
        {"id": oid, "project_id": 10, "version": f"v{oid}", "status": status, "created_by": created_by},
    )()


def test_bump_firmware_version():
    assert bump_firmware_version("V1.01") == "V1.02"
    assert bump_firmware_version("V2.09") == "V2.10"
    assert bump_firmware_version("A0") == "A1"
    assert bump_firmware_version("custom") == "custom.1"


def test_is_firmware_file_uuid():
    assert is_firmware_file_uuid("550e8400-e29b-41d4-a716-446655440000")
    assert not is_firmware_file_uuid("rc-upload-123")
    assert not is_firmware_file_uuid(None)


def test_firmware_policy_status_mapping():
    assert firmware_policy_status("draft") == "draft"
    assert firmware_policy_status("pending") == "draft"
    assert firmware_policy_status("approved") == "draft"
    assert firmware_policy_status("released") == "effective"
    assert firmware_policy_status("obsolete") == "obsolete"


def test_consumer_sees_only_latest_released():
    latest = {2}
    rows = [
        firmware_policy_row(_row(1, "obsolete"), latest_released_ids=latest),
        firmware_policy_row(_row(2, "released"), latest_released_ids=latest),
        firmware_policy_row(_row(3, "draft", created_by=9), latest_released_ids=latest),
    ]
    audience = resolve_audience()
    assert audience == DocumentVersionAudience.CONSUMER
    visible = filter_version_rows(rows, audience=audience)
    assert [r["id"] for r in visible] == [2]


def test_author_sees_own_draft_and_latest_released():
    latest = {2}
    rows = [
        firmware_policy_row(_row(1, "obsolete", created_by=9), latest_released_ids=latest),
        firmware_policy_row(_row(2, "released", created_by=1), latest_released_ids=latest),
        firmware_policy_row(_row(3, "draft", created_by=9), latest_released_ids=latest),
        firmware_policy_row(_row(4, "draft", created_by=2), latest_released_ids=latest),
    ]
    visible = filter_version_rows(
        rows,
        audience=DocumentVersionAudience.AUTHOR,
        current_user_id=9,
    )
    assert sorted(r["id"] for r in visible) == [1, 2, 3]


def test_senior_author_sees_full_firmware_history():
    latest = {2}
    rows = [
        firmware_policy_row(_row(1, "obsolete"), latest_released_ids=latest),
        firmware_policy_row(_row(2, "released"), latest_released_ids=latest),
        firmware_policy_row(_row(3, "draft", created_by=9), latest_released_ids=latest),
    ]
    audience = resolve_audience(permission_codes=[DOCUMENT_SENIOR_AUTHOR_PERMISSION])
    assert audience == DocumentVersionAudience.GLOBAL_VIEWER
    visible = filter_version_rows(rows, audience=audience)
    assert sorted(r["id"] for r in visible) == [1, 2, 3]


def test_production_sees_only_production_effective():
    latest = {5}
    rows = [
        firmware_policy_row(_row(4, "released"), latest_released_ids=set()),
        firmware_policy_row(_row(5, "released"), latest_released_ids=latest),
    ]
    # 非最新 released：is_effective False
    assert rows[0]["is_effective"] is False
    assert rows[1]["is_production_effective"] is True
    audience = resolve_audience(production_context=True)
    visible = filter_version_rows(rows, audience=audience)
    assert [r["id"] for r in visible] == [5]
