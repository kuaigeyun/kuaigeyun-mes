from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from core.services.system import data_backup_policy
from core.services.system import data_backup_service as service


def _backup():
    return SimpleNamespace(
        uuid="backup-1",
        tenant_id=1,
        file_path=None,
        storage_backend="rustfs",
        storage_connection_uuid="connection-1",
        storage_key="data-backups/backup-1.zip",
        storage_owner_tenant_id=1,
        delete=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_delete_backup_keeps_record_when_remote_delete_fails(monkeypatch):
    backup = _backup()
    monkeypatch.setattr(
        service.DataBackupService,
        "get_backup_by_uuid",
        AsyncMock(return_value=backup),
    )
    monkeypatch.setattr(
        data_backup_policy,
        "delete_remote_backup_object",
        AsyncMock(side_effect=RuntimeError("rustfs unavailable")),
    )

    with pytest.raises(RuntimeError, match="rustfs unavailable"):
        await service.DataBackupService.delete_backup(1, "backup-1")

    backup.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_backup_removes_record_after_remote_delete(monkeypatch):
    backup = _backup()
    monkeypatch.setattr(
        service.DataBackupService,
        "get_backup_by_uuid",
        AsyncMock(),
    )
    service.DataBackupService.get_backup_by_uuid.return_value = backup
    monkeypatch.setattr(
        data_backup_policy,
        "delete_remote_backup_object",
        AsyncMock(),
    )

    await service.DataBackupService.delete_backup(1, "backup-1")

    backup.delete.assert_awaited_once()
