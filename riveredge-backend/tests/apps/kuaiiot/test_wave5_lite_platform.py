"""快数采 Wave 5 极轻量物联平台单元测试。"""

from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaiiot.constants import DEVICE_BATCH_MAX, OFFLINE_ALERT_TAG_KEY
from apps.kuaiiot.schemas.iot import DeviceBatchCreate, ProductCreate
from apps.kuaiiot.services.alert_rule_service import AlertRuleService
from apps.kuaiiot.services.product_service import ProductService
from apps.kuaiiot.schemas.iot import AlertRuleCreate
from infra.exceptions.exceptions import ValidationError


class TestProductServiceValidation:
    def test_validate_tags_requires_map_target(self):
        with pytest.raises(ValidationError):
            ProductService._validate_tags([{"tag_key": "temp", "name": "温度", "value_type": "number"}])

    def test_validate_tags_ok(self):
        tags = ProductService._validate_tags(
            [{"tag_key": "temp", "name": "温度", "value_type": "number", "map_target": "temperature"}]
        )
        assert tags[0]["tag_key"] == "temp"


@pytest.mark.asyncio
async def test_load_builtin_presets_skips_existing():
    with patch("apps.kuaiiot.services.product_service.IotProduct.filter") as mock_filter, patch(
        "apps.kuaiiot.services.product_service.IotProduct.create",
        new=AsyncMock(),
    ) as mock_create:
        mock_filter.return_value.exists = AsyncMock(return_value=True)
        mock_filter.return_value.count = AsyncMock(return_value=3)
        result = await ProductService.load_builtin_presets(1)
        assert result.created == 0
        assert result.skipped == 3
        mock_create.assert_not_called()


def test_alert_rule_offline_defaults():
    payload = AlertRuleService._normalize_offline_defaults({"rule_type": "offline"})
    assert payload["tag_key"] == OFFLINE_ALERT_TAG_KEY
    assert payload["operator"] == "eq"


def test_device_batch_limit():
    with pytest.raises(Exception):
        DeviceBatchCreate(product_id=1, name_prefix="设备", count=DEVICE_BATCH_MAX + 1)


def test_alert_rule_create_offline_schema():
    rule = AlertRuleCreate(
        code="offline-1",
        name="设备离线",
        rule_type="offline",
        device_id=1,
    )
    assert rule.rule_type == "offline"
