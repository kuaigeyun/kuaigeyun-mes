"""标准件预设目录与导入逻辑单测。"""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

import pytest

from apps.master_data.services.material_standard_parts_catalog import (
    PRIMARY_CATEGORY_ALLOWED,
    clear_standard_parts_library_cache,
    get_standard_parts_library_dir,
    reload_standard_parts_library,
    standard_parts_preset_catalog_for_api,
    get_standard_part_by_preset_key,
    validate_preset_keys,
)
from apps.master_data.services.material_service import MaterialService
from infra.exceptions.exceptions import ValidationError


def test_standard_parts_catalog_has_categories():
    data = standard_parts_preset_catalog_for_api()
    assert "categories" in data
    assert len(data["categories"]) >= 1
    cat0 = data["categories"][0]
    assert "id" in cat0 and "name" in cat0
    assert "primaryCategory" in cat0
    assert cat0["primaryCategory"] in PRIMARY_CATEGORY_ALLOWED
    assert cat0["items"]
    it0 = cat0["items"][0]
    assert "presetKey" in it0 and "gbCode" in it0


def test_validate_preset_keys_unknown():
    with pytest.raises(ValidationError, match="presetKey"):
        validate_preset_keys(["not_a_real_key"])


@pytest.mark.asyncio
async def test_load_standard_parts_preset_unknown_group():
    class FakeQS:
        async def first(self):
            return None

    with patch(
        "apps.master_data.services.material_service.MaterialGroup.filter",
        return_value=FakeQS(),
    ):
        with pytest.raises(ValidationError, match="物料分组"):
            await MaterialService.load_standard_parts_preset(
                1,
                "00000000-0000-0000-0000-000000000000",
                ["fastener_hex_bolt_screw__5783_m6x16_88"],
                "auto",
            )


@pytest.mark.asyncio
async def test_load_standard_parts_preset_empty_keys():
    mg = MagicMock()
    mg.id = 99

    class FakeQS:
        async def first(self):
            return mg

    with patch(
        "apps.master_data.services.material_service.MaterialGroup.filter",
        return_value=FakeQS(),
    ):
        out = await MaterialService.load_standard_parts_preset(
            1,
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            [],
            "auto",
        )
    assert out["created"] == 0
    assert "未选择" in out["message"]


def test_get_item_by_key():
    it = get_standard_part_by_preset_key("bolt__5783_m6x16")
    assert it is not None
    assert it["name"]


def test_custom_library_dir_and_reload(monkeypatch):
    clear_standard_parts_library_cache()
    with TemporaryDirectory() as tmp:
        lib = Path(tmp) / "lib"
        lib.mkdir()
        (lib / "01_test_cat.json").write_text(
            json.dumps(
                {
                    "sortOrder": 1,
                    "id": "test_cat_only",
                    "name": "测试分类",
                    "description": "单测",
                    "items": [
                        {
                            "preset_key": "test_cat_only__one",
                            "name": "测试物料",
                            "specification": "A",
                            "gb_standard": "GB/T 0",
                            "gb_code": "GB0-TEST-ONE",
                            "base_unit": "件",
                        }
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        monkeypatch.setenv("STANDARD_PARTS_LIBRARY_DIR", str(lib))
        reload_standard_parts_library()
        data = standard_parts_preset_catalog_for_api()
        assert any(c["id"] == "test_cat_only" for c in data["categories"])
        test_cat = next(c for c in data["categories"] if c["id"] == "test_cat_only")
        assert test_cat["primaryCategory"] == "standard_parts"
        assert get_standard_part_by_preset_key("test_cat_only__one") is not None
    monkeypatch.delenv("STANDARD_PARTS_LIBRARY_DIR", raising=False)
    clear_standard_parts_library_cache()
    reload_standard_parts_library()
    assert get_standard_parts_library_dir().name == "standard_parts"
