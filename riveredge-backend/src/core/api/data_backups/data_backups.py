"""
数据备份 API 模块
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel
from core.api.deps import get_current_user
from infra.models.user import User
from core.models.data_backup import DataBackup
from core.schemas.data_backup import DataBackupCreate, DataBackupResponse, DataBackupListResponse
from core.services.system.data_backup_service import DataBackupService
from core.services.system.backup_download_service import BackupDownloadService

router = APIRouter(prefix="/data-backups", tags=["Core · Data Backups"])


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


async def _load_worker_health_counts(
    tenant_id: int,
    stale_threshold: datetime,
    recent_window: datetime,
) -> tuple[int, int, int, int]:
    # PostgreSQL 连接偶发中断时，允许一次短重试，避免前端偶发 500。
    for attempt in range(2):
        try:
            pending_total = await DataBackup.filter(tenant_id=tenant_id, status="pending").count()
            pending_stalled = await DataBackup.filter(
                tenant_id=tenant_id,
                status="pending",
                created_at__lt=stale_threshold,
            ).count()
            running_count = await DataBackup.filter(tenant_id=tenant_id, status="running").count()
            recent_completed = await DataBackup.filter(
                tenant_id=tenant_id,
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
    - online: 最近有执行活动（running 或最近完成）
    - backlog: 存在超时 pending（任务堆积，未必代表 worker 进程离线）
    - idle: 当前无执行活动且无堆积（空闲）
    """
    now = datetime.now()
    stale_threshold = now - timedelta(minutes=2)
    recent_window = now - timedelta(minutes=10)

    tenant_id = current_user.tenant_id
    pending_total, pending_stalled, running_count, recent_completed = await _load_worker_health_counts(
        tenant_id=tenant_id,
        stale_threshold=stale_threshold,
        recent_window=recent_window,
    )

    try:
        from core.tasks.taskiq_app import broker as taskiq_broker

        broker_ready = bool(getattr(taskiq_broker, "_write_pool", None))
    except Exception:
        broker_ready = False

    if running_count > 0 or recent_completed > 0:
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


@router.get("", response_model=DataBackupListResponse)
async def get_backups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    backup_type: Optional[str] = None,
    backup_scope: Optional[str] = None,
    backup_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取备份列表
    """
    # 权限校验：非平台管理员不能查询全量备份库，除非显式指定了自己的租户ID
    # 在 Service 层已经通过 tenant_id 隔离了
    
    # 特殊逻辑：如果是平台管理员且没有指定租户，可能想看系统级的（tenant_id is None）
    search_tenant_id = current_user.tenant_id
    
    if backup_scope == "all" and not current_user.is_infra_admin_user():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="普通租户无权访问全量备份数据"
        )
    """
    获取备份列表
    """
    items, total = await DataBackupService.get_backups(
        current_user.tenant_id,
        page,
        page_size,
        backup_type,
        backup_scope,
        backup_status
    )
    return {
        "items": items,
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
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="仅支持上传 .zip 格式的备份文件")
    backup_name = (name or file.filename or "uploaded_backup").strip() or "uploaded_backup"
    return await DataBackupService.upload_backup_file(current_user.tenant_id, file, backup_name)


@router.post("", response_model=DataBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    data: DataBackupCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建备份任务
    """
    # 核心安全校验：非系统管理员严禁尝试全量备份（backup_scope='all'）
    if data.backup_scope == "all" and not current_user.is_infra_admin_user():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足：仅平台管理员可创建全量备份（包含所有租户数据）。"
        )
        
    return await DataBackupService.create_backup_task(current_user.tenant_id, data)


@router.get("/{uuid}", response_model=DataBackupResponse)
async def get_backup(
    uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取备份详情
    """
    try:
        return await DataBackupService.get_backup_by_uuid(current_user.tenant_id, uuid)
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
        backup = await DataBackupService.get_backup_by_uuid(current_user.tenant_id, uuid)
        if backup.status != "success":
            raise HTTPException(status_code=400, detail="只能下载成功的备份")
        BackupDownloadService.resolve_backup_file(uuid, current_user.tenant_id, backup.file_path)
        return BackupDownloadUrlResponse(
            download_url=BackupDownloadService.build_download_url(uuid, current_user.tenant_id),
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

    tenant_id = payload.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="下载链接缺少组织信息")

    try:
        backup = await DataBackupService.get_backup_by_uuid(int(tenant_id), uuid)
        if backup.status != "success":
            raise HTTPException(status_code=400, detail="只能下载成功的备份")
        abs_path, filename = BackupDownloadService.resolve_backup_file(uuid, int(tenant_id), backup.file_path)
        return FileResponse(
            path=abs_path,
            filename=filename,
            media_type="application/zip",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{uuid}")
async def delete_backup(
    uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除备份
    """
    try:
        await DataBackupService.delete_backup(current_user.tenant_id, uuid)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class RestoreRequest(BaseModel):
    confirm: bool
    create_pre_restore_backup: bool = True  # 恢复前自动创建备份，便于误覆盖时撤回
    source_tenant_id: Optional[int] = None  # 备份中的租户ID（用于替换）；不填则从备份元数据或记录推断


@router.post("/{uuid}/restore")
async def restore_backup(
    uuid: str,
    data: RestoreRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    恢复备份
    
    若 create_pre_restore_backup=True（默认），恢复前会自动创建当前状态的备份，便于误覆盖时撤回。
    """
    if not data.confirm:
        raise HTTPException(status_code=400, detail="确认恢复标记必须为 true")

    try:
        success = await DataBackupService.restore_backup(
            current_user.tenant_id,
            uuid,
            create_pre_restore_backup=data.create_pre_restore_backup,
            source_tenant_id=data.source_tenant_id,
        )
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
