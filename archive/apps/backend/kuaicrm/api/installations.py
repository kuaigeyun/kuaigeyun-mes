"""
安装记录 API 模块

提供安装记录的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.installation_service import InstallationService
from apps.kuaicrm.schemas.installation_schemas import (
    InstallationCreate, InstallationUpdate, InstallationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/installations", tags=["Installations"])


@router.post("", response_model=InstallationResponse, summary="创建安装记录")
async def create_installation(
    data: InstallationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建安装记录
    
    - **installation_no**: 安装编号（必填，组织内唯一）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **installation_date**: 安装日期（必填）
    - **installation_address**: 安装地址（必填）
    """
    try:
        return await InstallationService.create_installation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[InstallationResponse], summary="获取安装记录列表")
async def list_installations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    installation_status: Optional[str] = Query(None, description="安装状态（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取安装记录列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **installation_status**: 安装状态（可选，用于过滤）
    - **customer_id**: 客户ID（可选）
    """
    return await InstallationService.list_installations(tenant_id, skip, limit, installation_status, customer_id)


@router.get("/{installation_uuid}", response_model=InstallationResponse, summary="获取安装记录详情")
async def get_installation(
    installation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取安装记录详情
    
    - **installation_uuid**: 安装记录UUID
    """
    try:
        return await InstallationService.get_installation_by_uuid(tenant_id, installation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{installation_uuid}", response_model=InstallationResponse, summary="更新安装记录")
async def update_installation(
    installation_uuid: str,
    data: InstallationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新安装记录
    
    - **installation_uuid**: 安装记录UUID
    - **data**: 安装记录更新数据
    """
    try:
        return await InstallationService.update_installation(tenant_id, installation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{installation_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除安装记录")
async def delete_installation(
    installation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除安装记录（软删除）
    
    - **installation_uuid**: 安装记录UUID
    """
    try:
        await InstallationService.delete_installation(tenant_id, installation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
