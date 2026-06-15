"""
图片三档存储：缩略图(列表) / 预览图(点击预览) / 原图(查看原图)。

档位文件持久化在 uploads/thumbnails/{uuid}_{size}.bin，
与 download?size= 共用同一路径，避免重复生成。
"""

from __future__ import annotations

import os
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from infra.config.infra_config import infra_settings as settings

# 与前端 FILE_IMAGE_SIZE_THUMB / FILE_IMAGE_SIZE_MEDIUM 对齐
IMAGE_TIER_THUMB_SIZE = 64
IMAGE_TIER_PREVIEW_SIZE = 512
IMAGE_TIER_SIZES: Tuple[int, ...] = (IMAGE_TIER_THUMB_SIZE, IMAGE_TIER_PREVIEW_SIZE)

_UPLOAD_DIR = getattr(settings, "FILE_UPLOAD_DIR", "./uploads")

_SKIP_TIER_EXTENSIONS = frozenset({"svg", "gif"})


class ImageTierService:
    @staticmethod
    def tier_cache_dir() -> str:
        path = os.path.join(_UPLOAD_DIR, "thumbnails")
        os.makedirs(path, exist_ok=True)
        return path

    @staticmethod
    def tier_cache_path(file_uuid: str, size: int) -> str:
        return os.path.join(ImageTierService.tier_cache_dir(), f"{file_uuid}_{size}.bin")

    @staticmethod
    def tier_exists(file_uuid: str, size: int) -> bool:
        return os.path.isfile(ImageTierService.tier_cache_path(file_uuid, size))

    @staticmethod
    def read_tier_bytes(file_uuid: str, size: int) -> Optional[bytes]:
        path = ImageTierService.tier_cache_path(file_uuid, size)
        if not os.path.isfile(path):
            return None
        with open(path, "rb") as f:
            return f.read()

    @staticmethod
    def write_tier_bytes(file_uuid: str, size: int, data: bytes) -> None:
        path = ImageTierService.tier_cache_path(file_uuid, size)
        with open(path, "wb") as f:
            f.write(data)

    @staticmethod
    def delete_tier_cache(file_uuid: str) -> None:
        for size in IMAGE_TIER_SIZES:
            path = ImageTierService.tier_cache_path(file_uuid, size)
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except OSError as e:
                logger.warning(f"删除图片档位缓存失败 {path}: {e}")

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
    def ensure_tiers_for_content(
        file_uuid: str,
        file_content: bytes,
        file_type: str,
        sizes: Optional[Tuple[int, ...]] = None,
        force: bool = False,
    ) -> Dict[int, bool]:
        if not ImageTierService.is_tier_eligible_image(file_type):
            return {}

        target_sizes = sizes or IMAGE_TIER_SIZES
        result: Dict[int, bool] = {}
        for size in target_sizes:
            if not force and ImageTierService.tier_exists(file_uuid, size):
                result[size] = False
                continue
            try:
                tier_bytes, _ = ImageTierService.generate_tier_bytes(file_content, size)
                ImageTierService.write_tier_bytes(file_uuid, size, tier_bytes)
                result[size] = True
            except Exception as e:
                logger.warning(f"生成图片档位失败 uuid={file_uuid} size={size}: {e}")
                result[size] = False
        return result

    @staticmethod
    async def ensure_tiers_for_file_uuid(
        tenant_id: int,
        file_uuid: str,
        force: bool = False,
    ) -> Dict[int, bool]:
        from core.services.file.file_service import FileService as FS

        file = await FS.get_file_by_uuid(tenant_id, file_uuid)
        if not ImageTierService.is_tier_eligible_image(file.file_type, file.file_extension):
            return {}
        content = await FS.get_file_content(tenant_id, file_uuid)
        file_type = FS.resolve_download_media_type(file, content)
        return ImageTierService.ensure_tiers_for_content(
            file_uuid, content, file_type, force=force,
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
                content = await FS.get_file_content(tenant_id, file.uuid)
                file_type = FS.resolve_download_media_type(file, content)
                tier_result = ImageTierService.ensure_tiers_for_content(
                    file.uuid,
                    content,
                    file_type,
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
    def streaming_response_for_tier(
        file_uuid: str,
        size: int,
        file_type: str,
        file_content: bytes,
    ):
        """命中或生成档位后返回 StreamingResponse；失败时返回 None。"""
        from fastapi.responses import StreamingResponse

        cached = ImageTierService.read_tier_bytes(file_uuid, size)
        if cached is not None:
            is_png = file_type == "image/png"
            media = "image/png" if is_png else "image/jpeg"
            ext = "png" if is_png else "jpg"
            return StreamingResponse(
                iter([cached]),
                media_type=media,
                headers={
                    "Content-Disposition": f"inline; filename=\"thumb_{size}.{ext}\"",
                    "Content-Length": str(len(cached)),
                    "Cache-Control": "public, max-age=86400",
                    "X-Cache": "HIT",
                },
            )

        try:
            tier_bytes, media = ImageTierService.generate_tier_bytes(file_content, size)
            ImageTierService.write_tier_bytes(file_uuid, size, tier_bytes)
            ext = "png" if media == "image/png" else "jpg"
            return StreamingResponse(
                iter([tier_bytes]),
                media_type=media,
                headers={
                    "Content-Disposition": f"inline; filename=\"thumb_{size}.{ext}\"",
                    "Content-Length": str(len(tier_bytes)),
                    "Cache-Control": "public, max-age=86400",
                    "X-Cache": "MISS",
                },
            )
        except Exception as e:
            logger.warning(f"缩略图生成失败 uuid={file_uuid} size={size}: {e}")
            return None
