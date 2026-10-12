"""
数据备份 API 模块
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, List, Optional
from fastapi import (
    APIRouter,
    Depends,
    Query,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Header,
)
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel
from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from core.models.data_backup import DataBackup
from core.schemas.data_backup import (
    DataBackupCreate,
    DataBackupResponse,
    DataBackupListResponse,
    DataBackupPolicy,
    DataBackupPolicyUpdate,
    DataBackupStorageConnectionList,
)
from core.services.system.data_backup_service import DataBackupService
from core.services.system.data_backup_policy import (
    get_tenant_data_backup_policy,
    save_tenant_data_backup_policy,
    get_platform_data_backup_policy,
    save_platform_data_backup_policy,
    list_storage_connections,
)
from core.services.system.backup_download_service import BackupDownloadService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import ValidationError
from tortoise.exceptions import DoesNotExist
from tortoise.expressions import Q

router = APIRouter(prefix="/data-backups", tags=["Core - Data Backups"])

def _is_platform_backup_admin(user: User) -> bool:
    """平台管理员权限：看 is_infra_admin 标志，不要求当前未绑定租户。

    平台账号切换进某个组织后 tenant_id 非空，is_infra_admin_user() 会变 False，
    但仍应能指定组织做租户备份 / 全平台备份。
    """
    return bool(getattr(user, "is_infra_admin", False)) or user.is_infra_admin_user()


def _require_backup_administrator(user: User) -> None:
    if not (_is_platform_backup_admin(user) or user.is_organization_admin()):
        raise HTTPException(status_code=403, detail="仅组织管理员或平台管理员可上传或恢复备份")



class BackupWorkerHealthResponse(BaseModel):
    status: str
    broker_ready: bool
    pending_total: int
    pending_stalled: int
    running_count: int
    recent_completed: int
    checked_at: datetime


class BackupDownloadUrlResponse(BaseModel):
    download_url: str


def _backup_list_q(tenant_id: Optional[int], *, is_infra_admin: bool):
    # 与列表可见性一致：平台管理员全量；组织侧仅本组织且排除全平台包
    if is_infra_admin:
        return Q()
    return Q(tenant_id=tenant_id) & ~Q(backup_scope="all")


async def _load_worker_health_counts(
    tenant_id: Optional[int],
    stale_threshold: datetime,
    recent_window: datetime,
    *,
    is_infra_admin: bool,
) -> tuple[int, int, int, int]:
    # PostgreSQL 连接偶发中断时，允许一次短重试，避免前端偶发 500。
    scope_q = _backup_list_q(tenant_id, is_infra_admin=is_infra_admin)
    for attempt in range(2):
        try:
            pending_total = await DataBackup.filter(scope_q, status="pending").count()
            pending_stalled = await DataBackup.filter(
                scope_q,
                status="pending",
                created_at__lt=stale_threshold,
            ).count()
            running_count = await DataBackup.filter(scope_q, status="running").count()
            recent_completed = await DataBackup.filter(
                scope_q,
                status__in=["success", "failed"],
                completed_at__gte=recent_window,
            ).count()
            return pending_total, pending_stalled, running_count, recent_completed
        except Exception as exc:
            exc_name = exc.__class__.__name__
            message = str(exc)
            is_connection_error = (
                exc_name in {"ConnectionDoesNotExistError", "InterfaceError", "OperationalError"}
                or "connection was closed in the middle of operation" in message.lower()
            )
            if not is_connection_error or attempt == 1:
                raise
            logger.warning(
                "worker-health 查询出现瞬时连接异常，准备重试: type={}, message={}",
                exc_name,
                message,
            )
            await asyncio.sleep(0.15)


@router.get("/worker-health", response_model=BackupWorkerHealthResponse)
async def get_worker_health(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取备份 Worker 健康状态（用于前端状态指示）。

    状态说明：
    - online: 当前有 running 备份（正在执行）
    - backlog: 存在超时 pending（任务堆积，未必代表 worker 进程离线）
    - idle: 当前无 running 且无堆积（空闲；刚完成的任务不继续显示为运行中）
    """
    now = resolve_business_datetime()
    stale_threshold = now - timedelta(minutes=2)
    recent_window = now - timedelta(minutes=10)

    tenant_id = current_user.tenant_id
    pending_total, pending_stalled, running_count, recent_completed = await _load_worker_health_counts(
        tenant_id=tenant_id,
        stale_threshold=stale_threshold,
        recent_window=recent_window,
        is_infra_admin=_is_platform_backup_admin(current_user),
    )

    try:
        from core.tasks.taskiq_app import broker as taskiq_broker

        broker_ready = bool(getattr(taskiq_broker, "_write_pool", None))
    except Exception:
        broker_ready = False

    if running_count > 0:
        worker_status = "online"
    elif pending_stalled > 0:
        worker_status = "backlog"
    else:
        worker_status = "idle"

    return BackupWorkerHealthResponse(
        status=worker_status,
        broker_ready=broker_ready,
        pending_total=pending_total,
        pending_stalled=pending_stalled,
        running_count=running_count,
        recent_completed=recent_completed,
        checked_at=now,
    )


class BackupReclaimResponse(BaseModel):
    failed_running: int
    redispatched: int
    already_queued: int


@router.post("/reclaim-stalled", response_model=BackupReclaimResponse)
async def reclaim_stalled_backups(
    current_user: User = Depends(get_current_user),
) -> Any:
    """重投超时 pending、取消无进度的 running。"""
    _require_backup_administrator(current_user)
    result = await DataBackupService.reclaim_stalled_backups(
        tenant_id=None if _is_platform_backup_admin(current_user) else current_user.tenant_id
    )
    try:
        from core.tasks.taskiq_app import _notify_pending_backup_messages

        await _notify_pending_backup_messages()
    except Exception:
        logger.warning("补发 Taskiq NOTIFY 失败", exc_info=True)
    return BackupReclaimResponse(**result)


def _resolve_connection_owner_tenant_id(
    current_user: User,
    x_tenant_id: Optional[str],
) -> Optional[int]:
    """平台账号 User.tenant_id 常为空，对象存储连接所属组织取自 X-Tenant-ID。"""
    if current_user.tenant_id is not None:
        try:
            tid = int(current_user.tenant_id)
            if tid > 0:
                return tid
        except (TypeError, ValueError):
            pass
    if x_tenant_id is not None and str(x_tenant_id).strip() != "":
        try:
            tid = int(x_tenant_id)
            if tid > 0:
                return tid
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="无效的组织ID")
    return None


@router.get("/policy", response_model=DataBackupPolicy)
async def get_backup_policy(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Any:
    """当前组织备份策略（定时 / 存储 / 保留）。认 X-Tenant-ID（平台进组织）。"""
    _ = current_user
    return await get_tenant_data_backup_policy(int(tenant_id))


@router.put("/policy", response_model=DataBackupPolicy)
async def put_backup_policy(
    data: DataBackupPolicyUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Any:
    """保存当前组织备份策略。"""
    _require_backup_administrator(current_user)
    try:
        payload = data.model_dump(exclude_unset=True)
        return await save_tenant_data_backup_policy(int(tenant_id), payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/policy/platform", response_model=DataBackupPolicy)
async def get_platform_backup_policy(
    current_user: User = Depends(get_current_user),
) -> Any:
    """全平台备份策略（仅平台管理员）。"""
    if not _is_platform_backup_admin(current_user):
        raise HTTPException(status_code=403, detail="仅平台管理员可查看全平台备份策略")
    return await get_platform_data_backup_policy()


@router.put("/policy/platform", response_model=DataBackupPolicy)
async def put_platform_backup_policy(
    data: DataBackupPolicyUpdate,
    current_user: User = Depends(get_current_user),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
) -> Any:
    """保存全平台备份策略（仅平台管理员）。"""
    if not _is_platform_backup_admin(current_user):
        raise HTTPException(status_code=403, detail="仅平台管理员可配置全平台备份策略")
    try:
        payload = data.model_dump(exclude_unset=True)
        return await save_platform_data_backup_policy(
            payload,
            connection_owner_tenant_id=_resolve_connection_owner_tenant_id(
                current_user, x_tenant_id
            ),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/storage-connections", response_model=DataBackupStorageConnectionList)
async def get_backup_storage_connections(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Any:
    """列出当前组织已启用的 COS/MinIO/RustFS 应用连接。"""
    _ = current_user
    items = await list_storage_connections(int(tenant_id))
    return {"items": items}


@router.get("", response_model=DataBackupListResponse)
async def get_backups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    backup_type: Optional[str] = None,
    backup_scope: Optional[str] = None,
    backup_status: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None, description="模糊搜索备份名称"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取备份列表
    """
    if backup_scope == "all" and not _is_platform_backup_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="普通租户无权访问全量备份数据",
        )
    items, total = await DataBackupService.get_backups(
        current_user.tenant_id,
        page,
        page_size,
        backup_type,
        backup_scope,
        backup_status,
        keyword=keyword,
        is_infra_admin=_is_platform_backup_admin(current_user),
    )
    return {
        "items": [DataBackupService.to_response(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/upload", response_model=DataBackupResponse, status_code=status.HTTP_201_CREATED)
async def upload_backup(
    file: UploadFile = File(...),
    name: str = Form(None),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    上传备份文件
    
    支持上传 .zip 格式的备份文件，上传后可直接用于恢复。
    """
    _require_backup_administrator(current_user)
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="仅支持上传 .zip 格式的备份文件")
    backup_name = (name or file.filename or "uploaded_backup").strip() or "uploaded_backup"
    try:
        backup = await DataBackupService.upload_backup_file(
            current_user.tenant_id, file, backup_name,
            allow_global_backup=_is_platform_backup_admin(current_user),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return DataBackupService.to_response(backup)


@router.post("", response_model=DataBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    data: DataBackupCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建备份任务
    """
    is_infra = _is_platform_backup_admin(current_user)
    # 核心安全校验：非系统管理员严禁尝试全量备份（backup_scope='all'）
    if data.backup_scope == "all" and not is_infra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足：仅平台管理员可创建全量备份（包含所有租户数据）。"
        )

    effective_tenant_id = current_user.tenant_id
    if data.backup_scope == "tenant":
        if is_infra:
            chosen = data.target_tenant_id
            if chosen is None and effective_tenant_id is not None:
                chosen = effective_tenant_id
            if chosen is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="租户级备份请选择目标组织，或改用全量备份（backup_scope=all）。",
                )
            from infra.models.tenant import Tenant

            target = await Tenant.filter(id=int(chosen)).first()
            if target is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"目标组织不存在：{chosen}",
                )
            effective_tenant_id = int(target.id)
        elif effective_tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="租户级备份需要当前登录用户绑定组织。",
            )
        elif data.target_tenant_id is not None and int(data.target_tenant_id) != int(effective_tenant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权为其他组织创建备份",
            )
    elif data.target_tenant_id is not None and not is_infra:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权指定目标组织",
        )

    backup = await DataBackupService.create_backup_task(effective_tenant_id, data)
    return DataBackupService.to_response(backup)


@router.get("/{uuid}", response_model=DataBackupResponse)
async def get_backup(
    uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取备份详情
    """
    try:
        backup = await DataBackupService.get_backup_by_uuid(
            current_user.tenant_id, uuid, is_infra_admin=_is_platform_backup_admin(current_user)
        )
        # 详情可读 zip 内轻量 metadata；禁止解压 dump
        return DataBackupService.to_response(backup, enrich=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{uuid}/download-url", response_model=BackupDownloadUrlResponse)
async def get_backup_download_url(
    uuid: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取备份下载链接（短效 download_token，供浏览器原生流式下载）
    """
    try:
        backup = await DataBackupService.get_backup_by_uuid(
            current_user.tenant_id, uuid, is_infra_admin=_is_platform_backup_admin(current_user)
        )
        if backup.status != "success":
            raise HTTPException(status_code=400, detail="只能下载成功的备份")
        from core.services.system.data_backup_policy import ensure_local_backup_file

        await ensure_local_backup_file(backup)
        await backup.refresh_from_db()
        BackupDownloadService.resolve_backup_file(uuid, current_user.tenant_id, backup.file_path)
        return BackupDownloadUrlResponse(
            download_url=BackupDownloadService.build_download_url(
                uuid,
                current_user.tenant_id,
                is_infra_admin=_is_platform_backup_admin(current_user),
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{uuid}/download")
async def download_backup(
    uuid: str,
    download_token: str = Query(..., description="短效下载 token，由 download-url 接口签发"),
) -> Any:
    """
    下载备份文件（FileResponse 流式传输，仅接受 download_token）
    """
    try:
        payload = BackupDownloadService.verify_download_token(download_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    token_uuid = str(payload.get("backup_uuid") or "").lower()
    if token_uuid != str(uuid).lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="下载链接与备份不匹配")

    try:
        backup = await DataBackup.get(uuid=uuid)
        if not DataBackupService.backup_visible_to_user(
            backup,
            int(payload["tenant_id"]) if payload.get("tenant_id") is not None else None,
            is_infra_admin=bool(payload.get("is_infra_admin")),
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="下载链接无效")
        if backup.status != "success":
            raise HTTPException(status_code=400, detail="只能下载成功的备份")
        from core.services.system.data_backup_policy import ensure_local_backup_file

        await ensure_local_backup_file(backup)
        await backup.refresh_from_db()
        abs_path, filename = BackupDownloadService.resolve_backup_file(
            uuid, backup.tenant_id, backup.file_path
        )
        return FileResponse(
            path=abs_path,
            filename=filename,
            media_type="application/zip",
        )
    except HTTPException:
        raise
    except (ValueError, DoesNotExist) as exc:
        raise HTTPException(status_code=404, detail=str(exc) if str(exc) else "备份不存在") from exc


@router.delete("/{uuid}")
async def delete_backup(
    uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除备份
    """
    try:
        await DataBackupService.delete_backup(
            current_user.tenant_id, uuid, is_infra_admin=_is_platform_backup_admin(current_user)
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class RestoreRequest(BaseModel):
    confirm: bool
    create_pre_restore_backup: bool = True  # 恢复前自动创建备份，便于误覆盖时撤回
    source_tenant_id: Optional[int] = None  # 备份中的租户ID（用于替换）；不填则从备份元数据或记录推断
    target_tenant_id: Optional[int] = None  # 恢复写入的目标组织；平台账号未绑定组织时必填


class RestoreBackupResponse(BaseModel):
    success: bool
    restore_status: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


@router.post("/{uuid}/restore", response_model=RestoreBackupResponse)
async def restore_backup(
    uuid: str,
    data: RestoreRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    恢复备份
    
    若 create_pre_restore_backup=True（默认），恢复前会自动创建当前状态的备份，便于误覆盖时撤回。
    """
    _require_backup_administrator(current_user)
    if not data.confirm:
        raise HTTPException(status_code=400, detail="确认恢复标记必须为 true")

    is_infra = _is_platform_backup_admin(current_user)
    effective_target: Optional[int] = None
    if data.target_tenant_id is not None:
        effective_target = int(data.target_tenant_id)
    elif current_user.tenant_id is not None:
        effective_target = int(current_user.tenant_id)

    if effective_target is not None:
        from infra.models.tenant import Tenant

        target = await Tenant.filter(id=int(effective_target)).first()
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"目标组织不存在：{effective_target}",
            )
        if (
            not is_infra
            and current_user.tenant_id is not None
            and int(effective_target) != int(current_user.tenant_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权恢复到其他组织",
            )

    try:
        success = await DataBackupService.restore_backup(
            current_user.tenant_id,
            uuid,
            create_pre_restore_backup=data.create_pre_restore_backup,
            source_tenant_id=data.source_tenant_id,
            target_tenant_id=effective_target,
            allow_global_restore=is_infra,
        )
        if success:
            return RestoreBackupResponse(
                success=True,
                restore_status="running",
                message="恢复任务已提交，请稍后在列表中查看恢复状态",
            )
        backup = await DataBackupService.get_backup_by_uuid(
            current_user.tenant_id, uuid, is_infra_admin=_is_platform_backup_admin(current_user)
        )
        return RestoreBackupResponse(
            success=False,
            restore_status=backup.restore_status,
            error=backup.restore_error_message or "恢复任务提交失败",
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
