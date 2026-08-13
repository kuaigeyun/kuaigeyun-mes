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

    async def put_file(self, key: str, local_path: str, content_type: Optional[str] = None) -> None:
        """从本地路径写入对象。默认整文件读入再 put；大文件后端应覆盖为流式/分片上传。"""
        with open(local_path, "rb") as f:
            data = f.read()
        await self.put(key, data, content_type=content_type)

    @abstractmethod
    async def get(self, key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> bool:
        raise NotImplementedError

    async def head_content_length(self, key: str) -> Optional[int]:
        try:
            data = await self.get(key)
            return len(data)
        except Exception:
            return None

    async def exists(self, key: str) -> bool:
        try:
            await self.get(key)
            return True
        except Exception:
            return False
