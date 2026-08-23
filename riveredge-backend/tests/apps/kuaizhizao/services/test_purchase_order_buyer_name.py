import pytest

from apps.kuaizhizao.services.purchase_service import PurchaseService


@pytest.mark.asyncio
async def test_resolve_buyer_fields_fills_name_from_user_id(monkeypatch):
    service = PurchaseService()

    async def fake_get_user_name(user_id: int) -> str:
        assert user_id == 42
        return "鲁新颜"

    monkeypatch.setattr(service, "get_user_name", fake_get_user_name)

    data = {"buyer_id": 42, "buyer_name": None}
    await service._resolve_buyer_fields(data)
    assert data["buyer_name"] == "鲁新颜"


@pytest.mark.asyncio
async def test_resolve_buyer_fields_keeps_existing_name(monkeypatch):
    service = PurchaseService()

    async def fail_get_user_name(_user_id: int) -> str:
        raise AssertionError("should not resolve when buyer_name already set")

    monkeypatch.setattr(service, "get_user_name", fail_get_user_name)

    data = {"buyer_id": 42, "buyer_name": "已有姓名"}
    await service._resolve_buyer_fields(data)
    assert data["buyer_name"] == "已有姓名"


@pytest.mark.asyncio
async def test_resolve_buyer_fields_clears_name_when_buyer_cleared():
    service = PurchaseService()
    data = {"buyer_id": None, "buyer_name": "旧姓名"}
    await service._resolve_buyer_fields(data)
    assert data["buyer_name"] is None
