"""DocumentPushService 注册表 + push_ready 写门单测。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.document_push_service import (
    SUPPORTED_PROFILES,
    DocumentPushService,
    ensure_default_push_handlers_registered,
    list_registered_push_handlers,
)
from apps.kuaizhizao.services.feishu_work_order_push_service import (
    TARGET_PROFILE as FEISHU_PROFILE,
)
from apps.kuaizhizao.services.kingdee_inventory_push_service import (
    TARGET_PROFILE as INV_PROFILE,
)
from apps.kuaizhizao.services.kingdee_production_order_push_service import (
    TARGET_PROFILE as WO_PROFILE,
)
from apps.kuaizhizao.services.kingdee_production_report_push_service import (
    TARGET_PROFILE as RPT_PROFILE,
)
from apps.kuaizhizao.services.kingdee_purchase_order_push_service import (
    TARGET_PROFILE as PO_PROFILE,
)
from apps.kuaizhizao.services.kingdee_sales_order_push_service import (
    TARGET_PROFILE as SO_PROFILE,
)
from apps.kuaizhizao.services.oa_document_push_service import (
    TARGET_PROFILE as OA_PROFILE,
)
from core.services.integration.document_push_readiness import (
    is_connection_push_ready,
)
from infra.exceptions.exceptions import ValidationError

# 诚实集合锁定：仅已接通实现，禁止 WMS/PLM/CRM 虚报
_EXPECTED_SUPPORTED_PROFILES = {
    ("work_order", WO_PROFILE),
    ("work_order", OA_PROFILE),
    ("work_order", FEISHU_PROFILE),
    ("reporting_record", RPT_PROFILE),
    ("sales_order", SO_PROFILE),
    ("purchase_order", PO_PROFILE),
    ("material_batch", INV_PROFILE),
}


def test_supported_profiles_locked_honest_set():
    assert SUPPORTED_PROFILES == _EXPECTED_SUPPORTED_PROFILES
    # 虚报禁区：目录品类不得冒充写回 profile
    for _, profile in SUPPORTED_PROFILES:
        low = profile.lower()
        assert "wms" not in low
        assert "plm" not in low


def test_list_profiles_equals_supported_set():
    profiles = DocumentPushService().list_profiles()
    assert {(p["source_type"], p["target_profile"]) for p in profiles} == SUPPORTED_PROFILES


def test_handler_registry_covers_supported_profiles_exactly():
    ensure_default_push_handlers_registered()
    assert set(list_registered_push_handlers()) == SUPPORTED_PROFILES


def test_is_connection_push_ready_requires_connected():
    preset_only = MagicMock(is_active=True, is_connected=False, deleted_at=None)
    assert is_connection_push_ready(preset_only) is False
    ready = MagicMock(is_active=True, is_connected=True, deleted_at=None)
    assert is_connection_push_ready(ready) is True
    inactive = MagicMock(is_active=False, is_connected=True, deleted_at=None)
    assert is_connection_push_ready(inactive) is False


@pytest.mark.asyncio
async def test_unknown_profile_rejected():
    with pytest.raises(ValidationError) as exc:
        await DocumentPushService().resolve_target_profiles(
            tenant_id=1,
            source_type="work_order",
            target_profile="wms_fake_profile",
        )
    assert "不支持的推送组合" in str(exc.value)


@pytest.mark.asyncio
async def test_formal_push_fails_when_push_ready_false():
    """正式推：push_ready=false → ValidationError，且不调 handler。"""
    handler = AsyncMock(return_value={"success": True})
    with (
        patch(
            "apps.kuaizhizao.services.document_push_service.assert_document_push_ready",
            new=AsyncMock(
                side_effect=ValidationError("外推未就绪（push_ready=false）")
            ),
        ),
        patch.dict(
            "apps.kuaizhizao.services.document_push_service._PUSH_HANDLERS",
            {("work_order", WO_PROFILE): handler},
            clear=False,
        ),
    ):
        with pytest.raises(ValidationError) as exc:
            await DocumentPushService().push(
                tenant_id=1,
                acting_user_id=1,
                source_type="work_order",
                source_id=99,
                target_profile=WO_PROFILE,
                dry_run=False,
            )
    assert "push_ready=false" in str(exc.value)
    handler.assert_not_awaited()


@pytest.mark.asyncio
async def test_dry_run_skips_ready_gate_and_invokes_handler():
    """dry_run：允许在 push_ready=false 时组装预览；不得假装已写回。"""
    handler = AsyncMock(
        return_value={
            "success": True,
            "dry_run": True,
            "model": {"FBillNo": "WO-1"},
            "body": {"Model": {"FBillNo": "WO-1"}},
            "message": "dry_run",
        }
    )
    ready_assert = AsyncMock()  # dry_run 路径内 assert 应被调用且内部直接 return
    with (
        patch(
            "apps.kuaizhizao.services.document_push_service.assert_document_push_ready",
            new=ready_assert,
        ),
        patch.dict(
            "apps.kuaizhizao.services.document_push_service._PUSH_HANDLERS",
            {("work_order", WO_PROFILE): handler},
            clear=False,
        ),
    ):
        # 确保注册表已有其它键时仍能命中
        ensure_default_push_handlers_registered()
        result = await DocumentPushService().push(
            tenant_id=1,
            acting_user_id=1,
            source_type="work_order",
            source_id=99,
            target_profile=WO_PROFILE,
            dry_run=True,
        )
    ready_assert.assert_awaited()
    assert ready_assert.await_args.kwargs.get("dry_run") is True
    handler.assert_awaited_once()
    assert handler.await_args.kwargs.get("dry_run") is True
    assert result.get("dry_run") is True
    assert result.get("success") is True
    # 零副作用契约：dry_run 结果不得带真实 bill_no / 写回痕迹
    assert not result.get("bill_no")
    assert result.get("skipped") is not True


@pytest.mark.asyncio
async def test_assert_document_push_ready_blocks_formal_without_connection():
    from core.services.integration import document_push_readiness as readiness

    with patch.object(
        readiness,
        "find_push_ready_connection",
        new=AsyncMock(return_value=None),
    ):
        with pytest.raises(ValidationError) as exc:
            await readiness.assert_document_push_ready(
                1,
                source_type="work_order",
                target_profile=WO_PROFILE,
                dry_run=False,
            )
        assert "push_ready=false" in str(exc.value)

        # dry_run 不抛
        await readiness.assert_document_push_ready(
            1,
            source_type="work_order",
            target_profile=WO_PROFILE,
            dry_run=True,
        )
