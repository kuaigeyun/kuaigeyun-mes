"""入库确认入库人解析"""

import asyncio
from types import SimpleNamespace

from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_confirm_receiver


def test_resolve_inbound_confirm_receiver_defaults_to_confirmer():
    async def get_user_name(user_id: int) -> str:
        return f"用户{user_id}"

    rid, rname = asyncio.run(
        resolve_inbound_confirm_receiver(
            confirmed_by=10,
            confirmation_data=None,
            get_user_name=get_user_name,
        )
    )
    assert rid == 10
    assert rname == "用户10"


def test_resolve_inbound_confirm_receiver_uses_override():
    async def get_user_name(user_id: int) -> str:
        return f"用户{user_id}"

    rid, rname = asyncio.run(
        resolve_inbound_confirm_receiver(
            confirmed_by=10,
            confirmation_data=SimpleNamespace(receiver_id=20, receiver_name="薛雪"),
            get_user_name=get_user_name,
        )
    )
    assert rid == 20
    assert rname == "薛雪"


def test_resolve_inbound_confirm_receiver_fetches_name_when_missing():
    async def get_user_name(user_id: int) -> str:
        return "李四" if user_id == 30 else "未知"

    rid, rname = asyncio.run(
        resolve_inbound_confirm_receiver(
            confirmed_by=10,
            confirmation_data=SimpleNamespace(receiver_id=30, receiver_name=None),
            get_user_name=get_user_name,
        )
    )
    assert rid == 30
    assert rname == "李四"
