"""
物料数据 API 模块

提供物料数据的 RESTful API 接口（物料分组、物料、BOM），支持多组织隔离。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, Request, status
from typing import List, Optional, Annotated, Dict, Any
from loguru import logger
from pydantic import BaseModel, Field, ConfigDict, model_validator

from core.api.deps.deps import get_current_user, get_current_tenant
from core.api.deps.access import (
    AuthContext,
    ensure_permission_codes,
    get_auth_context,
    require_permission_codes,
)
from apps.master_data.api._master_data_route_access import require_master_data_module_access
from core.config.permission_contract import build_permission_code
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
from apps.master_data.services.material_health_service import MaterialHealthService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse, MaterialListResponse,
    MaterialBulkTrackingRequest, MaterialBulkTrackingResponse,
    MaterialBulkVariantRequest,
    MaterialGenerateVariantsRequest,
    MaterialGenerateVariantsResponse,
    MaterialMaterializeVariantRequest,
    MaterialMaterializeVariantResponse,
    MaterialBatchDeleteRequest, MaterialBatchDeleteResponse,
    MaterialBatchMoveGroupRequest, MaterialBatchMoveGroupResponse,
    MaterialBatchUpdateProcessRouteRequest, MaterialBatchUpdateSourceTypeRequest,
    MaterialBulkDefaultsPatchRequest,
    MaterialBulkInspectionPatchRequest,
    MaterialBulkInspectionPatchResponse,
    MaterialBulkCreateRequest,
    MaterialBulkCreateResponse,
    MaterialBatchFieldUpdateResponse,
    MaterialRewriteMainCodesRequest, MaterialRewriteMainCodesResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate,
    BOMBatchImport, BOMVersionCreate, BOMVersionCompare,
    BOMRelationImportRequest, BOMRelationImportResponse,
    BOMGroupSummary, BOMGroupListResponse, BOMBatchItemsRequest,
    MaterialGroupTreeListResponse,
    MaterialCodeMappingCreate, MaterialCodeMappingUpdate, MaterialCodeMappingResponse,
    MaterialCodeMappingListResponse, MaterialCodeConvertRequest, MaterialCodeConvertResponse,
    MaterialBatchCreate, MaterialBatchUpdate, MaterialBatchResponse, MaterialBatchListResponse,
    GenerateBatchNoRequest,
    MaterialSerialCreate, MaterialSerialUpdate, MaterialSerialResponse, MaterialSerialListResponse
)
from apps.master_data.schemas.material_health_schemas import (
    MaterialHealthCheckRequest,
    MaterialHealthCheckResponse,
)
from apps.master_data.schemas.material_dedup_schemas import (
    MaterialDedupCheckRequest,
    MaterialDedupCheckResponse,
)
from apps.master_data.services.material_dedup_service import MaterialDedupService
from apps.master_data.services.bom_change_service import BOMChangeService
from apps.master_data.schemas.bom_change_schemas import (
    BOMChangeCreate,
    BOMChangeUpdate,
    BOMChangeResponse,
    BOMChangeListResponse,
)
from infra.exceptions.exceptions import ConflictError, NotFoundError, ValidationError

router = APIRouter(
    prefix="/materials",
    tags=["App - Master Data - Materials"],
    dependencies=[Depends(require_master_data_module_access("material"))],
)

_BOM_MODULE = "process:engineering-bom"


def _http_error(
    status_code: int,
    detail: Any,
    route: str = "/materials",
    tenant_id: Optional[int] = None,
) -> HTTPException:
    """构造带 trace_id 的 HTTPException，便于问题定位。"""
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_material_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


# ==================== 物料分组相关接口 ====================

@router.post("/groups", response_model=MaterialGroupResponse, summary="Create material group")
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
        return await MaterialService.create_material_group(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/groups", response_model=List[MaterialGroupResponse], summary="List material groups")
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


@router.get(
    "/groups/tree",
    response_model=MaterialGroupTreeListResponse,
    response_model_by_alias=True,
    summary="Get material group tree",
)
async def get_material_group_tree(
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取物料分组树形结构。

    每个节点含 materialCount（本组及下级树形列表主行数，含孤儿属性 SKU）。
    另含 ungroupedMaterialCount / totalMaterialCount。
    """
    return await MaterialService.get_material_group_tree(tenant_id, is_active)


@router.get("/groups/{group_uuid}", response_model=MaterialGroupResponse, summary="Get material group")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/groups/{group_uuid}", response_model=MaterialGroupResponse, summary="Update material group")
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
        return await MaterialService.update_material_group(tenant_id, group_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/groups/{group_uuid}", summary="Delete material group")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== BOM相关接口 ====================
# 注意：BOM 路由必须在物料详情路由之前，避免 /bom 被 /{material_uuid} 匹配

@router.post("/bom", response_model=List[BOMResponse], summary="Create BOM (batch supported)")
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
        return await MaterialService.create_bom_batch(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/groups", response_model=BOMGroupListResponse, summary="List BOM group summaries")
async def list_bom_groups(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    include_obsolete: bool = Query(False, description="是否包含已失效版本"),
    skip: Optional[int] = Query(None, ge=0, description="按主物料分页偏移"),
    limit: Optional[int] = Query(None, ge=1, le=500, description="按主物料分页大小"),
    view: Optional[str] = Query(None, description="productBom / semiProductBom / allBom"),
    material_id: Optional[int] = Query(None, description="主物料 ID"),
    material_ids: Optional[List[int]] = Query(None, description="主物料 ID 列表（嵌套半成品补齐）"),
    approval_status: Optional[str] = Query(None, description="审核状态"),
    keyword: Optional[str] = Query(None, description="BOM 编码 / 物料编码 / 名称"),
):
    """按主物料分页返回 BOM 分组摘要，不拉取子件明细。"""
    return await MaterialService.list_bom_groups(
        tenant_id=tenant_id,
        include_obsolete=include_obsolete,
        skip=skip,
        limit=limit,
        view=view,
        material_id=material_id,
        material_ids=material_ids,
        approval_status=approval_status,
        keyword=keyword,
    )


@router.get("/bom/component-ids", summary="List component material IDs")
async def list_bom_component_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    include_obsolete: bool = Query(False, description="是否包含已失效版本"),
) -> List[int]:
    """返回在 BOM 中作为 component_id 出现过的物料 ID 列表。"""
    return await MaterialService.list_bom_component_ids(tenant_id=tenant_id, include_obsolete=include_obsolete)


@router.post("/bom/batch-items", summary="Batch fetch BOM line items by material and version")
async def list_bom_items_batch(
    body: BOMBatchItemsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
) -> Dict[str, List[BOMResponse]]:
    """
    一次请求拉取多组 (material_id, version) 的 BOM 子件明细，用于列表树完整构建，避免 limit 与 N+1。
    返回 key 为 "material_id|version"，value 为该版本的 BOM 行列表。
    """
    material_versions = [{"material_id": i.material_id, "version": i.version or "1.0"} for i in body.items]
    return await MaterialService.list_bom_items_by_materials_batch(
        tenant_id=tenant_id,
        material_versions=material_versions,
        include_obsolete=body.include_obsolete,
    )


@router.get("/bom", response_model=List[BOMResponse], summary="List BOMs")
async def list_bom(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=10000, description="限制数量（树形列表建议 10000 以加载完整层级）"),
    material_id: Optional[int] = Query(None, description="主物料ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    include_obsolete: bool = Query(False, description="是否包含已失效的BOM版本"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取BOM列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **material_id**: 主物料ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **include_obsolete**: 是否包含已失效版本（默认：false）
    """
    result = await MaterialService.list_bom(
        tenant_id, skip, limit, material_id, is_active, include_obsolete
    )
    return result if result is not None else []


@router.get("/bom/batch-check", summary="Batch check materials have BOM")
async def batch_check_has_bom(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_ids: List[int] = Query(..., description="物料ID列表"),
    only_active: bool = Query(True, description="是否只检查已审核的BOM"),
) -> Dict[str, bool]:
    """
    批量检查物料是否有BOM配置（用于销售订单明细视图等批量检查场景）

    - **material_ids**: 物料ID列表（必填）
    - **only_active**: 是否只检查已审核的BOM（默认：true）

    返回：{ "1": true, "2": false, "3": true }（物料ID -> 是否有BOM）
    """
    result = await MaterialService.batch_check_has_bom(
        tenant_id=tenant_id,
        material_ids=material_ids,
        only_active=only_active
    )
    return {str(k): v for k, v in result.items()}


# ==================== BOM 工程变更（ECN）相关接口 ====================
# 列表使用 /bom-change-records，避免 GET /bom/changes 与 /bom/{bom_uuid} 路径冲突

@router.get("/bom-change-records", response_model=BOMChangeListResponse, summary="List BOM change records")
async def list_bom_change_records(
    material_uuid: Optional[str] = Query(None, description="主物料UUID（筛选条件）"),
    change_type: Optional[str] = Query(None, description="变更类型（筛选条件）"),
    status: Optional[str] = Query(None, description="变更状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """获取 BOM 工程变更记录列表（推荐路径，不与 /bom/{bom_uuid} 冲突）"""
    try:
        return await BOMChangeService.list_changes(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            change_type=change_type,
            status=status,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取变更记录列表失败: {str(e)}",
        )


@router.post("/bom/changes", response_model=BOMChangeResponse, summary="Create BOM change record")
async def create_bom_change(
    data: BOMChangeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    创建 BOM 工程变更记录（ECN）

    - **material_uuid**: 主物料UUID（必填）
    - **change_type**: 变更类型（item_add/item_remove/item_modify/version_change/effective_change/other）
    - **change_content**: 变更内容（JSON格式，可选）
    - **change_reason**: 变更原因（可选）
    - **change_impact**: 变更影响分析（JSON格式，可选）
    - **bom_code**: 关联的 BOM 编码（可选）
    - **from_version** / **to_version**: 版本变更时填写（可选）
    """
    try:
        return await BOMChangeService.create_change(tenant_id, data, current_user.id)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/changes", response_model=BOMChangeListResponse, summary="List BOM change records")
async def list_bom_changes(
    material_uuid: Optional[str] = Query(None, description="主物料UUID（筛选条件）"),
    change_type: Optional[str] = Query(None, description="变更类型（筛选条件）"),
    status: Optional[str] = Query(None, description="变更状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """获取 BOM 工程变更记录列表，支持按物料、变更类型、状态筛选"""
    try:
        return await BOMChangeService.list_changes(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            change_type=change_type,
            status=status,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取变更记录列表失败: {str(e)}",
        )


@router.get("/bom/changes/{change_uuid}", response_model=BOMChangeResponse, summary="Get BOM change record")
async def get_bom_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """获取 BOM 工程变更记录详情"""
    try:
        return await BOMChangeService.get_change_by_uuid(tenant_id, change_uuid)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/bom/changes/{change_uuid}", response_model=BOMChangeResponse, summary="Update BOM change record")
async def update_bom_change(
    change_uuid: str,
    data: BOMChangeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """更新 BOM 工程变更记录"""
    try:
        return await BOMChangeService.update_change(
            tenant_id, change_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/changes/{change_uuid}/approve", response_model=BOMChangeResponse, summary="Approve BOM change record")
async def approve_bom_change(
    change_uuid: str,
    approved: bool = Query(..., description="是否同意（true:同意, false:拒绝）"),
    approval_comment: Optional[str] = Query(None, description="审批意见（可选）"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """审批 BOM 工程变更记录"""
    try:
        return await BOMChangeService.approve_change(
            tenant_id, change_uuid, current_user.id, approved, approval_comment
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/changes/{change_uuid}/execute", response_model=BOMChangeResponse, summary="Execute BOM change record")
async def execute_bom_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """执行 BOM 工程变更记录（将已审批的变更标记为已执行）"""
    try:
        return await BOMChangeService.execute_change(tenant_id, change_uuid, current_user.id)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/detect-cycle", summary="Detect BOM cycles")
async def detect_bom_cycle(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
    material_id: int = Query(..., description="主物料ID（父件）"),
    component_id: int = Query(..., description="子物料ID（子件）")
):
    """检测BOM循环依赖；须注册在 /bom/{bom_uuid} 之前。"""
    try:
        detail = await MaterialService.detect_bom_cycle_detail(
            tenant_id, material_id, component_id
        )
        return {
            "has_cycle": bool(detail.get("has_cycle")),
            "path": detail.get("path") or [],
        }
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/bom/component/{material_id}/where-used",
    summary="BOM where-used (reverse lookup)",
)
async def list_bom_where_used(
    material_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    recursive: bool = Query(False, description="是否递归追溯到顶层成品"),
    include_obsolete: bool = Query(False, description="是否包含已失效版本"),
    top_level_only: bool = Query(False, description="仅返回不再作为子件的顶层父物料"),
):
    """反查使用该物料作为子件的父物料 BOM。"""
    try:
        return await MaterialService.list_bom_where_used(
            tenant_id,
            material_id,
            recursive=recursive,
            include_obsolete=include_obsolete,
            top_level_only=top_level_only,
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/bom/changes/{change_uuid}", summary="Delete BOM change record")
async def delete_bom_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """删除 BOM 工程变更记录（软删除）"""
    try:
        await BOMChangeService.delete_change(tenant_id, change_uuid)
        return {"message": "删除成功"}
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/bom/{bom_uuid}", response_model=BOMResponse, summary="Get BOM")
async def get_bom(
    bom_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取BOM详情
    
    - **bom_uuid**: BOM UUID
    """
    try:
        return await MaterialService.get_bom_by_uuid(tenant_id, str(bom_uuid))
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/bom/{bom_uuid}", response_model=BOMResponse, summary="Update BOM")
async def update_bom(
    bom_uuid: uuid.UUID,
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
        return await MaterialService.update_bom(tenant_id, str(bom_uuid), data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/bom/{bom_uuid}", summary="Delete BOM")
async def delete_bom(
    bom_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除BOM（软删除）
    
    - **bom_uuid**: BOM UUID
    """
    try:
        await MaterialService.delete_bom(tenant_id, str(bom_uuid))
        return {"message": "BOM删除成功"}
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise _http_error(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/{bom_uuid}/approve", response_model=BOMResponse, summary="Approve BOM")
async def approve_bom(
    bom_uuid: uuid.UUID,
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
            bom_uuid=str(bom_uuid),
            approved_by=current_user.id,
            approval_comment=approval_comment,
            approved=approved
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/batch-approve", response_model=List[BOMResponse], summary="Batch approve BOMs")
async def batch_approve_bom(
    request: Request,
    bom_uuids: List[str] = Body(..., description="BOM UUID列表"),
    approved: bool = Body(True, description="是否通过审核"),
    recursive: bool = Body(False, description="是否递归处理子BOM"),
    is_reverse: bool = Body(False, description="是否撤销审核（重置为草稿）"),
    approval_comment: Optional[str] = Body(None, description="审核意见"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    批量审核BOM
    
    - **bom_uuids**: BOM UUID列表
    - **approved**: 是否通过（true=通过，false=拒绝）
    - **approval_comment**: 审核意见（可选）
    - **is_reverse**: 撤销审核时需 revoke 权限
    """
    action = "revoke" if is_reverse else "audit"
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [build_permission_code("master-data", _BOM_MODULE, action)],
        check_abac=True,
    )
    try:
        return await MaterialService.batch_approve_bom(
            tenant_id=tenant_id,
            bom_uuids=bom_uuids,
            approved=approved,
            approval_comment=approval_comment,
            approved_by=current_user.id,
            recursive=recursive,
            is_reverse=is_reverse
        )
    except ConflictError as e:
        raise _http_error(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/{bom_uuid}/copy", response_model=BOMResponse, summary="Copy BOM (new version)")
async def copy_bom(
    bom_uuid: uuid.UUID,
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
            bom_uuid=str(bom_uuid),
            new_version=new_version
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/{bom_uuid}/revise", response_model=BOMResponse, summary="Revise BOM (new revision)")
async def revise_bom(
    bom_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    new_version: Optional[str] = Query(None, description="新修订版本号（可选）"),
    version_remark: Optional[str] = Query(None, description="版本变更备注（可选）")
):
    """
    BOM升版（根据已审核版本创建新的草稿版本）
    
    根据工程变更流程，对已审核的BOM进行修改前应先升版。
    """
    try:
        return await MaterialService.revise_bom(
            tenant_id=tenant_id,
            bom_uuid=str(bom_uuid),
            new_version=new_version,
            version_remark=version_remark
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/material/{material_id}", response_model=List[BOMResponse], summary="List BOMs by header material")
async def get_bom_by_material(
    material_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    version: Optional[str] = Query(None, description="版本号（可选）"),
    only_active: bool = Query(True, description="是否只返回已审核的BOM"),
    include_obsolete: bool = Query(False, description="是否包含已失效的BOM版本")
):
    """
    根据主物料获取BOM列表
    
    - **material_id**: 主物料ID
    - **version**: 版本号（可选）
    - **only_active**: 是否只返回已审核的BOM（默认：true）
    - **include_obsolete**: 是否包含已失效版本（默认：false）
    """
    try:
        return await MaterialService.get_bom_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            version=version,
            only_active=only_active,
            include_obsolete=include_obsolete
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/versions/{bom_code}", response_model=List[BOMResponse], summary="List all BOM versions")
async def get_bom_versions(
    bom_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    include_obsolete: bool = Query(True, description="是否包含已失效版本")
):
    """
    获取指定BOM编码的所有版本
    
    - **bom_code**: BOM编码
    - **include_obsolete**: 是否包含已失效版本（默认：true，便于版本列表展示）
    """
    try:
        return await MaterialService.get_bom_versions(
            tenant_id=tenant_id,
            bom_code=bom_code,
            include_obsolete=include_obsolete
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/bom/material/{material_id}/version/{version}/obsolete",
    summary="Mark BOM version obsolete"
)
async def set_bom_version_obsolete(
    material_id: int,
    version: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    body: Optional[Dict[str, Any]] = Body(None, description="可选：{ \"reason\": \"失效原因\" }"),
):
    """
    将指定物料的指定BOM版本设为失效。
    若该版本为默认版本，会清除默认标记。
    """
    try:
        reason = (body or {}).get("reason") if isinstance(body, dict) else None
        count = await MaterialService.set_bom_version_obsolete(
            tenant_id=tenant_id,
            material_id=material_id,
            version=version,
            reason=reason,
        )
        return {"updated": count, "message": f"已将该 BOM 版本 {version} 设为失效"}
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/batch-import", response_model=List[BOMResponse], summary="Batch import BOMs")
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
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/bom/relation-import/precheck", response_model=BOMRelationImportResponse, summary="Precheck BOM relation import")
async def precheck_bom_relation_import(
    data: BOMRelationImportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """BOM 高级关联导入预检（不写入数据）。"""
    try:
        payload = data.model_copy(update={"dry_run": True})
        return await MaterialService.relation_import_bom(
            tenant_id, payload, current_user=current_user
        )
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/bom/relation-import", response_model=BOMRelationImportResponse, summary="Run BOM relation import")
async def run_bom_relation_import(
    data: BOMRelationImportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """执行 BOM 高级关联导入。"""
    try:
        return await MaterialService.relation_import_bom(
            tenant_id, data, current_user=current_user
        )
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/bom/material/{material_id}/hierarchy", summary="Build BOM hierarchy")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/bom/material/{material_id}/quantity", summary="Calculate BOM quantities with scrap")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/material/{material_id}/version", response_model=List[BOMResponse], summary="Create new BOM version")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bom/material/{material_id}/compare-versions", summary="Compare BOM versions")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/bom/material/{material_id}/version/{version}/items",
    response_model=List[BOMResponse],
    summary="Replace BOM version items atomically",
)
async def replace_bom_version_items(
    material_id: int,
    version: str,
    data: BOMBatchCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """事务内全量替换指定物料+版本的 BOM 明细。"""
    try:
        return await MaterialService.replace_bom_version_items(
            tenant_id, material_id, version, data, current_user=current_user
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/bom/material/{material_id}/print",
    summary="Print engineering BOM",
)
async def print_engineering_bom(
    material_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    version: Optional[str] = Body(None, embed=True, description="BOM 版本（可选）"),
):
    """组装多阶 BOM 并渲染默认打印 HTML。"""
    try:
        return await MaterialService.print_engineering_bom(
            tenant_id, material_id, version=version
        )
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 物料编码映射相关接口 ====================
# 注意：映射路由必须在物料详情路由之前，避免 /mapping 被 /{material_uuid} 匹配

@router.post("/mapping", response_model=MaterialCodeMappingResponse, summary="Create material code mapping")
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
        return await MaterialCodeMappingService.create_mapping(tenant_id, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/mapping", response_model=MaterialCodeMappingListResponse, summary="List material code mappings")
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


@router.get("/mapping/{mapping_uuid}", response_model=MaterialCodeMappingResponse, summary="Get material code mapping")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/mapping/{mapping_uuid}", response_model=MaterialCodeMappingResponse, summary="Update material code mapping")
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
        return await MaterialCodeMappingService.update_mapping(tenant_id, mapping_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/mapping/{mapping_uuid}", summary="Delete material code mapping")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/mapping/convert", response_model=MaterialCodeConvertResponse, summary="Convert material codes")
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


@router.post("/mapping/batch-import", summary="Batch import material code mappings")
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
    return await MaterialCodeMappingService.batch_create_mappings(
        tenant_id, mappings_data, current_user=current_user
    )


# ==================== 物料批号相关接口 ====================
# 注意：批号路由必须在物料详情路由之前，避免 /batches 被 /{material_uuid} 匹配

@router.post("/batches", response_model=MaterialBatchResponse, summary="Create material batch")
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
        return await MaterialBatchService.create_batch(tenant_id, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batches", response_model=MaterialBatchListResponse, summary="List material batches")
async def list_material_batches(
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选条件）"),
    batch_no: Optional[str] = Query(None, description="批号（模糊搜索）"),
    batch_status: Optional[str] = Query(None, alias="status", description="状态（筛选条件）"),
    keyword: Optional[str] = Query(None, description="综合模糊：批号、供应商批号、物料名称"),
    sort_by: Optional[str] = Query(
        None,
        description="排序字段：batch_no,quantity,status,production_date,expiry_date,created_at,material_name",
    ),
    sort_order: Optional[str] = Query(None, description="asc 或 desc，默认 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
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
            page_size=page_size,
            keyword=keyword,
            sort_by=sort_by,
            sort_order=sort_order,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
        )
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取批号列表失败: {str(e)}"
        )


@router.get("/batches/{batch_uuid}", response_model=MaterialBatchResponse, summary="Get material batch")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/batches/{batch_uuid}", response_model=MaterialBatchResponse, summary="Update material batch")
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
        return await MaterialBatchService.update_batch(tenant_id, batch_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/batches/{batch_uuid}", summary="Delete material batch")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/batches/generate", summary="Generate batch numbers")
async def generate_batch_no(
    payload: GenerateBatchNoRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    生成批号

    优先使用：rule_id/rule_uuid > 物料默认批号规则 > 系统默认(YYYYMMDD-序号)

    请求体使用 JSON（含 preview / preview_offset），避免仅依赖 Query 时 preview 在部分环境下丢失导致误占用流水号。
    入库单「确认预览」等场景请传 preview=true；保存入库时 preview=false 正式占用。
    """
    try:
        batch_no = await MaterialBatchService.generate_batch_no(
            tenant_id,
            payload.material_uuid,
            rule_id=payload.rule_id,
            rule_uuid=payload.rule_uuid,
            supplier_code=payload.supplier_code,
            preview=payload.preview,
            preview_offset=payload.preview_offset,
        )
        return {"batch_no": batch_no}
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batches/{batch_uuid}/trace", summary="Trace material batch")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 物料序列号相关接口 ====================
# 注意：序列号路由必须在物料详情路由之前，避免 /serials 被 /{material_uuid} 匹配

@router.post("/serials", response_model=MaterialSerialResponse, summary="Create material serial")
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
        return await MaterialSerialService.create_serial(tenant_id, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/serials", response_model=MaterialSerialListResponse, summary="List material serials")
async def list_material_serials(
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选条件）"),
    serial_no: Optional[str] = Query(None, description="序列号（模糊搜索）"),
    serial_status: Optional[str] = Query(None, alias="status", description="状态（筛选条件）"),
    keyword: Optional[str] = Query(None, description="综合模糊：序列号、供应商序列号、物料名称"),
    sort_by: Optional[str] = Query(
        None,
        description="排序字段：serial_no,status,production_date,factory_date,created_at,material_name",
    ),
    sort_order: Optional[str] = Query(None, description="asc 或 desc，默认 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
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
            page_size=page_size,
            keyword=keyword,
            sort_by=sort_by,
            sort_order=sort_order,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
        )
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取序列号列表失败: {str(e)}"
        )


@router.get("/serials/{serial_uuid}", response_model=MaterialSerialResponse, summary="Get material serial")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/serials/{serial_uuid}", response_model=MaterialSerialResponse, summary="Update material serial")
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
        return await MaterialSerialService.update_serial(tenant_id, serial_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/serials/{serial_uuid}", summary="Delete material serial")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/serials/generate", summary="Generate serial numbers (batch)")
async def generate_serial_nos(
    material_uuid: str = Query(..., description="物料UUID"),
    count: int = Query(1, ge=1, le=1000, description="生成数量"),
    rule_id: Optional[int] = Query(None, description="序列号规则ID（可选，优先于物料默认规则）"),
    rule_uuid: Optional[str] = Query(None, description="序列号规则UUID（可选）"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    生成序列号（批量生成）

    优先使用：rule_id/rule_uuid > 物料默认序列号规则 > 系统默认
    """
    try:
        serial_nos = await MaterialSerialService.generate_serial_no(
            tenant_id, material_uuid, count,
            rule_id=rule_id, rule_uuid=rule_uuid
        )
        return {"serial_nos": serial_nos, "count": len(serial_nos)}
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/serials/{serial_uuid}/trace", summary="Trace material serial")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 物料相关接口 ====================
# 注意：物料详情路由必须在 BOM 路由之后，避免 /bom 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在映射路由之后，避免 /mapping 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在批号路由之后，避免 /batches 被 /{material_uuid} 匹配
# 注意：物料详情路由必须在序列号路由之后，避免 /serials 被 /{material_uuid} 匹配

@router.post("", response_model=MaterialResponse, summary="Create material")
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
    - **variant_managed**: 是否启用属性管理（默认：false）
    - **variant_attributes**: 属性（可选，JSON格式）
    - **description**: 描述（可选）
    - **brand**: 品牌（可选）
    - **model**: 型号（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await MaterialService.create_material(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=MaterialListResponse, summary="List materials")
async def list_materials(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=2000, description="限制数量"),
    group_id: Optional[int] = Query(None, alias="groupId", description="物料分组ID（过滤）"),
    no_group: Optional[bool] = Query(None, alias="noGroup", description="仅查询未设置分组的物料"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（物料编码、名称或规格）"),
    code: Optional[str] = Query(None, description="物料编码（精确匹配）"),
    name: Optional[str] = Query(None, description="物料名称（模糊匹配）"),
    source_type: Optional[str] = Query(None, alias="sourceType", description="物料来源类型（过滤）"),
    specification: Optional[str] = Query(None, description="规格（模糊匹配）"),
    brand: Optional[str] = Query(None, description="品牌（模糊匹配）"),
    model: Optional[str] = Query(None, description="型号（模糊匹配）"),
    base_unit: Optional[str] = Query(None, alias="baseUnit", description="基础单位（精确匹配）"),
    ids: Optional[List[int]] = Query(None, description="物料主键ID列表（精确匹配，用于按引用补齐）"),
    sort_by: Optional[str] = Query(
        None,
        alias="sortBy",
        description="排序字段：main_code,name,created_at,updated_at（默认 main_code 升序）",
    ),
    sort_order: Optional[str] = Query(
        None,
        alias="sortOrder",
        description="asc 或 desc；未传时 main_code 为 asc，其余字段默认 desc",
    ),
    tree_view: Optional[bool] = Query(
        False,
        alias="treeView",
        description="树形列表：主物料为父行，属性 SKU 为 children；分页按主行计数",
    ),
    masters_only: Optional[bool] = Query(
        False,
        alias="mastersOnly",
        description="仅返回主物料行（排除属性 SKU，code≠main_code 的行）",
    ),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取物料列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：2000）
    - **group_id**: 物料分组ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（物料编码、名称或规格）
    - **code**: 物料编码（精确匹配）
    - **name**: 物料名称（模糊匹配）
    - **source_type**: 物料来源类型（可选，用于过滤）
    - **specification**: 规格（可选，模糊匹配）
    - **brand**: 品牌（可选，模糊匹配）
    - **model**: 型号（可选，模糊匹配）
    - **base_unit**: 基础单位（可选，精确匹配）
    - **ids**: 物料主键ID列表（可选，精确匹配）
    """
    effective_limit = limit
    if ids:
        # 按 ID 精确查询时，默认一次返回全部命中行（仍受 le=2000 约束）
        effective_limit = min(2000, max(limit, len(ids)))
    return await MaterialService.list_materials(
        tenant_id,
        skip,
        effective_limit,
        group_id,
        is_active,
        keyword,
        code,
        name,
        source_type,
        specification,
        brand,
        model,
        base_unit,
        sort_by,
        sort_order,
        no_group,
        tree_view,
        masters_only,
        created_start_date,
        created_end_date,
        updated_start_date,
        updated_end_date,
        ids,
    )


@router.post(
    "/batch-tracking",
    response_model=MaterialBulkTrackingResponse,
    summary="Bulk update batch/serial tracking",
)
async def bulk_update_material_tracking(
    data: MaterialBulkTrackingRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量开启或关闭批号/序列号管理，并可指定默认批号规则、默认序列号规则（单次数据库更新，非 N 次单条接口）。

    - **batch_managed** / **serial_managed**：传 `true` 为开启，`false` 为关闭；未传则不改该项。
    - 关闭时自动清空对应的默认规则外键。
    """
    try:
        return await MaterialService.bulk_update_material_tracking(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-variant",
    response_model=MaterialBulkTrackingResponse,
    summary="Bulk update material variant management",
)
async def bulk_update_material_variant(
    data: MaterialBulkVariantRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量开启/关闭属性管理（单次 SQL UPDATE；不批量写入属性值）。
    """
    try:
        return await MaterialService.bulk_update_material_variant(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/materialize-variant",
    response_model=MaterialMaterializeVariantResponse,
    summary="Materialize variant combo to SKU row",
)
async def materialize_variant_combo(
    data: MaterialMaterializeVariantRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    将临时属性组合物化为属性 SKU 行：先查找已有组合，不存在则创建。
    """
    try:
        return await MaterialService.materialize_variant_combo(tenant_id, data)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-create",
    response_model=MaterialBulkCreateResponse,
    response_model_by_alias=True,
    summary="Batch create materials",
)
async def bulk_create_materials(
    data: MaterialBulkCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量创建物料（Excel 导入分片）。

    - 单次最多 200 条，避免网关 30s 超时；前端按分片循环调用。
    - 单条失败不回滚已成功行，失败原因见 failedItems。
    """
    try:
        return await MaterialService.bulk_create_materials(
            tenant_id, data, current_user=current_user
        )
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-delete",
    response_model=MaterialBatchDeleteResponse,
    summary="Batch delete materials",
)
async def bulk_delete_materials(
    data: MaterialBatchDeleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量软删除物料（单次请求内完成校验与更新，避免逐条调用删除接口）。

    - 不存在或已删除的 UUID 计入 **failed_items**（原因：物料不存在）。
    - 仍被 BOM 引用（父件或子件）的物料无法删除，计入 **failed_items**。
    """
    return await MaterialService.bulk_delete_materials(tenant_id, data)


@router.post(
    "/batch-move-group",
    response_model=MaterialBatchMoveGroupResponse,
    summary="Batch move materials to group",
)
async def bulk_move_materials_group(
    data: MaterialBatchMoveGroupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量将物料移动到指定物料分组（单次 SQL UPDATE）。
    """
    try:
        return await MaterialService.bulk_move_material_group(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-process-route",
    response_model=MaterialBatchFieldUpdateResponse,
    summary="Batch update material process route",
)
async def bulk_update_material_process_route(
    data: MaterialBatchUpdateProcessRouteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量更新物料绑定的工艺路线（单次 SQL UPDATE）。
    """
    try:
        return await MaterialService.bulk_update_material_process_route(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-source-type",
    response_model=MaterialBatchFieldUpdateResponse,
    summary="Batch update material source type",
)
async def bulk_update_material_source_type(
    data: MaterialBatchUpdateSourceTypeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量更新物料来源类型（单次 SQL UPDATE）。
    """
    try:
        return await MaterialService.bulk_update_material_source_type(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-defaults",
    response_model=MaterialBatchFieldUpdateResponse,
    summary="Bulk patch material defaults JSON fields",
)
async def bulk_patch_material_defaults(
    data: MaterialBulkDefaultsPatchRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量合并更新物料 defaults（税率、默认仓库、安全库存等）。

    仅更新请求体中显式传入的字段，其余 defaults 键保持不变。
    defaultWarehouseIds 传空数组表示清除默认仓库。
    """
    try:
        return await MaterialService.bulk_patch_material_defaults(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch-inspection",
    response_model=MaterialBulkInspectionPatchResponse,
    summary="Bulk patch material inspection stages and over-report",
)
async def bulk_patch_material_inspection(
    data: MaterialBulkInspectionPatchRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量更新物料质检选项（IQC/FQC/OQC 分场景策略、超报方式/数值）。

    每条仅覆盖传入的场景；未传场景保持原值。方案须与场景类型匹配
    （iqc→incoming，fqc→finished，oqc→outbound）。
    """
    try:
        return await MaterialService.bulk_patch_material_inspection(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/check-duplicates",
    response_model=MaterialDedupCheckResponse,
    response_model_by_alias=True,
    summary="Material dedup check (exact match on configured fields)",
)
async def check_material_duplicates(
    data: MaterialDedupCheckRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    物料防重助手：按所选字段（含自定义字段）做精确一致比对，返回已存在物料。
    """
    try:
        return await MaterialDedupService.check_exact_duplicates(
            tenant_id=tenant_id,
            match_fields=data.match_fields,
            values=data.values,
            exclude_uuid=data.exclude_uuid,
            masters_only=data.masters_only,
        )
    except Exception as e:
        logger.exception("material dedup check failed")
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"防重检查失败: {str(e)}",
            tenant_id=tenant_id,
        )


@router.post(
    "/health-check",
    response_model=MaterialHealthCheckResponse,
    response_model_by_alias=True,
    summary="Material health check (completeness & duplicate codes)",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def material_health_check(
    data: MaterialHealthCheckRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    物料健康助手：检查基本信息完备度/合理性，以及疑似一物多码、多物一码、相似重复。
    """
    try:
        return await MaterialHealthService.run_health_check(
            tenant_id=tenant_id,
            group_id=data.group_id,
            masters_only=data.masters_only,
        )
    except Exception as e:
        logger.exception("material health check failed")
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"健康检查失败: {str(e)}",
            tenant_id=tenant_id,
        )


@router.post(
    "/rewrite-main-codes",
    response_model=MaterialRewriteMainCodesResponse,
    summary="Rewrite material main codes (trial run only)",
)
async def rewrite_material_main_codes(
    data: MaterialRewriteMainCodesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    试运营模式专属：按各物料所属分组的**分组编号**（group.code）及编码规则重新生成主编码。

    - 试运营关闭时返回 400。
    - 可传 **material_uuids**（选中物料）或 **groupId**（当前分组及子分组下全部物料）。
    - 同一主编码族（主物料 + 属性变体）一并更新。
    """
    try:
        return await MaterialService.bulk_rewrite_main_codes(tenant_id, data)
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


class LoadStandardPartsPresetRequest(BaseModel):
    """导入标准件预设：分组策略 + 勾选条目 + 主编码策略。"""

    model_config = ConfigDict(populate_by_name=True)

    preset_keys: List[str] = Field(
        default_factory=list,
        alias="presetKeys",
        description="标准件 presetKey 列表，与 preset-preview 中 items[].presetKey 一致",
    )
    code_mode: str = Field(
        "auto",
        alias="codeMode",
        description="auto=按组织物料编码规则生成主编码；gb=使用目录中的国标推荐编号作为主编码",
    )
    group_mode: str = Field(
        "single",
        alias="groupMode",
        description="single=全部导入到 materialGroupUuid；preset_by_category=按预设库二级分类各建/复用分组后导入",
    )
    material_group_uuid: Optional[str] = Field(
        None,
        alias="materialGroupUuid",
        description="指定分组模式必填：目标物料分组 UUID",
    )
    parent_material_group_uuid: Optional[str] = Field(
        None,
        alias="parentMaterialGroupUuid",
        description="按预设分类建分组时可选：新建分类分组的父级 UUID；不填则建在顶级",
    )

    @model_validator(mode="after")
    def _validate_group_mode(self) -> "LoadStandardPartsPresetRequest":
        gm = (self.group_mode or "single").strip().lower()
        if gm not in ("single", "preset_by_category"):
            raise ValueError("groupMode 须为 single 或 preset_by_category")
        object.__setattr__(self, "group_mode", gm)
        if gm == "single":
            if not (self.material_group_uuid or "").strip():
                raise ValueError("指定分组模式下须填写 materialGroupUuid")
        return self


@router.get("/standard-parts/preset-preview", summary="List standard-part preset catalog")
async def get_standard_parts_preset_preview(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """标准件预设功能当前阶段已停用。"""
    raise _http_error(
        status_code=status.HTTP_410_GONE,
        detail="标准件预设功能已停用，当前阶段不再提供预览接口。",
        tenant_id=tenant_id,
    )


@router.post("/standard-parts/load-preset", summary="Import selected standard-part materials")
async def load_standard_parts_preset(
    body: LoadStandardPartsPresetRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """标准件预设功能当前阶段已停用。"""
    raise _http_error(
        status_code=status.HTTP_410_GONE,
        detail="标准件预设功能已停用，当前阶段不再提供加载接口。",
        tenant_id=tenant_id,
    )


@router.get("/{material_uuid}", response_model=MaterialResponse, summary="Get material")
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
        result = await MaterialService.get_material_by_uuid(tenant_id, material_uuid)
        return result
    except NotFoundError as e:
        raise _http_error(status.HTTP_404_NOT_FOUND, str(e), tenant_id=tenant_id)


@router.get(
    "/{material_uuid}/variants",
    response_model=List[MaterialResponse],
    summary="List variant SKU rows for master material",
)
async def list_material_variants(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """获取主物料下所有属性 SKU 行（预组合）。"""
    try:
        return await MaterialService.get_material_variants(
            tenant_id=tenant_id,
            master_material_uuid=material_uuid,
        )
    except NotFoundError as e:
        raise _http_error(status.HTTP_404_NOT_FOUND, str(e), tenant_id=tenant_id)
    except ValidationError as e:
        raise _http_error(status.HTTP_400_BAD_REQUEST, str(e), tenant_id=tenant_id)


@router.post(
    "/{material_uuid}/generate-variants",
    response_model=MaterialGenerateVariantsResponse,
    summary="Generate variant SKUs from enum attribute Cartesian product",
)
async def generate_material_variants(
    material_uuid: str,
    data: MaterialGenerateVariantsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """按枚举属性笛卡尔积批量生成属性 SKU 行（提前组合）。"""
    try:
        return await MaterialService.generate_variant_skus(tenant_id, material_uuid, data)
    except NotFoundError as e:
        raise _http_error(status.HTTP_404_NOT_FOUND, str(e), tenant_id=tenant_id)
    except ValidationError as e:
        raise _http_error(status.HTTP_400_BAD_REQUEST, str(e), tenant_id=tenant_id)


@router.put("/{material_uuid}", response_model=MaterialResponse, summary="Update material")
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
    - **variant_managed**: 是否启用属性管理（可选）
    - **variant_attributes**: 属性（可选，JSON格式）
    - **description**: 描述（可选）
    - **brand**: 品牌（可选）
    - **model**: 型号（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        result = await MaterialService.update_material(
            tenant_id,
            material_uuid,
            data,
            updated_by=current_user.id,
            current_user=current_user,
        )
        return result
    except NotFoundError as e:
        raise _http_error(status.HTTP_404_NOT_FOUND, str(e), tenant_id=tenant_id)
    except ValidationError as e:
        raise _http_error(status.HTTP_400_BAD_REQUEST, str(e), tenant_id=tenant_id)


@router.delete("/{material_uuid}", summary="Delete material")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 物料来源控制相关接口 ====================

@router.get("/{material_uuid}/source/validate", summary="Validate material source config")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证失败: {str(e)}"
        )


@router.post("/{material_uuid}/source/validate-batch", summary="Batch validate material source config")
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
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量验证失败: {str(e)}"
        )


@router.get("/{material_uuid}/source/change-impact", summary="Check impact of material source type change")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查变更影响失败: {str(e)}"
        )


@router.put("/{material_uuid}/source/change", response_model=MaterialResponse, summary="Change material source type")
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
            current_user=current_user,
        )
        return await MaterialService.get_material_by_uuid(tenant_id, material.uuid)
    except NotFoundError as e:
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise _http_error(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"变更失败: {str(e)}"
        )


@router.get("/{material_uuid}/source/check-completeness", summary="Check material source config completeness")
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
        raise _http_error(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise _http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查失败: {str(e)}"
        )

