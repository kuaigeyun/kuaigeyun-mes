"""manifest.permissions 数组顺序驱动角色矩阵排序。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.services.authorization.permission_registry_service import PermissionRegistryService

HAOLIGO_MANIFEST = Path(__file__).resolve().parents[1] / "src" / "apps" / "haoligo" / "manifest.json"


def _load_manifest_permissions() -> list[str]:
    data = json.loads(HAOLIGO_MANIFEST.read_text(encoding="utf-8"))
    return [str(c).strip().lower() for c in data.get("permissions") or [] if str(c).strip()]


def test_trial_sheet_permissions_manifest_order() -> None:
    codes = _load_manifest_permissions()
    trial = [c for c in codes if c.startswith("haoligo:molds-documents-trial:")]
    assert trial, "应包含试模单权限码"

    def idx(action: str) -> int:
        code = f"haoligo:molds-documents-trial:{action}"
        return codes.index(code)

    # 标准 CRUD/IO
    assert idx("read") < idx("create") < idx("update") < idx("delete")
    assert idx("delete") < idx("import") < idx("export") < idx("print")
    # 审核合并组
    assert idx("print") < idx("approve") < idx("audit") < idx("reject")
    # 试模业务子操作在审核之后
    assert idx("reject") < idx("dispatch") < idx("confirm_adjustment") < idx("recall")


@pytest.mark.asyncio
async def test_permission_definition_carries_manifest_index(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _enabled(_tenant_id: int) -> set[str]:
        return {"haoligo"}

    monkeypatch.setattr(
        PermissionRegistryService,
        "_get_enabled_app_codes",
        _enabled,
    )
    defs = await PermissionRegistryService.collect_definitions(tenant_id=1)
    trial_read = defs.get("haoligo:molds-documents-trial:read")
    trial_dispatch = defs.get("haoligo:molds-documents-trial:dispatch")
    assert trial_read is not None and trial_read.manifest_index is not None
    assert trial_dispatch is not None and trial_dispatch.manifest_index is not None
    assert trial_read.manifest_index < trial_dispatch.manifest_index
