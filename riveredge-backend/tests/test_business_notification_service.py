"""业务配置消息提醒派发（单元测试）"""

from unittest.mock import AsyncMock, patch

import pytest

from core.services.business.business_notification_service import BusinessNotificationService


@pytest.mark.asyncio
async def test_dispatch_skips_when_no_matching_rules():
    with patch(
        "core.services.business.business_notification_service.BusinessConfigService"
    ) as mock_cfg:
        mock_cfg.return_value.get_business_config = AsyncMock(
            return_value={"parameters": {"notifications": {"rules": []}}}
        )
        sent = await BusinessNotificationService.dispatch(
            1,
            trigger_document="haoligo_outsource_maintenance",
            trigger_action="submitted",
            variables={"sheet_no": "WX001"},
            context={"creator_user_id": 10},
        )
    assert sent == 0
