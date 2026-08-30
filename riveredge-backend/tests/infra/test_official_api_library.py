"""官方接口库条目规范化单元测试。"""

import pytest

from infra.exceptions.exceptions import ValidationError
from infra.services.official_api_library_service import normalize_official_api_item


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
