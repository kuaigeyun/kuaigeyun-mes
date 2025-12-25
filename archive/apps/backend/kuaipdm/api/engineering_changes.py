"""
工程变更 API 模块

提供工程变更的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipdm.services.engineering_change_service import EngineeringChangeService
from apps.kuaipdm.schemas.engineering_change_schemas import (
    EngineeringChangeCreate, EngineeringChangeUpdate, EngineeringChangeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/engineering-changes", tags=["Engineering Changes"])


@router.post("", response_model=EngineeringChangeResponse, status_code=status.HTTP_201_CREATED, summary="创建工程变更")
async def create_engineering_change(
    data: EngineeringChangeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工程变更
    
    - **change_no**: 变更编号（必填，组织内唯一）
    - **change_type**: 变更类型（必填）
    - **change_reason**: 变更原因（必填）
    - **change_content**: 变更内容描述（必填）
    """
    try:
        return await EngineeringChangeService.create_engineering_change(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EngineeringChangeResponse], summary="获取工程变更列表")
async def list_engineering_changes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="变更状态（过滤）"),
    change_type: Optional[str] = Query(None, description="变更类型（过滤）")
):
    """
    获取工程变更列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 变更状态（可选，用于过滤）
    - **change_type**: 变更类型（可选）
    """
    return await EngineeringChangeService.list_engineering_changes(tenant_id, skip, limit, status, change_type)


@router.get("/{change_uuid}", response_model=EngineeringChangeResponse, summary="获取工程变更详情")
async def get_engineering_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取工程变更详情
    
    - **change_uuid**: 变更UUID
    """
    try:
        return await EngineeringChangeService.get_engineering_change_by_uuid(tenant_id, change_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{change_uuid}", response_model=EngineeringChangeResponse, summary="更新工程变更")
async def update_engineering_change(
    change_uuid: str,
    data: EngineeringChangeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新工程变更
    
    - **change_uuid**: 变更UUID
    - **data**: 变更更新数据
    """
    try:
        return await EngineeringChangeService.update_engineering_change(tenant_id, change_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{change_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除工程变更")
async def delete_engineering_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工程变更（软删除）
    
    - **change_uuid**: 变更UUID
    """
    try:
        await EngineeringChangeService.delete_engineering_change(tenant_id, change_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
