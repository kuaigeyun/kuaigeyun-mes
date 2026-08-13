"""文件物理存储适配器（本地磁盘 / 腾讯 COS / MinIO 等）。"""

from .base import FileStorageBackend
from .resolver import (
    OBJECT_STORAGE_TYPE_LABELS,
    SUPPORTED_OBJECT_STORAGE_TYPES,
    apply_key_prefix,
    get_file_storage_settings,
    load_cos_storage,
    load_object_storage,
    resolve_storage_for_file,
    resolve_storage_for_upload,
    save_file_storage_settings,
)

__all__ = [
    "FileStorageBackend",
    "OBJECT_STORAGE_TYPE_LABELS",
    "SUPPORTED_OBJECT_STORAGE_TYPES",
    "apply_key_prefix",
    "get_file_storage_settings",
    "load_cos_storage",
    "load_object_storage",
    "resolve_storage_for_file",
    "resolve_storage_for_upload",
    "save_file_storage_settings",
]
