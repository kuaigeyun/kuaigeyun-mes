"""数据备份策略：normalize / 定时防重 / 保留选集。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from core.services.system import data_backup_policy as policy_mod
from core.services.system.data_backup_policy import (
    normalize_data_backup_policy,
    maybe_trigger_scheduled_backup,
    apply_retention_for_policy,
)
from core.utils.timezone_utils import resolve_business_datetime


def test_normalize_defaults_and_storage_local():
    out = normalize_data_backup_policy(None)
    assert out["schedule_enabled"] is False
    assert out["cron"] == "0 2 * * *"
    assert out["storage"]["backend"] == "local"
    assert out["storage"]["connection_uuid"] is None
    assert out["retention"]["mode"] == "none"


def test_normalize_connection_and_retention():
    out = normalize_data_backup_policy(
        {
            "schedule_enabled": True,
            "cron": "30 3 * * *",
            "storage": {
                "backend": "connection",
                "connection_uuid": "abc",
                "key_prefix": "/foo/",
                "storage_owner_tenant_id": 9,
            },
            "retention": {"mode": "keep_count", "keep_count": 3, "days": 0},
        }
    )
    assert out["schedule_enabled"] is True
    assert out["cron"] == "30 3 * * *"
    assert out["storage"]["backend"] == "connection"
    assert out["storage"]["connection_uuid"] == "abc"
    assert out["storage"]["key_prefix"] == "foo"
    assert out["storage"]["storage_owner_tenant_id"] == 9
    assert out["retention"]["mode"] == "keep_count"
    assert out["retention"]["keep_count"] == 3
    assert out["retention"]["days"] == 1  # max(1, days)


@pytest.mark.asyncio
async def test_maybe_trigger_skips_when_active_running(monkeypatch):
    policy = normalize_data_backup_policy(
        {"schedule_enabled": True, "cron": "* * * * *"}
    )
    now = resolve_business_datetime()
    monkeypatch.setattr(policy_mod, "match_cron", lambda *_a, **_k: True)
    monkeypatch.setattr(policy_mod, "_same_site_minute", lambda *_a, **_k: False)
    monkeypatch.setattr(policy_mod, "_has_active_backup", AsyncMock(return_value=True))
    stamp = AsyncMock()
    monkeypatch.setattr(policy_mod, "_mark_policy_stamp", stamp)
    create = AsyncMock()
    monkeypatch.setattr(
        "core.services.system.data_backup_service.DataBackupService.create_backup_task",
        create,
    )

    triggered = await maybe_trigger_scheduled_backup(
        policy,
        backup_scope="tenant",
        tenant_id=1,
        is_platform=False,
        now=now,
    )
    assert triggered is False
    create.assert_not_awaited()
    stamp.assert_awaited()


@pytest.mark.asyncio
async def test_apply_retention_keep_count(monkeypatch):
    policy = normalize_data_backup_policy(
        {"retention": {"mode": "keep_count", "keep_count": 2}}
    )
    rows = [
        SimpleNamespace(uuid="a"),
        SimpleNamespace(uuid="b"),
        SimpleNamespace(uuid="c"),
    ]
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.exclude = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.all = AsyncMock(return_value=rows)
    monkeypatch.setattr(policy_mod.DataBackup, "filter", MagicMock(return_value=q))

    deleted_uuids = []

    async def _delete(tenant_id, uuid, *, is_infra_admin=False):
        deleted_uuids.append(uuid)

    monkeypatch.setattr(
        "core.services.system.data_backup_service.DataBackupService.delete_backup",
        _delete,
    )

    result = await apply_retention_for_policy(
        policy, backup_scope="tenant", tenant_id=1
    )
    assert result["deleted"] == 1
    assert deleted_uuids == ["c"]


@pytest.mark.asyncio
async def test_apply_retention_days(monkeypatch):
    policy = normalize_data_backup_policy({"retention": {"mode": "days", "days": 7}})
    old = SimpleNamespace(uuid="old")
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.exclude = MagicMock(return_value=q)
    q.all = AsyncMock(return_value=[old])
    monkeypatch.setattr(policy_mod.DataBackup, "filter", MagicMock(return_value=q))

    deleted = []

    async def _delete(tenant_id, uuid, *, is_infra_admin=False):
        deleted.append(uuid)

    monkeypatch.setattr(
        "core.services.system.data_backup_service.DataBackupService.delete_backup",
        _delete,
    )

    result = await apply_retention_for_policy(
        policy, backup_scope="all", tenant_id=None
    )
    assert result["deleted"] == 1
    assert deleted == ["old"]
    assert any(
        "completed_at__lt" in (call.kwargs or {}) for call in q.filter.call_args_list
    )
