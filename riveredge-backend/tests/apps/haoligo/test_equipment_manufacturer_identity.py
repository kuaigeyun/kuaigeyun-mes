"""制造厂商代号改写契约：唯一性校验 + 单据编码快照与外协绑定同步。

历史设备合同登记挂的是财务材料供应商台账，migration 611 转成制造厂商时铸了 EQM-* 合成码。
代号一旦不可改，管理员就没有任何办法把历史单据交回真实厂家手上（migration 671 负责存量，
本文件守住增量：代号可改，且改完编码快照与绑定必须跟着走）。
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

# 先经 api 包入口导入，避免 apps.haoligo.services -> api._qs -> api.__init__ 的既有循环
from apps.haoligo.api.routes_equipment import ManufacturerUpdate
from apps.haoligo.models.equipment import HaoligoManufacturer
from apps.haoligo.models.equipment_acceptance import HaoligoEquipmentAcceptanceSheet
from apps.haoligo.models.finance_equipment_payable import (
    HaoligoFinanceEquipmentContract,
    HaoligoFinanceEquipmentPayable,
)
from apps.haoligo.services.equipment_manufacturer import (
    assert_manufacturer_code_available,
    propagate_manufacturer_identity,
)
from core.models.user_data_scope_binding import UserDataScopeBinding


def test_manufacturer_update_accepts_code():
    """代号必须可改：不可改就没有存量修复入口。"""
    assert "code" in ManufacturerUpdate.model_fields
    assert ManufacturerUpdate(code="A023").code == "A023"


def _stub_lookup(clash):
    qs = MagicMock()
    qs.exclude.return_value = qs
    qs.first = AsyncMock(return_value=clash)
    return qs


def test_free_code_passes():
    qs = _stub_lookup(None)
    with patch.object(HaoligoManufacturer, "filter", return_value=qs):
        asyncio.run(assert_manufacturer_code_available(17, "A023"))


def test_code_taken_by_alive_manufacturer_is_rejected():
    clash = SimpleNamespace(name="常州正威自动化设备有限公司", deleted_at=None)
    qs = _stub_lookup(clash)
    with patch.object(HaoligoManufacturer, "filter", return_value=qs):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(assert_manufacturer_code_available(17, "A001", exclude_id=40))
    assert exc.value.status_code == 400
    assert "常州正威自动化设备有限公司" in exc.value.detail
    qs.exclude.assert_called_once_with(id=40)


def test_code_held_by_soft_deleted_manufacturer_is_rejected():
    """tenant_id + code 唯一约束不看 deleted_at，软删记录仍占号，须给出可行动的提示。"""
    clash = SimpleNamespace(
        name="广东拓斯达科技股份有限公司",
        deleted_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    with patch.object(HaoligoManufacturer, "filter", return_value=_stub_lookup(clash)):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(assert_manufacturer_code_available(17, "A018"))
    assert exc.value.status_code == 400
    assert "已删除" in exc.value.detail


def _recorder(label, calls):
    def _filter(**filter_kwargs):
        qs = MagicMock()

        async def _update(**update_kwargs):
            calls.append((label, filter_kwargs, update_kwargs))
            return 1

        qs.update = _update
        return qs

    return _filter


def _propagate(old_code: str, new_code: str) -> list[tuple[str, dict, dict]]:
    calls: list[tuple[str, dict, dict]] = []
    with patch.object(HaoligoFinanceEquipmentContract, "filter", _recorder("contract", calls)), patch.object(
        HaoligoFinanceEquipmentPayable, "filter", _recorder("payable", calls)
    ), patch.object(
        HaoligoEquipmentAcceptanceSheet, "filter", _recorder("acceptance", calls)
    ), patch.object(
        UserDataScopeBinding, "filter", _recorder("binding", calls)
    ):
        asyncio.run(
            propagate_manufacturer_identity(
                tenant_id=17,
                manufacturer_id=40,
                old_code=old_code,
                new_code=new_code,
                new_name="福州市辰亿五金制品有限公司",
            )
        )
    return calls


def test_renaming_code_rewrites_every_snapshot_and_binding():
    calls = _propagate("EQM-1", "A023")

    assert [label for label, _, _ in calls] == ["contract", "payable", "acceptance", "binding"]

    for label, filter_kwargs, update_kwargs in calls[:3]:
        assert filter_kwargs == {"tenant_id": 17, "manufacturer_id": 40}, label
        assert update_kwargs["manufacturer_code"] == "A023", label
        assert update_kwargs["manufacturer_name"] == "福州市辰亿五金制品有限公司", label
        # 主数据改名不是业务修改，不得把全部历史单据顶到「最近更新」
        assert "updated_at" not in update_kwargs, label

    _, binding_filter, binding_update = calls[3]
    assert binding_filter["dimension"] == "manufacturer"
    assert binding_filter["scope_code"] == "EQM-1"
    assert binding_filter["deleted_at"] is None
    assert binding_update["scope_code"] == "A023"


def test_name_only_edit_leaves_bindings_alone():
    calls = _propagate("A023", "A023")
    assert [label for label, _, _ in calls] == ["contract", "payable", "acceptance"]
