from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class FileStorageBackend(ABC):
    """文件字节读写适配器。"""

    backend_name: str = "local"
    connection_uuid: Optional[str] = None

    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get(self, key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> bool:
        raise NotImplementedError

    async def exists(self, key: str) -> bool:
        try:
            await self.get(key)
            return True
        except Exception:
            return False
