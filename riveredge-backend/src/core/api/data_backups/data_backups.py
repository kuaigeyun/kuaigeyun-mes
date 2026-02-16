"""
数据备份 API 模块
"""

import os
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
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


@router.get("/{uuid}/download")
async def download_backup(
    uuid: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    下载备份文件（仅成功的备份可下载）
    """
    try:
        backup = await DataBackupService.get_backup_by_uuid(current_user.tenant_id, uuid)
        if backup.status != "success":
            raise HTTPException(status_code=400, detail="只能下载成功的备份")
        if not backup.file_path:
            raise HTTPException(status_code=404, detail="备份文件不存在")
        if not os.path.exists(backup.file_path):
            raise HTTPException(status_code=404, detail="备份文件已丢失")
        # 防止路径遍历：确保文件在 backups 目录下
        abs_path = os.path.abspath(backup.file_path)
        backups_dir = os.path.abspath("backups")
        if not abs_path.startswith(backups_dir):
            raise HTTPException(status_code=403, detail="无效的备份路径")
        filename = os.path.basename(backup.file_path)
        return FileResponse(
            path=abs_path,
            filename=filename,
            media_type="application/zip",
        )
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
