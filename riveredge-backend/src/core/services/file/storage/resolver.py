from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional, Tuple

from core.models.file import File
from core.models.integration_config import IntegrationConfig
from core.services.file.storage.base import FileStorageBackend
from core.services.file.storage.local import LocalFileStorage
from core.services.file.storage.tencent_cos import TencentCosStorage
from core.services.system.site_setting_service import SiteSettingService
from infra.exceptions.exceptions import ValidationError

SUPPORTED_OBJECT_STORAGE_TYPES = ("tencent_cos",)

DEFAULT_FILE_STORAGE: Dict[str, Any] = {
    "backend": "local",
    "connection_uuid": None,
    "key_prefix": "",
    "delete_local_after_migrate": True,
}


def apply_key_prefix(key_prefix: str, storage_path: str) -> str:
    prefix = str(key_prefix or "").strip().strip("/")
    path = str(storage_path or "").lstrip("/")
    if not prefix:
        return path
    if path.startswith(f"{prefix}/"):
        return path
    return f"{prefix}/{path}"


def _normalize_settings(raw: Any) -> Dict[str, Any]:
    out = deepcopy(DEFAULT_FILE_STORAGE)
    if not isinstance(raw, dict):
        return out
    backend = str(raw.get("backend") or "local").strip().lower()
    if backend not in ("local", "connection"):
        backend = "local"
    out["backend"] = backend
    uuid_raw = raw.get("connection_uuid")
    out["connection_uuid"] = str(uuid_raw).strip() if uuid_raw else None
    out["key_prefix"] = str(raw.get("key_prefix") or "").strip().strip("/")
    out["delete_local_after_migrate"] = raw.get("delete_local_after_migrate") is not False
    if backend == "local":
        out["connection_uuid"] = None
    return out


async def get_file_storage_settings(tenant_id: int) -> Dict[str, Any]:
    site = await SiteSettingService.get_settings(tenant_id)
    settings = site.settings or {}
    return _normalize_settings(settings.get("file_storage"))


async def save_file_storage_settings(tenant_id: int, incoming: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _normalize_settings(incoming)
    if normalized["backend"] == "connection":
        conn_uuid = normalized.get("connection_uuid")
        if not conn_uuid:
            raise ValidationError("请选择对象存储连接")
        ic = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=conn_uuid,
            deleted_at__isnull=True,
        ).first()
        if not ic or not ic.is_active:
            raise ValidationError("对象存储连接不存在或未启用")
        if ic.type not in SUPPORTED_OBJECT_STORAGE_TYPES:
            raise ValidationError(f"暂不支持该存储类型：{ic.type}（当前仅支持腾讯云 COS）")

    site = await SiteSettingService.get_settings(tenant_id)
    settings = dict(site.settings or {})
    settings["file_storage"] = normalized
    site.settings = settings
    await site.save(update_fields=["settings", "updated_at"])
    return normalized


async def load_cos_storage(tenant_id: int, connection_uuid: str) -> TencentCosStorage:
    ic = await IntegrationConfig.filter(
        tenant_id=tenant_id,
        uuid=connection_uuid,
        deleted_at__isnull=True,
    ).first()
    if not ic:
        raise ValidationError("对象存储连接不存在")
    if ic.type != "tencent_cos":
        raise ValidationError(f"暂不支持该存储类型：{ic.type}")
    if not ic.is_active:
        raise ValidationError("对象存储连接未启用")
    return TencentCosStorage(ic.get_config(), connection_uuid=str(ic.uuid))


async def resolve_storage_for_upload(
    tenant_id: int,
) -> Tuple[FileStorageBackend, Dict[str, Any]]:
    """返回 (adapter, meta) meta 含 storage_backend / storage_connection_uuid / key_prefix。"""
    cfg = await get_file_storage_settings(tenant_id)
    if cfg["backend"] != "connection" or not cfg.get("connection_uuid"):
        return LocalFileStorage(), {
            "storage_backend": "local",
            "storage_connection_uuid": None,
            "key_prefix": cfg.get("key_prefix") or "",
        }
    storage = await load_cos_storage(tenant_id, cfg["connection_uuid"])
    return storage, {
        "storage_backend": "tencent_cos",
        "storage_connection_uuid": cfg["connection_uuid"],
        "key_prefix": cfg.get("key_prefix") or "",
    }


async def resolve_storage_for_file(tenant_id: int, file_row: File) -> FileStorageBackend:
    backend = str(getattr(file_row, "storage_backend", None) or "local").strip().lower()
    if backend in ("", "local"):
        return LocalFileStorage()
    if backend == "tencent_cos":
        conn_uuid = str(getattr(file_row, "storage_connection_uuid", None) or "").strip()
        if not conn_uuid:
            raise ValidationError("文件标记为 COS 存储，但未关联连接 UUID")
        return await load_cos_storage(tenant_id, conn_uuid)
    raise ValidationError(f"不支持的存储后端：{backend}")
