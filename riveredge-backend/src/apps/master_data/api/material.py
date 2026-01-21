"""
物料数据 API 模块

提供物料数据的 RESTful API 接口（物料分组、物料、BOM），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status
from typing import List, Optional, Annotated, Dict, Any

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.material_service import MaterialService
from apps.master_data.services.material_code_mapping_service import MaterialCodeMappingService
from apps.master_data.services.material_batch_service import MaterialBatchService
from apps.master_data.services.material_serial_service import MaterialSerialService
from apps.master_data.services.material_source_service import (
    MaterialSourceValidationService,
    MaterialSourceChangeService,
    MaterialSourceSuggestionService,
)
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate,
    BOMBatchImport, BOMVersionCreate, BOMVersionCompare,
    MaterialGroupTreeResponse,
    MaterialCodeMappingCreate, MaterialCodeMappingUpdate, MaterialCodeMappingResponse,
    MaterialCodeMappingListResponse, MaterialCodeConvertRequest, MaterialCodeConvertResponse,
    MaterialBatchCreate, MaterialBatchUpdate, MaterialBatchResponse, MaterialBatchListResponse,
    MaterialSerialCreate, MaterialSerialUpdate, MaterialSerialResponse, MaterialSerialListResponse
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
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    parent_id: Optional[int] = Query(None, description="父分组ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
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
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
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
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    material_id: Optional[int] = Query(None, description="主物料ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
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


@router.post("/bom/batch-import", response_model=List[BOMResponse], summary="批量导入BOM（支持部门编码）")
async def batch_import_bom(
    data: BOMBatchImport,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量导入BOM（支持universheet批量导入，支持部门编码自动映射）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **items**: BOM导入项列表（必填）
      - **parent_code**: 父件编码（支持任意部门编码：SALE-A001、DES-A001、主编码MAT-FIN-0001）
      - **component_code**: 子件编码（支持任意部门编码：PROD-A001、主编码MAT-SEMI-0001）
      - **quantity**: 子件数量（必填，数字）
      - **unit**: 子件单位（可选，如：个、kg、m等）
      - **waste_rate**: 损耗率（可选，百分比，如：5%表示5.00）
      - **is_required**: 是否必选（可选，是/否，默认：是）
      - **remark**: 备注（可选）
    - **version**: BOM版本号（可选，默认：1.0）
    - **bom_code**: BOM编码（可选）
    - **effective_date**: 生效日期（可选）
    - **description**: 描述（可选）
    
    系统会自动：
    - 识别部门编码，自动映射到主编码
    - 验证BOM数据完整性
    - 检测循环依赖
    - 检测重复子件
    - 生成BOM层级结构
    """
    try:
        return await MaterialService.batch_import_bom(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/bom/material/{material_id}/hierarchy", summary="生成BOM层级结构")
async def get_bom_hierarchy(
    material_id: int,
    version: Optional[str] = Query(None, description="BOM版本（可选，如果不提供则使用最新版本）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    生成BOM层级结构
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **material_id**: 主物料ID
    - **version**: BOM版本（可选，如果不提供则使用最新版本）
    
    返回完整的BOM树形结构，支持多层级BOM展开。
    """
    try:
        return await MaterialService.generate_bom_hierarchy(tenant_id, material_id, version)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/material/{material_id}/quantity", summary="计算BOM用量（考虑损耗率）")
async def calculate_bom_quantity(
    material_id: int,
    parent_quantity: float = Query(1.0, ge=0, description="父物料数量（默认1.0）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    version: Optional[str] = Query(None, description="BOM版本（可选，如果不提供则使用最新版本）")
):
    """
    计算BOM用量（考虑多层级和损耗率）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **material_id**: 主物料ID
    - **parent_quantity**: 父物料数量（默认1.0）
    - **version**: BOM版本（可选，如果不提供则使用最新版本）
    
    返回每个子物料的实际用量（考虑损耗率）。
    """
    try:
        from decimal import Decimal
        return await MaterialService.calculate_bom_quantity(
            tenant_id, material_id, Decimal(str(parent_quantity)), version
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/material/{material_id}/version", response_model=List[BOMResponse], summary="创建BOM新版本")
async def create_bom_version(
    material_id: int,
    data: BOMVersionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建BOM新版本
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **material_id**: 主物料ID
    - **version**: 版本号（如：v1.1）
    - **version_description**: 版本说明（可选）
    - **effective_date**: 生效日期（可选）
    - **apply_strategy**: 版本应用策略（new_only：仅新工单使用新版本，推荐；all：所有工单使用新版本，谨慎使用）
    
    系统会自动复制当前版本创建新版本。
    """
    try:
        return await MaterialService.create_bom_version(tenant_id, material_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/material/{material_id}/compare-versions", summary="对比BOM版本")
async def compare_bom_versions(
    material_id: int,
    data: BOMVersionCompare,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    对比BOM版本
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **material_id**: 主物料ID
    - **version1**: 版本1（如：v1.0）
    - **version2**: 版本2（如：v1.1）
    
    返回版本对比结果，包括新增、删除、修改的子件。
    """
    try:
        return await MaterialService.compare_bom_versions(tenant_id, material_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/detect-cycle", summary="检测BOM循环依赖")
async def detect_bom_cycle(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
    material_id: int = Query(..., description="主物料ID（父件）"),
    component_id: int = Query(..., description="子物料ID（子件）")
):
    """
    检测BOM循环依赖
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **material_id**: 主物料ID（父件）
    - **component_id**: 子物料ID（子件）
    
    返回是否会导致循环依赖（true：会形成循环，false：不会形成循环）。
    """
    try:
        has_cycle = await MaterialService.detect_bom_cycle(tenant_id, material_id, component_id)
        return {"has_cycle": has_cycle}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 物料编码映射相关接口 ====================
# 注意：映射路由必须在物料详情路由之前，避免 /mapping 被 /{material_uuid} 匹配

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


# ==================== 物料批号相关接口 ====================
# 注意：批号路由必须在物料详情路由之前，避免 /batches 被 /{material_uuid} 匹配

@router.post("/batches", response_model=MaterialBatchResponse, summary="创建物料批号")
async def create_material_batch(
    data: MaterialBatchCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料批号
    
    - **material_uuid**: 物料UUID（必填）
    - **batch_no**: 批号（必填，同一物料下唯一）
    - **production_date**: 生产日期（可选）
    - **expiry_date**: 有效期（可选，用于有保质期的物料）
    - **supplier_batch_no**: 供应商批号（可选）
    - **quantity**: 批号数量（默认：0）
    - **status**: 批号状态（默认：in_stock）
    - **remark**: 备注（可选）
    """
    try:
        return await MaterialBatchService.create_batch(tenant_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batches", response_model=MaterialBatchListResponse, summary="获取物料批号列表")
async def list_material_batches(
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选条件）"),
    batch_no: Optional[str] = Query(None, description="批号（模糊搜索）"),
    batch_status: Optional[str] = Query(None, alias="status", description="状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    获取物料批号列表
    
    支持按物料、批号、状态筛选和搜索。
    """
    try:
        return await MaterialBatchService.list_batches(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            batch_no=batch_no,
            status=batch_status,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取批号列表失败: {str(e)}"
        )


@router.get("/batches/{batch_uuid}", response_model=MaterialBatchResponse, summary="获取物料批号详情")
async def get_material_batch(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料批号详情
    """
    try:
        return await MaterialBatchService.get_batch_by_uuid(tenant_id, batch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/batches/{batch_uuid}", response_model=MaterialBatchResponse, summary="更新物料批号")
async def update_material_batch(
    batch_uuid: str,
    data: MaterialBatchUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料批号
    """
    try:
        return await MaterialBatchService.update_batch(tenant_id, batch_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/batches/{batch_uuid}", summary="删除物料批号")
async def delete_material_batch(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料批号（软删除）
    """
    try:
        await MaterialBatchService.delete_batch(tenant_id, batch_uuid)
        return {"message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/batches/generate", summary="生成批号")
async def generate_batch_no(
    material_uuid: str = Query(..., description="物料UUID"),
    rule: Optional[str] = Query(None, description="批号生成规则（可选）"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    生成批号
    
    支持多种批号生成规则：
    - {YYYYMMDD}-{序号}：20260115-001
    - {物料编码}-{YYYYMMDD}-{序号}：MAT-RAW-0001-20260115-001
    """
    try:
        batch_no = await MaterialBatchService.generate_batch_no(tenant_id, material_uuid, rule)
        return {"batch_no": batch_no}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batches/{batch_uuid}/trace", summary="批号追溯")
async def trace_batch(
    batch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批号追溯
    
    查询批号的完整流转历史（入库→出库→生产→销售）
    """
    try:
        return await MaterialBatchService.trace_batch(tenant_id, batch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 物料序列号相关接口 ====================
# 注意：序列号路由必须在物料详情路由之前，避免 /serials 被 /{material_uuid} 匹配

@router.post("/serials", response_model=MaterialSerialResponse, summary="创建物料序列号")
async def create_material_serial(
    data: MaterialSerialCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建物料序列号
    
    - **material_uuid**: 物料UUID（必填）
    - **serial_no**: 序列号（必填，全局唯一）
    - **production_date**: 生产日期（可选）
    - **factory_date**: 出厂日期（可选）
    - **supplier_serial_no**: 供应商序列号（可选）
    - **status**: 序列号状态（默认：in_stock）
    - **remark**: 备注（可选）
    """
    try:
        return await MaterialSerialService.create_serial(tenant_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/serials", response_model=MaterialSerialListResponse, summary="获取物料序列号列表")
async def list_material_serials(
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选条件）"),
    serial_no: Optional[str] = Query(None, description="序列号（模糊搜索）"),
    serial_status: Optional[str] = Query(None, alias="status", description="状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    获取物料序列号列表
    
    支持按物料、序列号、状态筛选和搜索。
    """
    try:
        return await MaterialSerialService.list_serials(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            serial_no=serial_no,
            status=serial_status,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取序列号列表失败: {str(e)}"
        )


@router.get("/serials/{serial_uuid}", response_model=MaterialSerialResponse, summary="获取物料序列号详情")
async def get_material_serial(
    serial_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料序列号详情
    """
    try:
        return await MaterialSerialService.get_serial_by_uuid(tenant_id, serial_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/serials/{serial_uuid}", response_model=MaterialSerialResponse, summary="更新物料序列号")
async def update_material_serial(
    serial_uuid: str,
    data: MaterialSerialUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新物料序列号
    """
    try:
        return await MaterialSerialService.update_serial(tenant_id, serial_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/serials/{serial_uuid}", summary="删除物料序列号")
async def delete_material_serial(
    serial_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除物料序列号（软删除）
    """
    try:
        await MaterialSerialService.delete_serial(tenant_id, serial_uuid)
        return {"message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/serials/generate", summary="生成序列号（批量）")
async def generate_serial_nos(
    material_uuid: str = Query(..., description="物料UUID"),
    count: int = Query(1, ge=1, le=1000, description="生成数量"),
    rule: Optional[str] = Query(None, description="序列号生成规则（可选）"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    生成序列号（批量生成）
    
    支持多种序列号生成规则：
    - {物料编码}-{YYYYMMDD}-{6位序号}：MAT-FIN-0001-20260115-000001
    - {物料编码}-{YYYY}-{6位序号}：MAT-FIN-0001-2026-000001
    """
    try:
        serial_nos = await MaterialSerialService.generate_serial_no(tenant_id, material_uuid, count, rule)
        return {"serial_nos": serial_nos, "count": len(serial_nos)}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/serials/{serial_uuid}/trace", summary="序列号追溯")
async def trace_serial(
    serial_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    序列号追溯
    
    查询序列号的完整生命周期（生产→入库→出库→销售→售后）
    """
    try:
        return await MaterialSerialService.trace_serial(tenant_id, serial_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 物料相关接口 ====================
# 注意：物料详情路由必须在 BOM 路由之后，避免 /bom 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在映射路由之后，避免 /mapping 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在批号路由之后，避免 /batches 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在序列号路由之后，避免 /serials 被 /{material_uuid} 匹配

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
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    group_id: Optional[int] = Query(None, alias="groupId", description="物料分组ID（过滤）"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（物料编码或名称）"),
    code: Optional[str] = Query(None, description="物料编码（精确匹配）"),
    name: Optional[str] = Query(None, description="物料名称（模糊匹配）"),
    material_type: Optional[str] = Query(None, alias="materialType", description="物料类型（过滤）"),
    specification: Optional[str] = Query(None, description="规格（模糊匹配）"),
    brand: Optional[str] = Query(None, description="品牌（模糊匹配）"),
    model: Optional[str] = Query(None, description="型号（模糊匹配）"),
    base_unit: Optional[str] = Query(None, alias="baseUnit", description="基础单位（精确匹配）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
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
    - **material_type**: 物料类型（可选，用于过滤）
    - **specification**: 规格（可选，模糊匹配）
    - **brand**: 品牌（可选，模糊匹配）
    - **model**: 型号（可选，模糊匹配）
    - **base_unit**: 基础单位（可选，精确匹配）
    """
    return await MaterialService.list_materials(
        tenant_id, skip, limit, group_id, is_active, keyword, code, name,
        material_type, specification, brand, model, base_unit
    )


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


# ==================== 物料来源控制相关接口 ====================

@router.get("/{material_uuid}/source/validate", summary="验证物料来源配置")
async def validate_material_source(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    验证物料来源配置
    
    验证物料来源类型和相关配置的完整性，返回验证结果（通过/警告/错误）。
    """
    try:
        return await MaterialSourceValidationService.validate_material_source(
            tenant_id=tenant_id,
            material_uuid=material_uuid
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证失败: {str(e)}"
        )


@router.post("/{material_uuid}/source/validate-batch", summary="批量验证物料来源配置")
async def validate_batch_material_sources(
    material_uuids: List[str],
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量验证物料来源配置
    
    批量验证多个物料的来源配置完整性。
    """
    try:
        return await MaterialSourceValidationService.validate_batch_materials(
            tenant_id=tenant_id,
            material_uuids=material_uuids
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量验证失败: {str(e)}"
        )


@router.get("/{material_uuid}/source/change-impact", summary="检查物料来源类型变更影响")
async def check_source_change_impact(
    material_uuid: str = Path(..., description="物料UUID"),
    new_source_type: str = Query(..., description="新的来源类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    检查物料来源类型变更的影响
    
    检查变更物料来源类型对在制工单、采购订单等的影响。
    """
    try:
        return await MaterialSourceChangeService.check_change_impact(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            new_source_type=new_source_type
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查变更影响失败: {str(e)}"
        )


@router.put("/{material_uuid}/source/change", response_model=MaterialResponse, summary="变更物料来源类型")
async def change_material_source(
    material_uuid: str = Path(..., description="物料UUID"),
    new_source_type: str = Body(..., description="新的来源类型"),
    new_source_config: Optional[Dict[str, Any]] = Body(None, description="新的来源配置（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    变更物料来源类型
    
    变更物料的来源类型和相关配置，系统会自动检查变更影响并处理。
    """
    try:
        material = await MaterialSourceChangeService.apply_source_change(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            new_source_type=new_source_type,
            new_source_config=new_source_config,
            updated_by=current_user.id
        )
        return await MaterialService.get_material_by_uuid(tenant_id, material.uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"变更失败: {str(e)}"
        )


@router.get("/{material_uuid}/source/suggest", summary="建议物料来源类型")
async def suggest_material_source(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    建议物料来源类型
    
    基于物料类型、BOM结构、历史数据等智能建议物料来源类型。
    """
    try:
        return await MaterialSourceSuggestionService.suggest_source_type(
            tenant_id=tenant_id,
            material_uuid=material_uuid
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"建议失败: {str(e)}"
        )


@router.get("/{material_uuid}/source/check-completeness", summary="检查物料来源配置完整性")
async def check_source_config_completeness(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    检查物料来源配置完整性
    
    检查物料来源配置是否完整，返回缺失的配置项。
    """
    try:
        return await MaterialSourceSuggestionService.check_config_completeness(
            tenant_id=tenant_id,
            material_uuid=material_uuid
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查失败: {str(e)}"
        )

