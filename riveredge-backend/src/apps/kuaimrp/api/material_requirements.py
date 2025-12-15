"""
物料需求 API 模块

提供物料需求的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimrp.services.material_requirement_service import MaterialRequirementService
from apps.kuaimrp.schemas.material_requirement_schemas import (
    MaterialRequirementCreate, MaterialRequirementUpdate, MaterialRequirementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/material-requirements", tags=["Material Requirements"])


@router.post("", response_model=MaterialRequirementResponse, status_code=status.HTTP_201_CREATED, summary="创建物料需求")
async def create_material_requirement(
    data: MaterialRequirementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料需求
    
    - **requirement_no**: 需求编号（必填，组织内唯一）
    - **material_id**: 物料ID（必填）
    - **requirement_type**: 需求类型（MRP、LRP）
    - **requirement_date**: 需求日期（必填）
    """
    try:
        return await MaterialRequirementService.create_material_requirement(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MaterialRequirementResponse], summary="获取物料需求列表")
async def list_material_requirements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    requirement_type: Optional[str] = Query(None, description="需求类型（过滤）"),
    plan_id: Optional[int] = Query(None, description="计划ID（过滤）"),
    material_id: Optional[int] = Query(None, description="物料ID（过滤）"),
    status: Optional[str] = Query(None, description="需求状态（过滤）")
):
    """
    获取物料需求列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **requirement_type**: 需求类型（可选，用于过滤）
    - **plan_id**: 计划ID（可选）
    - **material_id**: 物料ID（可选）
    - **status**: 需求状态（可选）
    """
    return await MaterialRequirementService.list_material_requirements(
        tenant_id, skip, limit, requirement_type, plan_id, material_id, status
    )


@router.get("/{requirement_uuid}", response_model=MaterialRequirementResponse, summary="获取物料需求详情")
async def get_material_requirement(
    requirement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取物料需求详情
    
    - **requirement_uuid**: 需求UUID
    """
    try:
        return await MaterialRequirementService.get_material_requirement_by_uuid(tenant_id, requirement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{requirement_uuid}", response_model=MaterialRequirementResponse, summary="更新物料需求")
async def update_material_requirement(
    requirement_uuid: str,
    data: MaterialRequirementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料需求
    
    - **requirement_uuid**: 需求UUID
    - **data**: 需求更新数据
    """
    try:
        return await MaterialRequirementService.update_material_requirement(tenant_id, requirement_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{requirement_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除物料需求")
async def delete_material_requirement(
    requirement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料需求（软删除）
    
    - **requirement_uuid**: 需求UUID
    """
    try:
        await MaterialRequirementService.delete_material_requirement(tenant_id, requirement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
