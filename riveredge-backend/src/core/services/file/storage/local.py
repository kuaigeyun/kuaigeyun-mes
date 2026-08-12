from __future__ import annotations

import os
from typing import Optional

import aiofiles

from core.services.file.storage.base import FileStorageBackend
from infra.config.infra_config import infra_settings as settings
from infra.exceptions.exceptions import NotFoundError


class LocalFileStorage(FileStorageBackend):
    backend_name = "local"
    connection_uuid = None

    def __init__(self, upload_dir: Optional[str] = None):
        self.upload_dir = upload_dir or getattr(settings, "FILE_UPLOAD_DIR", "./uploads")

    def _abs(self, key: str) -> str:
        return os.path.join(self.upload_dir, key)

    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        full = self._abs(key)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        async with aiofiles.open(full, "wb") as f:
            await f.write(data)

    async def get(self, key: str) -> bytes:
        full = self._abs(key)
        if not os.path.isfile(full):
            raise NotFoundError("文件")
        async with aiofiles.open(full, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> bool:
        full = self._abs(key)
        try:
            if os.path.isfile(full):
                os.remove(full)
                return True
        except OSError:
            return False
        return False

    async def exists(self, key: str) -> bool:
        return os.path.isfile(self._abs(key))
