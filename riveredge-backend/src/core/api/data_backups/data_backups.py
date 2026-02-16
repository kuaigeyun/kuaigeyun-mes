"""
数据备份 API 模块
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from core.api.deps import get_current_user
from infra.models.user import User
from core.schemas.data_backup import DataBackupCreate, DataBackupResponse, DataBackupListResponse
from core.services.system.data_backup_service import DataBackupService

router = APIRouter(prefix="/data-backups", tags=["Data Backups"])


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


@router.post("", response_model=DataBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    data: DataBackupCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建备份任务
    """
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


from pydantic import BaseModel

class RestoreRequest(BaseModel):
    confirm: bool

@router.post("/{uuid}/restore")
async def restore_backup(
    uuid: str,
    data: RestoreRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    恢复备份
    """
    if not data.confirm:
        raise HTTPException(status_code=400, detail="确认恢复标记必须为 true")
        
    try:
        success = await DataBackupService.restore_backup(current_user.tenant_id, uuid)
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
