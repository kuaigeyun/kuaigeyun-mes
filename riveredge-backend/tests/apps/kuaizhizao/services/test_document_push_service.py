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


@pytest.mark.asyncio
async def test_fanout_isolates_failures():
    ensure_default_push_handlers_registered()
    ok = AsyncMock(return_value={"success": True, "dry_run": True, "message": "dry_run"})
    bad = AsyncMock(side_effect=RuntimeError("boom"))
    with (
        patch(
            "apps.kuaizhizao.services.document_push_service.assert_document_push_ready",
            new=AsyncMock(),
        ),
        patch(
            "core.services.integration.document_push_guard.document_push_guard.assert_allowed",
        ),
        patch.dict(
            "apps.kuaizhizao.services.document_push_service._PUSH_HANDLERS",
            {("work_order", WO_PROFILE): bad, ("work_order", OA_PROFILE): ok},
            clear=False,
        ),
    ):
        result = await DocumentPushService().push(
            tenant_id=1,
            acting_user_id=1,
            source_type="work_order",
            source_id=7,
            target_profiles=[WO_PROFILE, OA_PROFILE],
            dry_run=True,
        )
    assert result.get("multi") is True
    assert result.get("failed") == 1
    assert not result.get("bill_no")


def test_guard_quota_and_circuit_ignore_dry_run():
    from core.services.integration.document_push_guard import DocumentPushGuard

    dims = dict(category="erp", connector_type="kingdee_galaxy", target_profile=WO_PROFILE)
    guard = DocumentPushGuard(max_calls_per_minute=2, failure_threshold=2, cooldown_seconds=30)
    for _ in range(5):
        guard.assert_allowed(1, dry_run=True, **dims)
    guard.assert_allowed(1, dry_run=False, **dims)
    guard.assert_allowed(1, dry_run=False, **dims)
    with pytest.raises(ValidationError):
        guard.assert_allowed(1, dry_run=False, **dims)

    guard2 = DocumentPushGuard(max_calls_per_minute=100, failure_threshold=2, cooldown_seconds=60)
    guard2.record_outcome(1, success=False, dry_run=False, **dims)
    guard2.record_outcome(1, success=False, dry_run=False, **dims)
    with pytest.raises(ValidationError) as exc:
        guard2.assert_allowed(1, dry_run=False, **dims)
    assert "熔断" in str(exc.value)
    guard2.assert_allowed(1, dry_run=True, **dims)


def test_slo_snapshot_three_dimensions():
    from core.services.integration.document_push_slo import DocumentPushSloRegistry

    slo = DocumentPushSloRegistry()
    slo.record(
        category="erp",
        connector_type="kingdee_galaxy",
        target_profile=WO_PROFILE,
        success=True,
        duration_ms=20,
    )
    slo.record(
        category="erp",
        connector_type="kingdee_galaxy",
        target_profile=WO_PROFILE,
        success=False,
        duration_ms=40,
    )
    rows = {
        (r["category"], r["connector_type"], r["target_profile"]): r for r in slo.snapshot()
    }
    erp = rows[("erp", "kingdee_galaxy", WO_PROFILE)]
    assert erp["attempts"] == 2
    assert erp["success"] == 1
    assert erp["failed"] == 1


def test_category_for_kingdee_is_erp():
    from core.services.integration.document_push_pipeline import category_for_connector_type

    assert category_for_connector_type("kingdee_galaxy") == "erp"
    assert category_for_connector_type("feishu") == "collaboration"
    assert category_for_connector_type("") is None


@pytest.mark.asyncio
async def test_fanout_isolates_failures_and_dry_run_has_no_bill():
    """多目标 fan-out：单目标失败不阻断其余；dry_run 汇总不含 bill_no。"""
    from apps.kuaizhizao.services.document_push_service import ensure_default_push_handlers_registered

    ensure_default_push_handlers_registered()
    ok = AsyncMock(
        return_value={
            "success": True,
            "dry_run": True,
            "model": {"code": "OA"},
            "body": {"code": "OA"},
            "message": "dry_run",
        }
    )
    bad = AsyncMock(side_effect=RuntimeError("boom"))
    with (
        patch(
            "apps.kuaizhizao.services.document_push_service.assert_document_push_ready",
            new=AsyncMock(),
        ),
        patch(
            "core.services.integration.document_push_guard.document_push_guard.assert_allowed",
        ),
        patch.dict(
            "apps.kuaizhizao.services.document_push_service._PUSH_HANDLERS",
            {
                ("work_order", WO_PROFILE): bad,
                ("work_order", OA_PROFILE): ok,
            },
            clear=False,
        ),
    ):
        result = await DocumentPushService().push(
            tenant_id=1,
            acting_user_id=1,
            source_type="work_order",
            source_id=7,
            target_profiles=[WO_PROFILE, OA_PROFILE],
            dry_run=True,
        )
    assert result.get("multi") is True
    assert result.get("dry_run") is True
    assert result.get("failed") == 1
    assert result.get("success") is False
    assert not result.get("bill_no")
    for row in result.get("results") or []:
        assert not row.get("bill_no")
    ok.assert_awaited()
    bad.assert_awaited()


def test_guard_quota_and_circuit_ignore_dry_run():
    from core.services.integration.document_push_guard import DocumentPushGuard

    guard = DocumentPushGuard(max_calls_per_minute=2, failure_threshold=2, cooldown_seconds=30)
    dims = dict(category="erp", connector_type="kingdee_galaxy", target_profile=WO_PROFILE)
    # dry_run 不占配额
    for _ in range(5):
        guard.assert_allowed(1, dry_run=True, **dims)
    guard.assert_allowed(1, dry_run=False, **dims)
    guard.assert_allowed(1, dry_run=False, **dims)
    with pytest.raises(ValidationError):
        guard.assert_allowed(1, dry_run=False, **dims)

    guard2 = DocumentPushGuard(max_calls_per_minute=100, failure_threshold=2, cooldown_seconds=60)
    guard2.record_outcome(1, success=False, dry_run=False, **dims)
    guard2.record_outcome(1, success=False, dry_run=False, **dims)
    with pytest.raises(ValidationError) as exc:
        guard2.assert_allowed(1, dry_run=False, **dims)
    assert "熔断" in str(exc.value)
    # dry_run 仍放行
    guard2.assert_allowed(1, dry_run=True, **dims)


def test_slo_snapshot_three_dimensions():
    from core.services.integration.document_push_slo import DocumentPushSloRegistry

    slo = DocumentPushSloRegistry()
    slo.record(
        category="erp",
        connector_type="kingdee_galaxy",
        target_profile=WO_PROFILE,
        success=True,
        duration_ms=20,
    )
    slo.record(
        category="erp",
        connector_type="kingdee_galaxy",
        target_profile=WO_PROFILE,
        success=False,
        duration_ms=40,
    )
    slo.record(
        category="oa",
        connector_type="Webhook",
        target_profile=OA_PROFILE,
        success=True,
        dry_run=True,
    )
    rows = { (r["category"], r["connector_type"], r["target_profile"]): r for r in slo.snapshot() }
    erp = rows[("erp", "kingdee_galaxy", WO_PROFILE)]
    assert erp["attempts"] == 2
    assert erp["success"] == 1
    assert erp["failed"] == 1
    assert erp["dry_run"] == 0
    oa = rows[("oa", "Webhook", OA_PROFILE)]
    assert oa["dry_run"] == 1
    assert oa["attempts"] == 0


def test_category_for_connector_type_from_presets():
    from core.services.integration.document_push_pipeline import (
        category_for_connector_type,
    )

    assert category_for_connector_type("kingdee_galaxy") == "erp"
    assert category_for_connector_type("feishu") == "collaboration"
    assert category_for_connector_type("") is None
