"""
图片三档存储：缩略图(列表) / 预览图(点击预览) / 原图(查看原图)。

档位与原文件走同一 FileStorageBackend：
本地 → uploads/thumbnails/{uuid}_{size}.bin
COS → {key_prefix}/thumbnails/{uuid}_{size}.bin
禁止 COS 原文件仍从本机 sidecar 读档位。
"""

from __future__ import annotations

import os
import re
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from core.services.file.storage import apply_key_prefix
from core.services.file.storage.base import FileStorageBackend
from infra.config.infra_config import infra_settings as settings

# 与前端 FILE_IMAGE_SIZE_THUMB / FILE_IMAGE_SIZE_MEDIUM 对齐
IMAGE_TIER_THUMB_SIZE = 64
IMAGE_TIER_PREVIEW_SIZE = 512
IMAGE_TIER_SIZES: Tuple[int, ...] = (IMAGE_TIER_THUMB_SIZE, IMAGE_TIER_PREVIEW_SIZE)

TIER_KEY_PREFIX = "thumbnails"
_TIER_FILENAME_RE = re.compile(
    r"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})_(\d+)\.bin$"
)
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

_UPLOAD_DIR = getattr(settings, "FILE_UPLOAD_DIR", "./uploads")

_SKIP_TIER_EXTENSIONS = frozenset({"svg", "gif"})


class ImageTierService:
    @staticmethod
    def tier_relative_key(file_uuid: str, size: int) -> str:
        return f"{TIER_KEY_PREFIX}/{file_uuid}_{size}.bin"

    @staticmethod
    def tier_object_key(file_uuid: str, size: int, key_prefix: str = "") -> str:
        return apply_key_prefix(key_prefix, ImageTierService.tier_relative_key(file_uuid, size))

    @staticmethod
    def parse_local_tier_filename(name: str) -> Optional[Tuple[str, int]]:
        match = _TIER_FILENAME_RE.match(str(name or "").strip())
        if not match:
            return None
        size = int(match.group(2))
        if size not in IMAGE_TIER_SIZES:
            return None
        return match.group(1).lower(), size

    @staticmethod
    def tier_content_type(data: bytes) -> str:
        if data[:8] == _PNG_MAGIC:
            return "image/png"
        return "image/jpeg"

    @staticmethod
    def sniff_local_image_content_type(abs_path: str) -> str:
        with open(abs_path, "rb") as f:
            head = f.read(8)
        return ImageTierService.tier_content_type(head)

    @staticmethod
    def tier_cache_dir() -> str:
        path = os.path.join(_UPLOAD_DIR, TIER_KEY_PREFIX)
        os.makedirs(path, exist_ok=True)
        return path

    @staticmethod
    def tier_cache_path(file_uuid: str, size: int) -> str:
        return os.path.join(ImageTierService.tier_cache_dir(), f"{file_uuid}_{size}.bin")

    @staticmethod
    def delete_local_tier_files(file_uuid: str) -> None:
        """清理本机 sidecar（迁移后残留或 COS 文件误写本地）。读路径不得再走这里。"""
        for size in IMAGE_TIER_SIZES:
            path = os.path.join(_UPLOAD_DIR, TIER_KEY_PREFIX, f"{file_uuid}_{size}.bin")
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except OSError as e:
                logger.warning(f"删除本地图片档位失败 {path}: {e}")

    @staticmethod
    async def key_prefix_for_file(tenant_id: int, file_row: Any) -> str:
        backend = str(getattr(file_row, "storage_backend", None) or "local").strip().lower()
        if backend in ("", "local"):
            return ""
        from core.services.file.storage import get_file_storage_settings

        cfg = await get_file_storage_settings(tenant_id)
        prefix = str(cfg.get("key_prefix") or "").strip().strip("/")
        path = str(getattr(file_row, "file_path", None) or "").lstrip("/")
        if prefix and path.startswith(f"{prefix}/"):
            return prefix
        return ""

    @staticmethod
    async def read_tier_from_storage(
        storage: FileStorageBackend,
        file_uuid: str,
        size: int,
        key_prefix: str = "",
    ) -> Optional[bytes]:
        key = ImageTierService.tier_object_key(file_uuid, size, key_prefix)
        if not await storage.exists(key):
            return None
        return await storage.get(key)

    @staticmethod
    async def write_tier_to_storage(
        storage: FileStorageBackend,
        file_uuid: str,
        size: int,
        data: bytes,
        key_prefix: str = "",
        content_type: Optional[str] = None,
    ) -> None:
        key = ImageTierService.tier_object_key(file_uuid, size, key_prefix)
        media = content_type or ImageTierService.tier_content_type(data)
        await storage.put(key, data, content_type=media)

    @staticmethod
    async def delete_tiers_from_storage(
        storage: FileStorageBackend,
        file_uuid: str,
        key_prefix: str = "",
    ) -> None:
        for size in IMAGE_TIER_SIZES:
            await storage.delete(ImageTierService.tier_object_key(file_uuid, size, key_prefix))

    @staticmethod
    async def delete_tiers_for_file(tenant_id: int, file_row: Any) -> None:
        from core.services.file.storage import resolve_storage_for_file

        storage = await resolve_storage_for_file(tenant_id, file_row)
        prefix = await ImageTierService.key_prefix_for_file(tenant_id, file_row)
        await ImageTierService.delete_tiers_from_storage(storage, str(file_row.uuid), prefix)
        ImageTierService.delete_local_tier_files(str(file_row.uuid))

    @staticmethod
    def is_tier_eligible_image(
        file_type: Optional[str],
        file_extension: Optional[str] = None,
    ) -> bool:
        if not file_type or not file_type.lower().startswith("image/"):
            return False
        ext = (file_extension or "").lower().lstrip(".")
        if ext in _SKIP_TIER_EXTENSIONS:
            return False
        mime = file_type.lower()
        if mime in ("image/svg+xml", "image/gif"):
            return False
        return True

    @staticmethod
    def generate_tier_bytes(file_content: bytes, size: int) -> Tuple[bytes, str]:
        from PIL import Image

        img = Image.open(BytesIO(file_content))
        has_alpha = img.mode in ("RGBA", "LA", "P")
        if has_alpha:
            img = img.convert("RGBA")
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png"

        if img.mode == "P":
            img = img.convert("RGB")
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue(), "image/jpeg"

    @staticmethod
    async def ensure_tiers_for_content(
        file_uuid: str,
        file_content: bytes,
        file_type: str,
        storage: FileStorageBackend,
        key_prefix: str = "",
        sizes: Optional[Tuple[int, ...]] = None,
        force: bool = False,
    ) -> Dict[int, bool]:
        if not ImageTierService.is_tier_eligible_image(file_type):
            return {}

        target_sizes = sizes or IMAGE_TIER_SIZES
        result: Dict[int, bool] = {}
        for size in target_sizes:
            key = ImageTierService.tier_object_key(file_uuid, size, key_prefix)
            if not force and await storage.exists(key):
                result[size] = False
                continue
            try:
                tier_bytes, media = ImageTierService.generate_tier_bytes(file_content, size)
            except Exception as e:
                logger.warning(f"生成图片档位失败 uuid={file_uuid} size={size}: {e}")
                result[size] = False
                continue
            await ImageTierService.write_tier_to_storage(
                storage, file_uuid, size, tier_bytes, key_prefix, content_type=media,
            )
            result[size] = True
        return result

    @staticmethod
    async def ensure_tiers_for_file_uuid(
        tenant_id: int,
        file_uuid: str,
        force: bool = False,
    ) -> Dict[int, bool]:
        from core.services.file.file_service import FileService as FS
        from core.services.file.storage import resolve_storage_for_file

        file = await FS.get_file_by_uuid(tenant_id, file_uuid)
        if not ImageTierService.is_tier_eligible_image(file.file_type, file.file_extension):
            return {}
        storage = await resolve_storage_for_file(tenant_id, file)
        prefix = await ImageTierService.key_prefix_for_file(tenant_id, file)
        content = await storage.get(file.file_path)
        file_type = FS.resolve_download_media_type(file, content)
        return await ImageTierService.ensure_tiers_for_content(
            file_uuid, content, file_type, storage, key_prefix=prefix, force=force,
        )

    @staticmethod
    async def backfill_image_tiers(
        tenant_id: int,
        limit: int = 50,
        offset: int = 0,
        category: Optional[str] = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        from core.models.file import File
        from core.services.file.file_service import FileService as FS
        from core.services.file.storage import resolve_storage_for_file

        query = File.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            file_type__startswith="image/",
        )
        if category:
            query = query.filter(category=category)

        total_images = await query.count()
        files = await query.order_by("id").offset(offset).limit(limit).all()

        processed = 0
        generated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []

        for file in files:
            if not ImageTierService.is_tier_eligible_image(file.file_type, file.file_extension):
                skipped += 1
                continue
            try:
                storage = await resolve_storage_for_file(tenant_id, file)
                prefix = await ImageTierService.key_prefix_for_file(tenant_id, file)
                content = await storage.get(file.file_path)
                file_type = FS.resolve_download_media_type(file, content)
                tier_result = await ImageTierService.ensure_tiers_for_content(
                    file.uuid,
                    content,
                    file_type,
                    storage,
                    key_prefix=prefix,
                    force=force,
                )
                processed += 1
                if any(tier_result.values()):
                    generated += 1
                elif tier_result:
                    skipped += 1
            except Exception as e:
                failed += 1
                msg = f"{file.uuid}: {e}"
                errors.append(msg)
                logger.warning(f"存量图片档位生成失败 {file.uuid}: {e}")

        batch_len = len(files)
        next_offset = offset + batch_len
        remaining = max(0, total_images - next_offset)

        return {
            "total_images": total_images,
            "batch_size": batch_len,
            "processed": processed,
            "generated": generated,
            "skipped": skipped,
            "failed": failed,
            "next_offset": next_offset,
            "remaining": remaining,
            "done": batch_len == 0 or next_offset >= total_images,
            "errors": errors[:20],
        }

    @staticmethod
    def _tier_streaming_response(data: bytes, size: int, cache_hit: bool):
        from fastapi.responses import StreamingResponse

        media = ImageTierService.tier_content_type(data)
        ext = "png" if media == "image/png" else "jpg"
        return StreamingResponse(
            iter([data]),
            media_type=media,
            headers={
                "Content-Disposition": f'inline; filename="thumb_{size}.{ext}"',
                "Content-Length": str(len(data)),
                "Cache-Control": "public, max-age=86400",
                "X-Cache": "HIT" if cache_hit else "MISS",
            },
        )

    @staticmethod
    async def streaming_response_for_tier(
        tenant_id: int,
        file_row: Any,
        size: int,
        file_content: Optional[bytes] = None,
    ):
        """从文件所属存储读写档位；未命中则拉原图生成并写回同一后端。"""
        from core.services.file.storage import resolve_storage_for_file

        storage = await resolve_storage_for_file(tenant_id, file_row)
        prefix = await ImageTierService.key_prefix_for_file(tenant_id, file_row)
        file_uuid = str(file_row.uuid)
        cached = await ImageTierService.read_tier_from_storage(storage, file_uuid, size, prefix)
        if cached is not None:
            return ImageTierService._tier_streaming_response(cached, size, cache_hit=True)

        content = file_content
        if content is None:
            content = await storage.get(file_row.file_path)

        try:
            tier_bytes, media = ImageTierService.generate_tier_bytes(content, size)
            await ImageTierService.write_tier_to_storage(
                storage, file_uuid, size, tier_bytes, prefix, content_type=media,
            )
            return ImageTierService._tier_streaming_response(tier_bytes, size, cache_hit=False)
        except Exception as e:
            logger.warning(f"缩略图生成失败 uuid={file_uuid} size={size}: {e}")
            return None
