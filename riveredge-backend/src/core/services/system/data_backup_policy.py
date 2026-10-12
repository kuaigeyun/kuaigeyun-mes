"""数据备份策略：定时、存储落点、保留清理（租户 SiteSetting + 平台 PlatformSettings）。"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from core.models.data_backup import DataBackup
from core.models.integration_config import IntegrationConfig
from core.schemas.data_backup import DataBackupCreate
from core.services.file.storage.resolver import (
    OBJECT_STORAGE_TYPE_LABELS,
    SUPPORTED_OBJECT_STORAGE_TYPES,
    apply_key_prefix,
    load_object_storage,
)
from core.services.system.site_setting_service import SiteSettingService
from core.utils.cron_match import assert_cron_valid, match_cron
from core.utils.timezone_utils import resolve_business_datetime, to_site_timezone
from infra.exceptions.exceptions import ValidationError
from infra.models.platform_settings import PlatformSettings

POLICY_KEY = "data_backup_policy"


async def _get_or_create_platform_settings() -> PlatformSettings:
    row = await PlatformSettings.first()
    if row is None:
        row = await PlatformSettings.create(platform_name="RiverEdge SaaS Framework")
    return row

DEFAULT_POLICY: Dict[str, Any] = {
    "schedule_enabled": False,
    "cron": "0 2 * * *",
    "include_files": True,
    "storage": {
        "backend": "local",
        "connection_uuid": None,
        "key_prefix": "data-backups",
        "storage_owner_tenant_id": None,
    },
    "retention": {
        "mode": "none",
        "days": 30,
        "keep_count": 7,
    },
    "last_scheduled_at": None,
    "last_retention_at": None,
}


def _site_wall_clock(dt: datetime) -> datetime:
    return to_site_timezone(dt)


def _same_site_minute(a: Optional[datetime], b: datetime) -> bool:
    if a is None:
        return False
    sa, sb = _site_wall_clock(a), _site_wall_clock(b)
    return (sa.year, sa.month, sa.day, sa.hour, sa.minute) == (
        sb.year,
        sb.month,
        sb.day,
        sb.hour,
        sb.minute,
    )


def _parse_iso_dt(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_data_backup_policy(raw: Any) -> Dict[str, Any]:
    out = deepcopy(DEFAULT_POLICY)
    if not isinstance(raw, dict):
        return out

    out["schedule_enabled"] = bool(raw.get("schedule_enabled"))
    cron = str(raw.get("cron") or out["cron"]).strip()
    out["cron"] = cron or out["cron"]
    out["include_files"] = raw.get("include_files") is not False

    storage_in = raw.get("storage") if isinstance(raw.get("storage"), dict) else {}
    backend = str(storage_in.get("backend") or "local").strip().lower()
    if backend not in ("local", "connection"):
        backend = "local"
    out["storage"]["backend"] = backend
    uuid_raw = storage_in.get("connection_uuid")
    out["storage"]["connection_uuid"] = str(uuid_raw).strip() if uuid_raw else None
    prefix = str(storage_in.get("key_prefix") or "data-backups").strip().strip("/")
    out["storage"]["key_prefix"] = prefix or "data-backups"
    owner = storage_in.get("storage_owner_tenant_id")
    if owner is not None and str(owner).strip() != "":
        out["storage"]["storage_owner_tenant_id"] = int(owner)
    else:
        out["storage"]["storage_owner_tenant_id"] = None
    if backend == "local":
        out["storage"]["connection_uuid"] = None
        out["storage"]["storage_owner_tenant_id"] = None

    retention_in = raw.get("retention") if isinstance(raw.get("retention"), dict) else {}
    mode = str(retention_in.get("mode") or "none").strip().lower()
    if mode not in ("none", "days", "keep_count"):
        mode = "none"
    out["retention"]["mode"] = mode
    try:
        days = int(retention_in.get("days") if retention_in.get("days") is not None else 30)
    except (TypeError, ValueError):
        days = 30
    try:
        keep_count = int(
            retention_in.get("keep_count") if retention_in.get("keep_count") is not None else 7
        )
    except (TypeError, ValueError):
        keep_count = 7
    out["retention"]["days"] = max(1, days)
    out["retention"]["keep_count"] = max(1, keep_count)

    out["last_scheduled_at"] = raw.get("last_scheduled_at")
    out["last_retention_at"] = raw.get("last_retention_at")
    return out


async def _validate_storage_for_tenant(tenant_id: int, policy: Dict[str, Any]) -> None:
    storage = policy["storage"]
    if storage["backend"] != "connection":
        return
    conn_uuid = storage.get("connection_uuid")
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
        supported = "、".join(
            OBJECT_STORAGE_TYPE_LABELS.get(t, t) for t in SUPPORTED_OBJECT_STORAGE_TYPES
        )
        raise ValidationError(f"暂不支持该存储类型：{ic.type}（当前支持：{supported}）")
    policy["storage"]["storage_owner_tenant_id"] = int(tenant_id)


async def get_tenant_data_backup_policy(tenant_id: int) -> Dict[str, Any]:
    site = await SiteSettingService.get_settings(tenant_id)
    settings = site.settings or {}
    return normalize_data_backup_policy(settings.get(POLICY_KEY))


def _merge_policy_incoming(current: Dict[str, Any], incoming: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    incoming = incoming or {}
    merged_raw: Dict[str, Any] = {**current, **incoming}
    if isinstance(incoming.get("storage"), dict):
        merged_raw["storage"] = {
            **(current.get("storage") or {}),
            **incoming["storage"],
        }
    if isinstance(incoming.get("retention"), dict):
        merged_raw["retention"] = {
            **(current.get("retention") or {}),
            **incoming["retention"],
        }
    return normalize_data_backup_policy(merged_raw)


async def save_tenant_data_backup_policy(tenant_id: int, incoming: Dict[str, Any]) -> Dict[str, Any]:
    current = await get_tenant_data_backup_policy(tenant_id)
    merged = _merge_policy_incoming(current, incoming)
    # 保留服务端戳，除非调用方显式写入（tick 用内部 save）
    if "last_scheduled_at" not in (incoming or {}):
        merged["last_scheduled_at"] = current.get("last_scheduled_at")
    if "last_retention_at" not in (incoming or {}):
        merged["last_retention_at"] = current.get("last_retention_at")
    try:
        assert_cron_valid(merged["cron"])
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    if merged["schedule_enabled"] and not merged["cron"]:
        raise ValidationError("启用定时备份时必须配置 cron")
    await _validate_storage_for_tenant(tenant_id, merged)
    if merged["retention"]["mode"] == "days" and merged["retention"]["days"] < 1:
        raise ValidationError("保留天数须至少为 1")
    if merged["retention"]["mode"] == "keep_count" and merged["retention"]["keep_count"] < 1:
        raise ValidationError("保留份数须至少为 1")

    site = await SiteSettingService.get_settings(tenant_id)
    settings = dict(site.settings or {})
    settings[POLICY_KEY] = merged
    site.settings = settings
    await site.save(update_fields=["settings", "updated_at"])
    return merged


async def get_platform_data_backup_policy() -> Dict[str, Any]:
    ps = await _get_or_create_platform_settings()
    return normalize_data_backup_policy(getattr(ps, "data_backup_policy", None))


async def save_platform_data_backup_policy(
    incoming: Dict[str, Any],
    *,
    connection_owner_tenant_id: Optional[int],
) -> Dict[str, Any]:
    current = await get_platform_data_backup_policy()
    merged = _merge_policy_incoming(current, incoming)
    if "last_scheduled_at" not in (incoming or {}):
        merged["last_scheduled_at"] = current.get("last_scheduled_at")
    if "last_retention_at" not in (incoming or {}):
        merged["last_retention_at"] = current.get("last_retention_at")
    try:
        assert_cron_valid(merged["cron"])
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    if merged["schedule_enabled"] and not merged["cron"]:
        raise ValidationError("启用定时备份时必须配置 cron")

    storage = merged["storage"]
    if storage["backend"] == "connection":
        owner = storage.get("storage_owner_tenant_id") or connection_owner_tenant_id
        if owner is None:
            raise ValidationError("全平台对象存储须指定连接所属组织（当前登录组织）")
        await _validate_storage_for_tenant(int(owner), merged)
    else:
        storage["storage_owner_tenant_id"] = None
        storage["connection_uuid"] = None

    if merged["retention"]["mode"] == "days" and merged["retention"]["days"] < 1:
        raise ValidationError("保留天数须至少为 1")
    if merged["retention"]["mode"] == "keep_count" and merged["retention"]["keep_count"] < 1:
        raise ValidationError("保留份数须至少为 1")

    ps = await _get_or_create_platform_settings()
    ps.data_backup_policy = merged
    await ps.save(update_fields=["data_backup_policy", "updated_at"])
    return merged


async def list_storage_connections(tenant_id: int) -> List[Dict[str, Any]]:
    rows = await IntegrationConfig.filter(
        tenant_id=tenant_id,
        type__in=list(SUPPORTED_OBJECT_STORAGE_TYPES),
        is_active=True,
        deleted_at__isnull=True,
    ).order_by("name").all()
    return [
        {
            "uuid": str(r.uuid),
            "name": r.name,
            "code": r.code,
            "type": r.type,
            "type_label": OBJECT_STORAGE_TYPE_LABELS.get(r.type, r.type),
        }
        for r in rows
    ]


async def resolve_policy_for_backup(backup: DataBackup) -> Dict[str, Any]:
    if backup.backup_scope == "all":
        return await get_platform_data_backup_policy()
    if backup.tenant_id is None:
        return normalize_data_backup_policy(None)
    return await get_tenant_data_backup_policy(int(backup.tenant_id))


async def upload_backup_to_object_storage_if_needed(backup: DataBackup, local_path: str) -> None:
    """dump 成功后按策略上传对象存储；失败抛错（不把任务标成功）。"""
    policy = await resolve_policy_for_backup(backup)
    storage = policy.get("storage") or {}
    if storage.get("backend") != "connection":
        backup.storage_backend = "local"
        backup.storage_connection_uuid = None
        backup.storage_key = None
        backup.storage_owner_tenant_id = None
        await backup.save(
            update_fields=[
                "storage_backend",
                "storage_connection_uuid",
                "storage_key",
                "storage_owner_tenant_id",
                "updated_at",
            ]
        )
        return

    owner_tenant_id = storage.get("storage_owner_tenant_id") or backup.tenant_id
    conn_uuid = storage.get("connection_uuid")
    if not owner_tenant_id or not conn_uuid:
        raise ValidationError("备份策略配置了对象存储，但缺少连接或所属组织")

    adapter = await load_object_storage(int(owner_tenant_id), str(conn_uuid))
    filename = local_path.replace("\\", "/").rsplit("/", 1)[-1]
    key = apply_key_prefix(str(storage.get("key_prefix") or "data-backups"), filename)
    await adapter.put_file(key, local_path, content_type="application/zip")

    backup.storage_backend = adapter.backend_name
    backup.storage_connection_uuid = str(conn_uuid)
    backup.storage_key = key
    backup.storage_owner_tenant_id = int(owner_tenant_id)
    await backup.save(
        update_fields=[
            "storage_backend",
            "storage_connection_uuid",
            "storage_key",
            "storage_owner_tenant_id",
            "updated_at",
        ]
    )
    logger.info(
        "备份已上传对象存储 uuid={} backend={} key={}",
        backup.uuid,
        backup.storage_backend,
        key,
    )


async def delete_remote_backup_object(backup: DataBackup) -> None:
    backend = str(getattr(backup, "storage_backend", None) or "local").strip().lower()
    if backend in ("", "local"):
        return
    conn_uuid = getattr(backup, "storage_connection_uuid", None)
    key = getattr(backup, "storage_key", None)
    owner = getattr(backup, "storage_owner_tenant_id", None) or backup.tenant_id
    if not conn_uuid or not key or not owner:
        logger.warning(
            "备份标记为远程存储但缺少删除元数据 uuid={} backend={}",
            backup.uuid,
            backend,
        )
        return
    adapter = await load_object_storage(int(owner), str(conn_uuid))
    await adapter.delete(str(key))


async def ensure_local_backup_file(backup: DataBackup) -> str:
    """保证本机有 zip；缺失则从对象存储拉取。"""
    from core.services.system.backup_storage import (
        resolve_backup_file_path,
        resolve_data_backup_dir,
        store_backup_file_path,
    )
    import os

    resolved = resolve_backup_file_path(backup.file_path)
    if resolved and os.path.isfile(resolved):
        return resolved

    backend = str(getattr(backup, "storage_backend", None) or "local").strip().lower()
    if backend in ("", "local"):
        raise ValueError("备份文件已丢失，请在本服务器重新创建或上传备份后再操作")

    conn_uuid = getattr(backup, "storage_connection_uuid", None)
    key = getattr(backup, "storage_key", None)
    owner = getattr(backup, "storage_owner_tenant_id", None) or backup.tenant_id
    if not conn_uuid or not key or not owner:
        raise ValueError("备份远程存储信息不完整，无法下载")

    adapter = await load_object_storage(int(owner), str(conn_uuid))
    data = await adapter.get(str(key))
    backup_dir = resolve_data_backup_dir()
    os.makedirs(backup_dir, exist_ok=True)
    filename = str(key).replace("\\", "/").rsplit("/", 1)[-1] or f"{backup.uuid}.zip"
    local_path = os.path.join(backup_dir, filename)
    with open(local_path, "wb") as f:
        f.write(data)
    backup.file_path = store_backup_file_path(local_path)
    if not backup.file_size:
        backup.file_size = len(data)
    await backup.save(update_fields=["file_path", "file_size", "updated_at"])
    return local_path


def _retention_candidates_query(*, backup_scope: str, tenant_id: Optional[int]):
    q = DataBackup.filter(
        status="success",
        source_type="generated",
        backup_scope=backup_scope,
    ).exclude(restore_status="running")
    if backup_scope == "all":
        return q
    return q.filter(tenant_id=tenant_id)


async def apply_retention_for_policy(
    policy: Dict[str, Any],
    *,
    backup_scope: str,
    tenant_id: Optional[int],
) -> Dict[str, int]:
    from core.services.system.data_backup_service import DataBackupService

    mode = (policy.get("retention") or {}).get("mode") or "none"
    deleted = 0
    if mode == "none":
        return {"deleted": 0}

    now = resolve_business_datetime()
    q = _retention_candidates_query(backup_scope=backup_scope, tenant_id=tenant_id)

    if mode == "days":
        days = int((policy.get("retention") or {}).get("days") or 30)
        cutoff = now - timedelta(days=days)
        rows = await q.filter(completed_at__lt=cutoff).all()
        for row in rows:
            await DataBackupService.delete_backup(
                tenant_id if backup_scope != "all" else None,
                str(row.uuid),
                is_infra_admin=backup_scope == "all",
            )
            deleted += 1
        return {"deleted": deleted}

    if mode == "keep_count":
        keep = int((policy.get("retention") or {}).get("keep_count") or 7)
        rows = await q.order_by("-completed_at", "-id").all()
        for row in rows[keep:]:
            await DataBackupService.delete_backup(
                tenant_id if backup_scope != "all" else None,
                str(row.uuid),
                is_infra_admin=backup_scope == "all",
            )
            deleted += 1
        return {"deleted": deleted}

    return {"deleted": 0}


async def _has_active_backup(*, backup_scope: str, tenant_id: Optional[int]) -> bool:
    q = DataBackup.filter(status__in=["pending", "running"], backup_scope=backup_scope)
    if backup_scope == "all":
        return await q.exists()
    return await q.filter(tenant_id=tenant_id).exists()


async def _mark_policy_stamp(
    *,
    tenant_id: Optional[int],
    is_platform: bool,
    field: str,
    when: datetime,
) -> None:
    iso = when.isoformat()
    if is_platform:
        policy = await get_platform_data_backup_policy()
        policy[field] = iso
        ps = await _get_or_create_platform_settings()
        ps.data_backup_policy = policy
        await ps.save(update_fields=["data_backup_policy", "updated_at"])
        return
    assert tenant_id is not None
    policy = await get_tenant_data_backup_policy(int(tenant_id))
    policy[field] = iso
    site = await SiteSettingService.get_settings(int(tenant_id))
    settings = dict(site.settings or {})
    settings[POLICY_KEY] = policy
    site.settings = settings
    await site.save(update_fields=["settings", "updated_at"])


async def maybe_trigger_scheduled_backup(
    policy: Dict[str, Any],
    *,
    backup_scope: str,
    tenant_id: Optional[int],
    is_platform: bool,
    now: datetime,
) -> bool:
    from core.services.system.data_backup_service import DataBackupService

    if not policy.get("schedule_enabled"):
        return False
    cron = str(policy.get("cron") or "").strip()
    if not cron:
        return False
    site_now = _site_wall_clock(now)
    if not match_cron(cron, site_now):
        return False
    last = _parse_iso_dt(policy.get("last_scheduled_at"))
    if _same_site_minute(last, now):
        return False
    if await _has_active_backup(backup_scope=backup_scope, tenant_id=tenant_id):
        logger.info(
            "跳过定时备份（已有 pending/running）scope={} tenant_id={}",
            backup_scope,
            tenant_id,
        )
        await _mark_policy_stamp(
            tenant_id=tenant_id, is_platform=is_platform, field="last_scheduled_at", when=now
        )
        return False

    wall = _site_wall_clock(now)
    include_files = bool(policy.get("include_files", True))
    backup_type = await DataBackupService.resolve_auto_backup_type(
        tenant_id=tenant_id,
        backup_scope=backup_scope,
    )
    type_label = "全量" if backup_type == "full" else "增量"
    name = f"定时{type_label}备份_{wall.strftime('%Y%m%d_%H%M')}"
    data = DataBackupCreate(
        name=name,
        backup_type=backup_type,
        backup_scope=backup_scope,
        include_files=include_files,
        trigger_source="scheduled",
    )
    backup = await DataBackupService.create_backup_task(tenant_id, data)
    if getattr(backup, "status", None) == "failed":
        logger.error(
            "定时备份投递失败，不推进 last_scheduled_at: scope={} tenant_id={} err={}",
            backup_scope,
            tenant_id,
            getattr(backup, "error_message", None),
        )
        return False
    await _mark_policy_stamp(
        tenant_id=tenant_id, is_platform=is_platform, field="last_scheduled_at", when=now
    )
    return True


async def maybe_run_retention(
    policy: Dict[str, Any],
    *,
    backup_scope: str,
    tenant_id: Optional[int],
    is_platform: bool,
    now: datetime,
) -> int:
    mode = (policy.get("retention") or {}).get("mode") or "none"
    if mode == "none":
        return 0
    last = _parse_iso_dt(policy.get("last_retention_at"))
    # 每天站点墙钟最多跑一次清理
    if last is not None:
        la, nb = _site_wall_clock(last), _site_wall_clock(now)
        if (la.year, la.month, la.day) == (nb.year, nb.month, nb.day):
            return 0
    result = await apply_retention_for_policy(
        policy, backup_scope=backup_scope, tenant_id=tenant_id
    )
    await _mark_policy_stamp(
        tenant_id=tenant_id, is_platform=is_platform, field="last_retention_at", when=now
    )
    return int(result.get("deleted") or 0)


async def run_data_backup_policy_tick() -> Dict[str, Any]:
    """每分钟：租户/平台定时触发 + 按策略清理。"""
    from core.models.site_setting import SiteSetting

    now = resolve_business_datetime()
    scheduled = 0
    retention_deleted = 0

    # 平台策略
    try:
        plat = await get_platform_data_backup_policy()
        if await maybe_trigger_scheduled_backup(
            plat,
            backup_scope="all",
            tenant_id=None,
            is_platform=True,
            now=now,
        ):
            scheduled += 1
        retention_deleted += await maybe_run_retention(
            plat,
            backup_scope="all",
            tenant_id=None,
            is_platform=True,
            now=now,
        )
    except Exception:
        logger.exception("平台备份策略 tick 失败")

    # 租户策略：仅扫 settings 中已写入 data_backup_policy 的组织
    tenant_ids: List[int] = []
    try:
        rows = await SiteSetting.filter(deleted_at__isnull=True).all()
        seen = set()
        for row in rows:
            tid = getattr(row, "tenant_id", None)
            if tid is None or tid in seen:
                continue
            settings = row.settings or {}
            if POLICY_KEY not in settings:
                continue
            seen.add(tid)
            tenant_ids.append(int(tid))
    except Exception:
        logger.exception("扫描租户备份策略失败")
        tenant_ids = []

    for tid in tenant_ids:
        try:
            policy = await get_tenant_data_backup_policy(tid)
            if not policy.get("schedule_enabled") and (
                (policy.get("retention") or {}).get("mode") or "none"
            ) == "none":
                continue
            if await maybe_trigger_scheduled_backup(
                policy,
                backup_scope="tenant",
                tenant_id=tid,
                is_platform=False,
                now=now,
            ):
                scheduled += 1
            retention_deleted += await maybe_run_retention(
                policy,
                backup_scope="tenant",
                tenant_id=tid,
                is_platform=False,
                now=now,
            )
        except Exception:
            logger.exception("租户备份策略 tick 失败 tenant_id={}", tid)

    return {"scheduled": scheduled, "retention_deleted": retention_deleted, "tenants": len(tenant_ids)}


async def run_policy_backup_now(
    *,
    backup_scope: str,
    tenant_id: Optional[int],
    is_platform: bool,
) -> DataBackup:
    """按当前策略立即发起一次测试备份（不写 last_scheduled_at，不依赖 cron 窗口）。"""
    from core.services.system.data_backup_service import DataBackupService

    if is_platform:
        policy = await get_platform_data_backup_policy()
        backup_scope = "all"
        tenant_id = None
    else:
        if tenant_id is None:
            raise ValidationError("本组织测试备份缺少组织号")
        policy = await get_tenant_data_backup_policy(int(tenant_id))
        backup_scope = "tenant"

    if await _has_active_backup(backup_scope=backup_scope, tenant_id=tenant_id):
        raise ValidationError("已有进行中的备份任务，请稍后再试")

    now = resolve_business_datetime()
    wall = _site_wall_clock(now)
    include_files = bool(policy.get("include_files", True))
    backup_type = await DataBackupService.resolve_auto_backup_type(
        tenant_id=tenant_id,
        backup_scope=backup_scope,
    )
    type_label = "全量" if backup_type == "full" else "增量"
    name = f"测试{type_label}备份_{wall.strftime('%Y%m%d_%H%M')}"
    data = DataBackupCreate(
        name=name,
        backup_type=backup_type,
        backup_scope=backup_scope,
        include_files=include_files,
        trigger_source="manual",
    )
    backup = await DataBackupService.create_backup_task(tenant_id, data)
    if getattr(backup, "status", None) == "failed":
        raise ValidationError(
            getattr(backup, "error_message", None) or "测试备份投递失败，请确认 Taskiq worker 已运行"
        )
    return backup
