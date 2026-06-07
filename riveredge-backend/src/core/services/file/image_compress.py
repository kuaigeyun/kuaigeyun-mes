"""
上传图片压缩：限制长边、JPEG 质量与 PNG 优化，在体积与观感间取平衡。

客户端亦应预压缩以减少上行流量；此处作为全端统一兜底。
"""

from __future__ import annotations

from io import BytesIO
from typing import Tuple

# 与前端 / 移动端 compressImageForUpload 常量对齐
MAX_IMAGE_DIMENSION = 1920
JPEG_QUALITY = 85
MIN_COMPRESS_BYTES = 80 * 1024

_COMPRESSIBLE_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "webp", "bmp"})
_SKIP_EXTENSIONS = frozenset({"svg", "gif"})


def compress_image_content(
    file_content: bytes,
    file_extension: str,
) -> Tuple[bytes, str]:
    """
    压缩可处理的位图；矢量 / 动图 / 过小文件原样返回。

    Returns:
        (content, effective_extension)
    """
    ext = (file_extension or "").lower().lstrip(".")
    if ext in _SKIP_EXTENSIONS or ext not in _COMPRESSIBLE_EXTENSIONS:
        return file_content, ext
    if len(file_content) < MIN_COMPRESS_BYTES:
        return file_content, ext

    try:
        from PIL import Image, ImageOps

        img = Image.open(BytesIO(file_content))
        img = ImageOps.exif_transpose(img)

        w, h = img.size
        max_dim = max(w, h)
        if max_dim > MAX_IMAGE_DIMENSION:
            scale = MAX_IMAGE_DIMENSION / max_dim
            img = img.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))),
                Image.Resampling.LANCZOS,
            )

        has_alpha = img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        )

        buf = BytesIO()
        if has_alpha and ext in ("png", "webp"):
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "png"

        if img.mode == "P":
            img = img.convert("RGB")
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        if img.mode == "L":
            img = img.convert("RGB")

        img.save(
            buf,
            format="JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
            progressive=True,
        )
        return buf.getvalue(), "jpeg"
    except Exception:
        return file_content, ext


def effective_storage_extension(original_extension: str, compressed_extension: str) -> str:
    ext = compressed_extension or original_extension
    return ext.lower().lstrip(".")
