from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from core.tasks import data_backup_handlers as worker


@pytest.mark.asyncio
@pytest.mark.parametrize("requested,failed", [(True, True), (True, False), (False, True)])
async def test_restore_requires_requested_prebackup(monkeypatch, tmp_path, requested, failed):
    archive = tmp_path / "fixture.zip"
    archive.write_bytes(b"fixture")
    monkeypatch.setattr(worker, "resolve_data_backup_dir", lambda: str(tmp_path))
    monkeypatch.setattr(worker, "resolve_backup_file_path", lambda p: p)
    monkeypatch.setattr(worker, "store_backup_file_path", lambda p: p)
    monkeypatch.setattr(worker, "read_backup_metadata", lambda p: {})
    monkeypatch.setattr(worker, "resolve_backup_scope_for_restore", lambda *a, **kw: "all")
    monkeypatch.setattr(worker, "is_tenant_sql_dump", lambda p: False)
    monkeypatch.setattr(worker, "is_full_logical_csv_dump", lambda p: False)
    monkeypatch.setattr(worker.DataBackup, "create", AsyncMock(return_value=SimpleNamespace(uuid="fixture")))
    mark = AsyncMock()
    monkeypatch.setattr(worker, "_mark_restore_status", mark)
    calls = []
    async def run(name, fn):
        calls.append(name)
        if name == "create_pre_restore_backup" and failed:
            raise OSError("fixture disk full")
        # Do not invoke any real restore, process, or filesystem callback.
        return str(archive)
    ctx = SimpleNamespace(event=SimpleNamespace(data={"backup_uuid": "fixture", "target_tenant_id": 1,
        "file_path": str(archive), "create_pre_restore_backup": requested, "allow_global_restore": True}))
    await worker.handle_database_restore_requested(ctx, SimpleNamespace(run=run))
    if requested and failed:
        assert calls == ["create_pre_restore_backup"]
        assert mark.call_args.kwargs["status"] == "failed"
        assert "fixture disk full" in mark.call_args.kwargs["error_message"]
    else:
        assert "pg_restore" in calls
        assert mark.call_args.kwargs["status"] == "success"
