"""官方接口库条目规范化单元测试。"""

import pytest

from infra.exceptions.exceptions import ValidationError
from infra.services.official_api_library_service import (
    OfficialApiLibraryService,
    normalize_official_api_item,
    pack_to_preview,
)


def test_normalize_official_api_item_strips_sensitive_headers():
    item = normalize_official_api_item(
        {
            "item_key": "query_material",
            "name": "查询物料",
            "path": "/api/material",
            "method": "post",
            "request_headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer secret",
                "X-Api-Key": "k",
            },
        }
    )
    assert item["method"] == "POST"
    assert item["request_headers"] == {"Content-Type": "application/json"}


def test_normalize_official_api_item_requires_path():
    with pytest.raises(ValidationError):
        normalize_official_api_item({"item_key": "a", "name": "n", "method": "GET"})


def test_pack_to_preview_includes_status():
    class _Pack:
        pack_id = "demo_pack"
        name = "演示包"
        description = "d"
        connector_type = "kingdee"
        category_name = "金蝶"
        category_code = "kd"
        category_description = ""
        status = "published"
        items = [{"item_key": "a", "name": "A", "description": ""}]
        submitter_hint = None
        source_host_hint = None
        created_at = None
        updated_at = None

    preview = pack_to_preview(_Pack())
    assert preview["status"] == "published"
    assert preview["api_count"] == 1
    assert OfficialApiLibraryService  # import smoke
