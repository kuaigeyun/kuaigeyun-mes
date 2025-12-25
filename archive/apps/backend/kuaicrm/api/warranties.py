"""
保修管理 API 模块

提供保修的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.warranty_service import WarrantyService
from apps.kuaicrm.schemas.warranty_schemas import (
    WarrantyCreate, WarrantyUpdate, WarrantyResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/warranties", tags=["Warranties"])


@router.post("", response_model=WarrantyResponse, summary="创建保修")
async def create_warranty(
    data: WarrantyCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建保修
    
    - **warranty_no**: 保修编号（必填，组织内唯一）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **product_info**: 产品信息（必填）
    - **warranty_type**: 保修类型（必填）
    - **warranty_period**: 保修期限（月，必填）
    """
    try:
        return await WarrantyService.create_warranty(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[WarrantyResponse], summary="获取保修列表")
async def list_warranties(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    warranty_status: Optional[str] = Query(None, description="保修状态（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取保修列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **warranty_status**: 保修状态（可选，用于过滤）
    - **customer_id**: 客户ID（可选）
    """
    return await WarrantyService.list_warranties(tenant_id, skip, limit, warranty_status, customer_id)


@router.get("/{warranty_uuid}", response_model=WarrantyResponse, summary="获取保修详情")
async def get_warranty(
    warranty_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取保修详情
    
    - **warranty_uuid**: 保修UUID
    """
    try:
        return await WarrantyService.get_warranty_by_uuid(tenant_id, warranty_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{warranty_uuid}", response_model=WarrantyResponse, summary="更新保修")
async def update_warranty(
    warranty_uuid: str,
    data: WarrantyUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新保修
    
    - **warranty_uuid**: 保修UUID
    - **data**: 保修更新数据
    """
    try:
        return await WarrantyService.update_warranty(tenant_id, warranty_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{warranty_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除保修")
async def delete_warranty(
    warranty_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除保修（软删除）
    
    - **warranty_uuid**: 保修UUID
    """
    try:
        await WarrantyService.delete_warranty(tenant_id, warranty_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
