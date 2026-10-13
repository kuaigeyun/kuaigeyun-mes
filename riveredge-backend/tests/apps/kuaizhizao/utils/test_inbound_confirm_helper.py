"""入库/出库确认业务操作人解析"""

import asyncio
from types import SimpleNamespace

from apps.kuaizhizao.utils.inbound_confirm_helper import (
    resolve_inbound_confirm_receiver,
    resolve_outbound_confirm_deliverer,
)


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


def test_resolve_outbound_confirm_deliverer_prefers_request():
    async def get_user_name(user_id: int) -> str:
        return f"用户{user_id}"

    did, dname = asyncio.run(
        resolve_outbound_confirm_deliverer(
            confirmed_by=10,
            confirmation_data=SimpleNamespace(deliverer_id=40, deliverer_name="王五"),
            get_user_name=get_user_name,
            existing_deliverer_id=50,
            existing_deliverer_name="旧人",
        )
    )
    assert did == 40
    assert dname == "王五"


def test_resolve_outbound_confirm_deliverer_keeps_existing():
    async def get_user_name(user_id: int) -> str:
        return f"用户{user_id}"

    did, dname = asyncio.run(
        resolve_outbound_confirm_deliverer(
            confirmed_by=10,
            confirmation_data=None,
            get_user_name=get_user_name,
            existing_deliverer_id=50,
            existing_deliverer_name="旧人",
        )
    )
    assert did == 50
    assert dname == "旧人"


def test_resolve_outbound_confirm_deliverer_defaults_to_confirmer():
    async def get_user_name(user_id: int) -> str:
        return f"用户{user_id}"

    did, dname = asyncio.run(
        resolve_outbound_confirm_deliverer(
            confirmed_by=10,
            confirmation_data=None,
            get_user_name=get_user_name,
        )
    )
    assert did == 10
    assert dname == "用户10"


def test_resolve_inbound_confirm_business_time_prefers_request():
    from datetime import datetime

    from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_confirm_business_time

    requested = datetime(2026, 8, 1, 10, 0, 0)
    existing = datetime(2026, 7, 1, 10, 0, 0)
    got = resolve_inbound_confirm_business_time(
        SimpleNamespace(receipt_time=requested),
        existing_time=existing,
    )
    assert got == resolve_inbound_confirm_business_time(
        SimpleNamespace(receipt_time=requested),
        existing_time=None,
    )


def test_resolve_inbound_confirm_business_time_keeps_existing():
    from datetime import datetime

    from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_confirm_business_time

    existing = datetime(2026, 7, 1, 10, 0, 0)
    got = resolve_inbound_confirm_business_time(None, existing_time=existing)
    assert got is not None
    assert got.year == 2026
    assert got.month == 7
    assert got.day == 1


def test_resolve_inbound_posting_business_time_uses_confirm_moment_when_unspecified():
    from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_posting_business_time

    got = resolve_inbound_posting_business_time(None, existing_time=None)
    assert got is not None
    assert got.tzinfo is not None


def test_resolve_inbound_confirm_business_time_empty_stays_none():
    from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_confirm_business_time

    assert resolve_inbound_confirm_business_time(None, existing_time=None) is None
    assert (
        resolve_inbound_confirm_business_time(
            SimpleNamespace(receipt_time=None),
            existing_time=None,
        )
        is None
    )
    assert (
        resolve_inbound_confirm_business_time(
            SimpleNamespace(receipt_time=""),
            existing_time=None,
        )
        is None
    )
