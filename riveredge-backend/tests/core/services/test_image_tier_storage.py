"""图片档位必须与原文件走同一 FileStorageBackend，禁止本机 sidecar 旁路 COS。"""

from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from core.services.file.image_tier_service import (
    IMAGE_TIER_THUMB_SIZE,
    ImageTierService,
)
from core.services.file.storage.base import FileStorageBackend
from infra.exceptions.exceptions import NotFoundError


class MemoryStorage(FileStorageBackend):
    backend_name = "memory"

    def __init__(self):
        self.objects = {}

    async def put(self, key: str, data: bytes, content_type=None) -> None:
        self.objects[key] = bytes(data)

    async def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise NotFoundError("文件")
        return self.objects[key]

    async def delete(self, key: str) -> bool:
        self.objects.pop(key, None)
        return True

    async def exists(self, key: str) -> bool:
        return key in self.objects


def _jpeg_bytes(width: int = 32, height: int = 32) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (width, height), (200, 40, 40)).save(buf, format="JPEG")
    return buf.getvalue()


def test_tier_keys_use_thumbnails_prefix_and_optional_bucket_prefix():
    uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    assert ImageTierService.tier_relative_key(uuid, 64) == f"thumbnails/{uuid}_64.bin"
    assert (
        ImageTierService.tier_object_key(uuid, 64, "prod")
        == f"prod/thumbnails/{uuid}_64.bin"
    )
    assert ImageTierService.tier_object_key(uuid, 64, "") == f"thumbnails/{uuid}_64.bin"


def test_parse_local_tier_filename():
    uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    assert ImageTierService.parse_local_tier_filename(f"{uuid}_64.bin") == (uuid, 64)
    assert ImageTierService.parse_local_tier_filename(f"{uuid}_512.bin") == (uuid, 512)
    assert ImageTierService.parse_local_tier_filename(f"{uuid}_128.bin") is None
    assert ImageTierService.parse_local_tier_filename("not-a-tier.jpg") is None


@pytest.mark.asyncio
async def test_ensure_tiers_writes_to_storage_backend_not_implicit_disk():
    storage = MemoryStorage()
    uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    original = _jpeg_bytes()
    result = await ImageTierService.ensure_tiers_for_content(
        uuid,
        original,
        "image/jpeg",
        storage,
        key_prefix="prod",
    )
    assert result[IMAGE_TIER_THUMB_SIZE] is True
    key = ImageTierService.tier_object_key(uuid, IMAGE_TIER_THUMB_SIZE, "prod")
    assert key in storage.objects
    assert storage.objects[key][:2] == b"\xff\xd8"


@pytest.mark.asyncio
async def test_streaming_response_reads_tier_from_same_storage(monkeypatch):
    storage = MemoryStorage()
    uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    original = _jpeg_bytes()
    await storage.put("1/2026/08/photo.jpg", original, content_type="image/jpeg")
    await ImageTierService.ensure_tiers_for_content(
        uuid, original, "image/jpeg", storage, key_prefix="",
    )

    async def fake_resolve(tenant_id, file_row):
        return storage

    async def fake_prefix(tenant_id, file_row):
        return ""

    monkeypatch.setattr(
        "core.services.file.storage.resolve_storage_for_file",
        fake_resolve,
    )
    monkeypatch.setattr(ImageTierService, "key_prefix_for_file", fake_prefix)

    file_row = SimpleNamespace(
        uuid=uuid,
        file_path="1/2026/08/photo.jpg",
        file_type="image/jpeg",
        storage_backend="tencent_cos",
        storage_connection_uuid="conn-1",
    )
    resp = await ImageTierService.streaming_response_for_tier(1, file_row, 64)
    assert resp is not None
    assert resp.headers.get("X-Cache") == "HIT"
    assert resp.headers.get("Content-Length") == str(
        len(storage.objects[f"thumbnails/{uuid}_64.bin"])
    )
