"""
数据备份管理 API 路由

提供数据备份的查询、创建、恢复和删除功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from tree_root.schemas.data_backup import (
    DataBackupCreate,
    DataBackupUpdate,
    DataBackupResponse,
    DataBackupListResponse,
    DataBackupRestoreRequest,
    DataBackupRestoreResponse,
)
from tree_root.services.data_backup_service import DataBackupService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-backups", tags=["DataBackups"])


@router.post("", response_model=DataBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    data: DataBackupCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建备份任务
    
    Args:
        data: 备份创建数据
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        DataBackupResponse: 创建的备份对象
    """
    return await DataBackupService.create_backup(tenant_id=tenant_id, data=data)


@router.get("", response_model=DataBackupListResponse)
async def get_backups(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    backup_type: Optional[str] = Query(None, description="备份类型过滤（full、incremental）"),
    backup_scope: Optional[str] = Query(None, description="备份范围过滤（all、tenant、table）"),
    status: Optional[str] = Query(None, description="备份状态过滤（pending、running、success、failed）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取备份列表
    
    Args:
        page: 页码
        page_size: 每页数量
        backup_type: 备份类型过滤（可选）
        backup_scope: 备份范围过滤（可选）
        status: 备份状态过滤（可选）
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        DataBackupListResponse: 备份列表
    """
    return await DataBackupService.get_backups(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        backup_type=backup_type,
        backup_scope=backup_scope,
        status=status,
    )


@router.get("/{uuid}", response_model=DataBackupResponse)
async def get_backup(
    uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取备份详情
    
    Args:
        uuid: 备份UUID
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        DataBackupResponse: 备份对象
        
    Raises:
        HTTPException: 当备份不存在时抛出
    """
    try:
        backup = await DataBackupService.get_backup_by_uuid(tenant_id=tenant_id, backup_uuid=uuid)
        return DataBackupResponse.model_validate(backup)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/restore", response_model=DataBackupRestoreResponse)
async def restore_backup(
    uuid: str,
    data: DataBackupRestoreRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    恢复备份
    
    Args:
        uuid: 备份UUID
        data: 恢复请求数据（包含确认标志）
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        DataBackupRestoreResponse: 恢复结果
        
    Raises:
        HTTPException: 当确认标志为 false 或恢复失败时抛出
    """
    if not data.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="必须确认恢复操作"
        )
    
    try:
        return await DataBackupService.restore_backup(tenant_id=tenant_id, backup_uuid=uuid)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(
    uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除备份
    
    Args:
        uuid: 备份UUID
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Raises:
        HTTPException: 当备份不存在时抛出
    """
    try:
        await DataBackupService.delete_backup(tenant_id=tenant_id, backup_uuid=uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

