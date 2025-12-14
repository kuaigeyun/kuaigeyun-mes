"""
物料数据 API 模块

提供物料数据的 RESTful API 接口（物料分组、物料、BOM），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.material_service import MaterialService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/materials", tags=["Material"])


# ==================== 物料分组相关接口 ====================

@router.post("/groups", response_model=MaterialGroupResponse, summary="创建物料分组")
async def create_material_group(
    data: MaterialGroupCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料分组
    
    - **code**: 分组编码（必填，组织内唯一）
    - **name**: 分组名称（必填）
    - **parent_id**: 父分组ID（可选，用于层级结构）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await MaterialService.create_material_group(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/groups", response_model=List[MaterialGroupResponse], summary="获取物料分组列表")
async def list_material_groups(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    parent_id: Optional[int] = Query(None, description="父分组ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取物料分组列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **parent_id**: 父分组ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await MaterialService.list_material_groups(tenant_id, skip, limit, parent_id, is_active)


@router.get("/groups/{group_uuid}", response_model=MaterialGroupResponse, summary="获取物料分组详情")
async def get_material_group(
    group_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取物料分组详情
    
    - **group_uuid**: 物料分组UUID
    """
    try:
        return await MaterialService.get_material_group_by_uuid(tenant_id, group_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/groups/{group_uuid}", response_model=MaterialGroupResponse, summary="更新物料分组")
async def update_material_group(
    group_uuid: str,
    data: MaterialGroupUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料分组
    
    - **group_uuid**: 物料分组UUID
    - **code**: 分组编码（可选）
    - **name**: 分组名称（可选）
    - **parent_id**: 父分组ID（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await MaterialService.update_material_group(tenant_id, group_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/groups/{group_uuid}", summary="删除物料分组")
async def delete_material_group(
    group_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料分组（软删除）
    
    - **group_uuid**: 物料分组UUID
    
    注意：删除物料分组前需要检查是否有关联的子分组或物料
    """
    try:
        await MaterialService.delete_material_group(tenant_id, group_uuid)
        return {"message": "物料分组删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 物料相关接口 ====================

@router.post("", response_model=MaterialResponse, summary="创建物料")
async def create_material(
    data: MaterialCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料
    
    - **code**: 物料编码（必填，组织内唯一）
    - **name**: 物料名称（必填）
    - **group_id**: 物料分组ID（可选）
    - **specification**: 规格（可选）
    - **base_unit**: 基础单位（必填）
    - **units**: 多单位管理（可选，JSON格式）
    - **batch_managed**: 是否启用批号管理（默认：false）
    - **variant_managed**: 是否启用变体管理（默认：false）
    - **variant_attributes**: 变体属性（可选，JSON格式）
    - **description**: 描述（可选）
    - **brand**: 品牌（可选）
    - **model**: 型号（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await MaterialService.create_material(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MaterialResponse], summary="获取物料列表")
async def list_materials(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    group_id: Optional[int] = Query(None, description="物料分组ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取物料列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **group_id**: 物料分组ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await MaterialService.list_materials(tenant_id, skip, limit, group_id, is_active)


@router.get("/{material_uuid}", response_model=MaterialResponse, summary="获取物料详情")
async def get_material(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取物料详情
    
    - **material_uuid**: 物料UUID
    """
    try:
        return await MaterialService.get_material_by_uuid(tenant_id, material_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{material_uuid}", response_model=MaterialResponse, summary="更新物料")
async def update_material(
    material_uuid: str,
    data: MaterialUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料
    
    - **material_uuid**: 物料UUID
    - **code**: 物料编码（可选）
    - **name**: 物料名称（可选）
    - **group_id**: 物料分组ID（可选）
    - **specification**: 规格（可选）
    - **base_unit**: 基础单位（可选）
    - **units**: 多单位管理（可选，JSON格式）
    - **batch_managed**: 是否启用批号管理（可选）
    - **variant_managed**: 是否启用变体管理（可选）
    - **variant_attributes**: 变体属性（可选，JSON格式）
    - **description**: 描述（可选）
    - **brand**: 品牌（可选）
    - **model**: 型号（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await MaterialService.update_material(tenant_id, material_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{material_uuid}", summary="删除物料")
async def delete_material(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料（软删除）
    
    - **material_uuid**: 物料UUID
    
    注意：删除物料前需要检查是否被BOM使用
    """
    try:
        await MaterialService.delete_material(tenant_id, material_uuid)
        return {"message": "物料删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== BOM相关接口 ====================

@router.post("/bom", response_model=BOMResponse, summary="创建BOM")
async def create_bom(
    data: BOMCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建BOM
    
    - **material_id**: 主物料ID（必填）
    - **component_id**: 子物料ID（必填）
    - **quantity**: 用量（必填，必须大于0）
    - **unit**: 单位（必填）
    - **is_alternative**: 是否为替代料（默认：false）
    - **alternative_group_id**: 替代料组ID（可选）
    - **priority**: 优先级（默认：0，数字越小优先级越高）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await MaterialService.create_bom(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom", response_model=List[BOMResponse], summary="获取BOM列表")
async def list_bom(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    material_id: Optional[int] = Query(None, description="主物料ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取BOM列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **material_id**: 主物料ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await MaterialService.list_bom(tenant_id, skip, limit, material_id, is_active)


@router.get("/bom/{bom_uuid}", response_model=BOMResponse, summary="获取BOM详情")
async def get_bom(
    bom_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取BOM详情
    
    - **bom_uuid**: BOM UUID
    """
    try:
        return await MaterialService.get_bom_by_uuid(tenant_id, bom_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/bom/{bom_uuid}", response_model=BOMResponse, summary="更新BOM")
async def update_bom(
    bom_uuid: str,
    data: BOMUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新BOM
    
    - **bom_uuid**: BOM UUID
    - **material_id**: 主物料ID（可选）
    - **component_id**: 子物料ID（可选）
    - **quantity**: 用量（可选，必须大于0）
    - **unit**: 单位（可选）
    - **is_alternative**: 是否为替代料（可选）
    - **alternative_group_id**: 替代料组ID（可选）
    - **priority**: 优先级（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await MaterialService.update_bom(tenant_id, bom_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/bom/{bom_uuid}", summary="删除BOM")
async def delete_bom(
    bom_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除BOM（软删除）
    
    - **bom_uuid**: BOM UUID
    """
    try:
        await MaterialService.delete_bom(tenant_id, bom_uuid)
        return {"message": "BOM删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

