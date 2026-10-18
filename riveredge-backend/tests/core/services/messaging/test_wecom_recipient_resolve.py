"""企业微信推送：平台 user_id → wecom_userid 解析。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.messaging import wecom_message_service


@pytest.mark.asyncio
async def test_resolve_passes_through_literal_wecom_userid():
    user_ids, err = await wecom_message_service.resolve_wecom_recipient_userids(
        tenant_id=1,
        recipient="ZhangSan|LiSi",
    )
    assert err is None
    assert user_ids == ["ZhangSan", "LiSi"]


@pytest.mark.asyncio
async def test_resolve_platform_user_id_to_wecom_userid():
    user = MagicMock()
    user.contact_info = {"wecom_userid": "wx_zhang"}

    with patch(
        "core.services.messaging.wecom_message_service.User.filter",
    ) as user_filter:
        user_filter.return_value.first = AsyncMock(return_value=user)
        user_ids, err = await wecom_message_service.resolve_wecom_recipient_userids(
            tenant_id=1,
            recipient="42",
        )

    assert err is None
    assert user_ids == ["wx_zhang"]


@pytest.mark.asyncio
async def test_resolve_fails_when_user_unbound():
    user = MagicMock()
    user.contact_info = {}

    with patch(
        "core.services.messaging.wecom_message_service.User.filter",
    ) as user_filter:
        user_filter.return_value.first = AsyncMock(return_value=user)
        user_ids, err = await wecom_message_service.resolve_wecom_recipient_userids(
            tenant_id=1,
            recipient="99",
        )

    assert user_ids == []
    assert err is not None
    assert "未绑定企业微信" in err


@pytest.mark.asyncio
async def test_send_push_wecom_maps_user_id_before_api():
    config = MagicMock()
    config.config = {"provider": "wecom"}

    with patch(
        "core.workflows.functions.message_sender.MessageConfigService.get_message_config_by_uuid",
        new_callable=AsyncMock,
        return_value=config,
    ), patch(
        "core.services.messaging.wecom_message_service.resolve_wecom_recipient_userids",
        new_callable=AsyncMock,
        return_value=(["wx_uid"], None),
    ) as resolve, patch(
        "core.services.messaging.wecom_message_service.send_wecom_text_message",
        new_callable=AsyncMock,
        return_value=True,
    ) as send_wecom:
        from core.workflows.functions import message_sender

        result = await message_sender._send_push_notification(
            1, "cfg-uuid", "7", "标题", "正文",
        )

    assert result["success"] is True
    resolve.assert_awaited_once_with(tenant_id=1, recipient="7")
    send_wecom.assert_awaited_once_with(
        tenant_id=1,
        user_ids=["wx_uid"],
        content="正文",
    )


@pytest.mark.asyncio
async def test_send_push_wecom_fails_on_unbound_user():
    config = MagicMock()
    config.config = {"provider": "wecom"}

    with patch(
        "core.workflows.functions.message_sender.MessageConfigService.get_message_config_by_uuid",
        new_callable=AsyncMock,
        return_value=config,
    ), patch(
        "core.services.messaging.wecom_message_service.resolve_wecom_recipient_userids",
        new_callable=AsyncMock,
        return_value=([], "用户 7 未绑定企业微信"),
    ):
        from core.workflows.functions import message_sender

        result = await message_sender._send_push_notification(
            1, "cfg-uuid", "7", "标题", "正文",
        )

    assert result["success"] is False
    assert "未绑定企业微信" in (result.get("error") or "")
