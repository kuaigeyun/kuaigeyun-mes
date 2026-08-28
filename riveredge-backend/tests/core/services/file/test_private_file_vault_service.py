"""保密文件库服务单测。"""

import pytest
from fastapi import HTTPException

from core.services.file.private_file_vault_service import PrivateFileVaultService


@pytest.mark.asyncio
async def test_private_vault_set_unlock_and_verify(monkeypatch):
    stored: dict = {}

    async def fake_get_password_hash(tenant_id: int) -> str:
        return stored.get("hash", "")

    async def fake_save_password_hash(tenant_id: int, password_hash: str) -> None:
        stored["hash"] = password_hash

    monkeypatch.setattr(PrivateFileVaultService, "_get_password_hash", fake_get_password_hash)
    monkeypatch.setattr(PrivateFileVaultService, "_save_password_hash", fake_save_password_hash)

    await PrivateFileVaultService.set_password(1, "secret123")
    status = await PrivateFileVaultService.get_status(1)
    assert status["configured"] is True

    with pytest.raises(HTTPException) as wrong:
        await PrivateFileVaultService.unlock(1, 10, "wrong")
    assert wrong.value.status_code == 403

    unlocked = await PrivateFileVaultService.unlock(1, 10, "secret123")
    assert unlocked["token"]
    assert PrivateFileVaultService.verify_unlock_token(unlocked["token"], 1, 10)
    assert not PrivateFileVaultService.verify_unlock_token(unlocked["token"], 1, 11)


def test_is_private_category():
    assert PrivateFileVaultService.is_private_category("company-seal")
    assert PrivateFileVaultService.is_private_category("@private-files")
    assert not PrivateFileVaultService.is_private_category("site-logo")
