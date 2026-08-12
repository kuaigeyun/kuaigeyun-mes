"""文件物理存储适配器（本地磁盘 / 腾讯 COS 等）。"""

from .base import FileStorageBackend
from .resolver import (
    SUPPORTED_OBJECT_STORAGE_TYPES,
    apply_key_prefix,
    get_file_storage_settings,
    load_cos_storage,
    resolve_storage_for_file,
    resolve_storage_for_upload,
    save_file_storage_settings,
)

__all__ = [
    "FileStorageBackend",
    "SUPPORTED_OBJECT_STORAGE_TYPES",
    "apply_key_prefix",
    "get_file_storage_settings",
    "load_cos_storage",
    "resolve_storage_for_file",
    "resolve_storage_for_upload",
    "save_file_storage_settings",
]
