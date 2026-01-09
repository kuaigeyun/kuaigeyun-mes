"""
物料数据 API 模块

提供物料数据的 RESTful API 接口（物料分组、物料、BOM），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.material_service import MaterialService
from apps.master_data.services.material_code_mapping_service import MaterialCodeMappingService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate,
    MaterialGroupTreeResponse,
    MaterialCodeMappingCreate, MaterialCodeMappingUpdate, MaterialCodeMappingResponse,
    MaterialCodeMappingListResponse, MaterialCodeConvertRequest, MaterialCodeConvertResponse
)
from apps.master_data.services.ai.material_ai_service import MaterialAIService
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


@router.get("/groups/tree", response_model=List[MaterialGroupTreeResponse], response_model_by_alias=True, summary="获取物料分组树形结构")
async def get_material_group_tree(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）")
):
    """
    获取物料分组树形结构（物料分组→物料）
    
    返回完整的物料分组层级结构，支持多级分组，用于级联选择等场景。
    
    - **is_active**: 是否只查询启用的数据（可选）
    
    返回结构：
    ```json
    [
      {
        "id": 1,
        "uuid": "...",
        "code": "MG001",
        "name": "物料分组1",
        "children": [
          {
            "id": 2,
            "uuid": "...",
            "code": "MG002",
            "name": "子分组1",
            "children": [],
            "materials": [
              {
                "id": 1,
                "uuid": "...",
                "code": "MAT001",
                "name": "物料1"
              }
            ]
          }
        ],
        "materials": []
      }
    ]
    ```
    """
    return await MaterialService.get_material_group_tree(tenant_id, is_active)


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


# ==================== BOM相关接口 ====================
# 注意：BOM 路由必须在物料详情路由之前，避免 /bom 被 /{material_uuid} 匹配

@router.post("/bom", response_model=List[BOMResponse], summary="创建BOM（支持批量创建）")
async def create_bom(
    data: BOMBatchCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建BOM（支持为一个主物料批量添加多个子物料）
    
    - **material_id**: 主物料ID（必填）
    - **items**: 子物料项列表（必填，至少一个）
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
        return await MaterialService.create_bom_batch(tenant_id, data)
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


@router.post("/bom/{bom_uuid}/approve", response_model=BOMResponse, summary="审核BOM")
async def approve_bom(
    bom_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    approved: bool = Query(True, description="是否通过审核"),
    approval_comment: Optional[str] = Query(None, description="审核意见")
):
    """
    审核BOM
    
    - **bom_uuid**: BOM UUID
    - **approved**: 是否通过（true=通过，false=拒绝）
    - **approval_comment**: 审核意见（可选）
    """
    try:
        return await MaterialService.approve_bom(
            tenant_id=tenant_id,
            bom_uuid=bom_uuid,
            approved_by=current_user.id,
            approval_comment=approval_comment,
            approved=approved
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/{bom_uuid}/copy", response_model=BOMResponse, summary="复制BOM（创建新版本）")
async def copy_bom(
    bom_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    new_version: Optional[str] = Query(None, description="新版本号（可选）")
):
    """
    复制BOM（创建新版本）
    
    - **bom_uuid**: 源BOM UUID
    - **new_version**: 新版本号（可选，如果不提供则自动递增）
    """
    try:
        return await MaterialService.copy_bom(
            tenant_id=tenant_id,
            bom_uuid=bom_uuid,
            new_version=new_version
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/material/{material_id}", response_model=List[BOMResponse], summary="根据主物料获取BOM列表")
async def get_bom_by_material(
    material_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    version: Optional[str] = Query(None, description="版本号（可选）"),
    only_active: bool = Query(True, description="是否只返回已审核的BOM")
):
    """
    根据主物料获取BOM列表
    
    - **material_id**: 主物料ID
    - **version**: 版本号（可选）
    - **only_active**: 是否只返回已审核的BOM（默认：true）
    """
    try:
        return await MaterialService.get_bom_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            version=version,
            only_active=only_active
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/versions/{bom_code}", response_model=List[BOMResponse], summary="获取BOM所有版本")
async def get_bom_versions(
    bom_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取指定BOM编码的所有版本
    
    - **bom_code**: BOM编码
    """
    try:
        return await MaterialService.get_bom_versions(
            tenant_id=tenant_id,
            bom_code=bom_code
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 物料相关接口 ====================
# 注意：物料详情路由必须在 BOM 路由之后，避免 /bom 被 /{material_uuid} 匹配

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
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（物料编码或名称）"),
    code: Optional[str] = Query(None, description="物料编码（精确匹配）"),
    name: Optional[str] = Query(None, description="物料名称（模糊匹配）")
):
    """
    获取物料列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **group_id**: 物料分组ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（物料编码或名称）
    - **code**: 物料编码（精确匹配）
    - **name**: 物料名称（模糊匹配）
    """
    return await MaterialService.list_materials(tenant_id, skip, limit, group_id, is_active, keyword, code, name)


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


# ==================== 物料编码映射相关接口 ====================

@router.post("/mapping", response_model=MaterialCodeMappingResponse, summary="创建物料编码映射")
async def create_material_code_mapping(
    data: MaterialCodeMappingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料编码映射
    
    用于将外部系统的编码映射到内部物料编码。
    
    - **material_uuid**: 物料UUID（必填，关联内部物料）
    - **internal_code**: 内部编码（必填，物料编码）
    - **external_code**: 外部编码（必填，外部系统的编码）
    - **external_system**: 外部系统名称（必填，如：ERP、WMS、MES等）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await MaterialCodeMappingService.create_mapping(tenant_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/mapping", response_model=MaterialCodeMappingListResponse, summary="获取物料编码映射列表")
async def list_material_code_mappings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: Optional[str] = Query(None, description="物料UUID（过滤）"),
    external_system: Optional[str] = Query(None, description="外部系统名称（过滤）"),
    internal_code: Optional[str] = Query(None, description="内部编码（模糊匹配）"),
    external_code: Optional[str] = Query(None, description="外部编码（模糊匹配）"),
    is_active: Optional[bool] = Query(None, description="是否启用（过滤）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页大小")
):
    """
    获取物料编码映射列表
    
    - **material_uuid**: 物料UUID（可选，用于过滤）
    - **external_system**: 外部系统名称（可选，用于过滤）
    - **internal_code**: 内部编码（可选，模糊匹配）
    - **external_code**: 外部编码（可选，模糊匹配）
    - **is_active**: 是否启用（可选，用于过滤）
    - **page**: 页码（默认：1）
    - **page_size**: 每页大小（默认：20，最大：100）
    """
    return await MaterialCodeMappingService.list_mappings(
        tenant_id=tenant_id,
        material_uuid=material_uuid,
        external_system=external_system,
        internal_code=internal_code,
        external_code=external_code,
        is_active=is_active,
        page=page,
        page_size=page_size
    )


@router.get("/mapping/{mapping_uuid}", response_model=MaterialCodeMappingResponse, summary="获取物料编码映射详情")
async def get_material_code_mapping(
    mapping_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取物料编码映射详情
    
    - **mapping_uuid**: 映射UUID
    """
    try:
        return await MaterialCodeMappingService.get_mapping_by_uuid(tenant_id, mapping_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/mapping/{mapping_uuid}", response_model=MaterialCodeMappingResponse, summary="更新物料编码映射")
async def update_material_code_mapping(
    mapping_uuid: str,
    data: MaterialCodeMappingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料编码映射
    
    - **mapping_uuid**: 映射UUID
    - **material_uuid**: 物料UUID（可选）
    - **internal_code**: 内部编码（可选）
    - **external_code**: 外部编码（可选）
    - **external_system**: 外部系统名称（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await MaterialCodeMappingService.update_mapping(tenant_id, mapping_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/mapping/{mapping_uuid}", summary="删除物料编码映射")
async def delete_material_code_mapping(
    mapping_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料编码映射（软删除）
    
    - **mapping_uuid**: 映射UUID
    """
    try:
        await MaterialCodeMappingService.delete_mapping(tenant_id, mapping_uuid)
        return {"message": "物料编码映射删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/mapping/convert", response_model=MaterialCodeConvertResponse, summary="编码转换")
async def convert_material_code(
    request: MaterialCodeConvertRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    编码转换（外部编码 -> 内部编码）
    
    根据外部系统的编码查找对应的内部物料编码。
    
    - **external_code**: 外部编码（必填）
    - **external_system**: 外部系统名称（必填，如：ERP、WMS、MES等）
    
    Returns:
        MaterialCodeConvertResponse: 编码转换结果
        - **found**: 是否找到映射
        - **internal_code**: 内部编码（如果找到）
        - **material_uuid**: 物料UUID（如果找到）
        - **material_name**: 物料名称（如果找到）
    """
    return await MaterialCodeMappingService.convert_code(tenant_id, request)


@router.post("/mapping/batch-import", summary="批量导入物料编码映射")
async def batch_import_material_code_mappings(
    mappings_data: List[MaterialCodeMappingCreate],
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量导入物料编码映射
    
    支持批量创建多个物料编码映射。
    
    - **mappings_data**: 映射创建数据列表
    
    Returns:
        dict: 批量导入结果
        - **success_count**: 成功数量
        - **failure_count**: 失败数量
        - **errors**: 错误列表
    """
    return await MaterialCodeMappingService.batch_create_mappings(tenant_id, mappings_data)


# ==================== AI 建议相关接口 ====================

@router.get("/ai-suggestions/preview", summary="预览 AI 建议（创建前）")
async def preview_ai_suggestions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_name: str = Query(..., description="物料名称"),
    specification: Optional[str] = Query(None, description="规格"),
    base_unit: Optional[str] = Query(None, description="基础单位"),
    material_type: Optional[str] = Query(None, description="物料类型")
):
    """
    预览 AI 建议（创建前）
    
    在创建物料前，基于输入信息生成 AI 建议，主要用于：
    - 识别重复物料
    - 配置建议
    
    - **material_name**: 物料名称（必填）
    - **specification**: 规格（可选）
    - **base_unit**: 基础单位（可选）
    - **material_type**: 物料类型（可选）
    """
    try:
        suggestions = await MaterialAIService.generate_suggestions(
            tenant_id=tenant_id,
            material_id=None,  # 创建前，material_id 为 None
            material_name=material_name,
            specification=specification,
            base_unit=base_unit,
            material_type=material_type,
        )
        return {
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成 AI 建议失败: {str(e)}"
        )


@router.get("/{material_uuid}/ai-suggestions", summary="获取物料 AI 建议（创建后）")
async def get_material_ai_suggestions(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料 AI 建议（创建后）
    
    在物料创建后，基于已创建的物料生成 AI 建议，主要用于：
    - 识别重复物料
    - 配置建议
    - 数据完整性检查
    
    - **material_uuid**: 物料UUID
    """
    try:
        # 先获取物料信息
        material = await MaterialService.get_material_by_uuid(tenant_id, material_uuid)
        
        suggestions = await MaterialAIService.generate_suggestions(
            tenant_id=tenant_id,
            material_id=material.id,
            material_name=material.name,
            specification=material.specification,
            base_unit=material.base_unit,
            material_type=material.material_type,
        )
        return {
            "material_uuid": material_uuid,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成 AI 建议失败: {str(e)}"
        )

