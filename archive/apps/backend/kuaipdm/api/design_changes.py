"""
设计变更 API 模块

提供设计变更的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipdm.services.design_change_service import DesignChangeService
from apps.kuaipdm.schemas.design_change_schemas import (
    DesignChangeCreate, DesignChangeUpdate, DesignChangeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/design-changes", tags=["Design Changes"])


@router.post("", response_model=DesignChangeResponse, status_code=status.HTTP_201_CREATED, summary="创建设计变更")
async def create_design_change(
    data: DesignChangeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建设计变更
    
    - **change_no**: 变更编号（必填，组织内唯一）
    - **change_type**: 变更类型（必填）
    - **change_reason**: 变更原因（必填）
    - **change_content**: 变更内容描述（必填）
    """
    try:
        return await DesignChangeService.create_design_change(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DesignChangeResponse], summary="获取设计变更列表")
async def list_design_changes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="变更状态（过滤）"),
    change_type: Optional[str] = Query(None, description="变更类型（过滤）")
):
    """
    获取设计变更列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 变更状态（可选，用于过滤）
    - **change_type**: 变更类型（可选）
    """
    return await DesignChangeService.list_design_changes(tenant_id, skip, limit, status, change_type)


@router.get("/{change_uuid}", response_model=DesignChangeResponse, summary="获取设计变更详情")
async def get_design_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取设计变更详情
    
    - **change_uuid**: 变更UUID
    """
    try:
        return await DesignChangeService.get_design_change_by_uuid(tenant_id, change_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{change_uuid}", response_model=DesignChangeResponse, summary="更新设计变更")
async def update_design_change(
    change_uuid: str,
    data: DesignChangeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新设计变更
    
    - **change_uuid**: 变更UUID
    - **data**: 变更更新数据
    """
    try:
        return await DesignChangeService.update_design_change(tenant_id, change_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{change_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设计变更")
async def delete_design_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除设计变更（软删除）
    
    - **change_uuid**: 变更UUID
    """
    try:
        await DesignChangeService.delete_design_change(tenant_id, change_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{change_uuid}/submit-approval", response_model=DesignChangeResponse, summary="提交设计变更审批")
async def submit_for_approval(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    process_code: str = Query(..., description="审批流程代码")
):
    """
    提交设计变更审批
    
    - **change_uuid**: 变更UUID
    - **process_code**: 审批流程代码（如：design_change_approval）
    """
    try:
        return await DesignChangeService.submit_for_approval(tenant_id, change_uuid, process_code, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
