import io
import json
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile

from core.api.data_backups import data_backups as api
from core.services.system import data_backup_service as service
from core.tasks import data_backup_handlers as worker


def archive(scope):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as z:
        z.writestr("backup_metadata.json", json.dumps({"backup_scope": scope}))
        z.writestr("database.dump", "fixture, never restore")
    data.seek(0)
    return data


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["upload", "restore"])
async def test_regular_user_cannot_upload_or_restore(monkeypatch, operation):
    user = SimpleNamespace(tenant_id=1, is_infra_admin_user=lambda: False, is_organization_admin=lambda: False)
    monkeypatch.setattr(api.DataBackupService, "upload_backup_file", AsyncMock())
    monkeypatch.setattr(api.DataBackupService, "to_response", lambda _: {})
    monkeypatch.setattr(api.DataBackupService, "restore_backup", AsyncMock(return_value=True))
    with pytest.raises(HTTPException) as exc:
        if operation == "upload":
            await api.upload_backup(UploadFile(filename="fixture.zip", file=archive("all")), "fixture", user)
        else:
            await api.restore_backup("fixture", api.RestoreRequest(confirm=True), user)
    assert exc.value.status_code == 403
    api.DataBackupService.restore_backup.assert_not_awaited()
    api.DataBackupService.upload_backup_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_regular_user_cannot_list_backup_storage_connections(monkeypatch):
    user = SimpleNamespace(
        tenant_id=1,
        is_infra_admin_user=lambda: False,
        is_organization_admin=lambda: False,
    )
    monkeypatch.setattr(api, "list_storage_connections", AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await api.get_backup_storage_connections(user, 1)

    assert exc.value.status_code == 403
    api.list_storage_connections.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", ["all", "table"])
async def test_upload_service_rejects_global_scope_by_default(monkeypatch, tmp_path, scope):
    monkeypatch.setattr(service, "resolve_data_backup_dir", lambda: str(tmp_path))
    monkeypatch.setattr(service, "store_backup_file_path", lambda p: p)
    create = AsyncMock(return_value=SimpleNamespace(uuid="fixture"))
    monkeypatch.setattr(service.DataBackup, "create", create)
    with pytest.raises(PermissionError):
        await service.DataBackupService.upload_backup_file(1, UploadFile(file=archive(scope)), "fixture")
    create.assert_not_awaited()
    assert not list(tmp_path.iterdir())


@pytest.mark.asyncio
async def test_worker_rejects_unapproved_global_restore(monkeypatch, tmp_path):
    path = tmp_path / "fixture.zip"
    path.write_bytes(archive("all").getvalue())
    monkeypatch.setattr(worker, "resolve_data_backup_dir", lambda: str(tmp_path))
    monkeypatch.setattr(worker, "resolve_backup_file_path", lambda p: p)
    mark = AsyncMock()
    monkeypatch.setattr(worker, "_mark_restore_status", mark)
    step = SimpleNamespace(run=AsyncMock())
    ctx = SimpleNamespace(event=SimpleNamespace(data={"backup_uuid": "fixture", "target_tenant_id": 1, "file_path": str(path), "create_pre_restore_backup": False}))
    await worker.handle_database_restore_requested(ctx, step)
    step.run.assert_not_awaited()
    assert mark.call_args.kwargs["status"] == "failed"


@pytest.mark.asyncio
@pytest.mark.parametrize("platform_admin", [False, True])
async def test_admin_restore_passes_explicit_scope_authorization(monkeypatch, platform_admin):
    user = SimpleNamespace(
        tenant_id=None if platform_admin else 1,
        is_infra_admin=platform_admin,
        is_infra_admin_user=lambda: platform_admin,
        is_organization_admin=lambda: not platform_admin,
    )
    restore = AsyncMock(return_value=True)
    monkeypatch.setattr(api.DataBackupService, "restore_backup", restore)
    expected_target = 2 if platform_admin else 1
    req = api.RestoreRequest(
        confirm=True,
        target_tenant_id=expected_target if platform_admin else None,
    )
    import infra.models.tenant as tenant_mod

    monkeypatch.setattr(
        tenant_mod.Tenant,
        "filter",
        lambda **_kwargs: SimpleNamespace(
            first=AsyncMock(return_value=SimpleNamespace(id=expected_target))
        ),
    )
    result = await api.restore_backup("fixture", req, user)
    assert result.success
    assert restore.call_args.kwargs["allow_global_restore"] is platform_admin
    assert restore.call_args.kwargs["target_tenant_id"] == expected_target


@pytest.mark.asyncio
@pytest.mark.parametrize("scope,allowed", [("tenant", False), ("all", True)])
async def test_authorized_archive_upload(monkeypatch, tmp_path, scope, allowed):
    monkeypatch.setattr(service, "resolve_data_backup_dir", lambda: str(tmp_path))
    monkeypatch.setattr(service, "store_backup_file_path", lambda p: p)
    create = AsyncMock(return_value=SimpleNamespace(uuid="fixture"))
    monkeypatch.setattr(service.DataBackup, "create", create)
    await service.DataBackupService.upload_backup_file(
        1, UploadFile(file=archive(scope)), "fixture", allow_global_backup=allowed,
    )
    assert create.call_args.kwargs["backup_scope"] == scope


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", ["all", "table"])
async def test_restore_rejects_metadata_scope_escalation(monkeypatch, tmp_path, scope):
    path = tmp_path / "fixture.zip"
    path.write_bytes(archive(scope).getvalue())
    backup = SimpleNamespace(status="success", backup_scope="tenant", file_path=str(path), save=AsyncMock())
    monkeypatch.setattr(service.DataBackupService, "get_backup_by_uuid", AsyncMock(return_value=backup))
    monkeypatch.setattr(service, "resolve_backup_file_path", lambda p: p)
    dispatch = AsyncMock()
    monkeypatch.setattr(service, "dispatch_event", dispatch)
    with pytest.raises(PermissionError):
        await service.DataBackupService.restore_backup(1, "fixture")
    backup.save.assert_not_awaited()
    dispatch.assert_not_awaited()
