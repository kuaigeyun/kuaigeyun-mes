"""
工艺数据 API 模块

提供工艺数据的 RESTful API 接口（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status, Body
from typing import Any, List, Optional, Annotated
from pydantic import BaseModel, Field, ConfigDict
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from apps.master_data.api._master_data_route_access import require_master_data_module_access
from infra.models.user import User
from apps.master_data.services.process_service import ProcessService
from apps.master_data.services.process_route_change_service import ProcessRouteChangeService
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse, DefectTypeListResponse,
    OperationCreate, OperationUpdate, OperationResponse, OperationListResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse, ProcessRouteListResponse,
    ProcessRouteTreeResponse,
    ProcessRouteVersionCreate, ProcessRouteVersionCompare, ProcessRouteVersionCompareResult,
    ProcessRouteTemplateCreate, ProcessRouteTemplateUpdate, ProcessRouteTemplateResponse,
    ProcessRouteTemplateVersionCreate, ProcessRouteFromTemplateCreate,
    SOPCreate, SOPUpdate, SOPResponse, SOPListResponse, SOPBatchCreateFromRouteRequest
)
from apps.master_data.schemas.process_route_change_schemas import (
    ProcessRouteChangeCreate, ProcessRouteChangeUpdate, ProcessRouteChangeResponse,
    ProcessRouteChangeListResponse,
)
from apps.master_data.schemas.material_product_process_schemas import (
    MaterialProductProcessResponse,
    MaterialProductProcessSave,
    ProcessRouteOperationTemplateResponse,
)
from apps.master_data.services.material_product_process_service import MaterialProductProcessService
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/process",
    tags=["App · Master Data · Process"],
    dependencies=[Depends(require_master_data_module_access("process"))],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/process",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_process_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


# ==================== 不良品相关接口 ====================

@router.post("/defect-types", response_model=DefectTypeResponse, summary="Create defect type")
async def create_defect_type(
    data: DefectTypeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建不良品
    
    - **code**: 不良品编码（必填，组织内唯一）
    - **name**: 不良品名称（必填）
    - **category**: 分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await ProcessService.create_defect_type(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/defect-types", response_model=DefectTypeListResponse, summary="List defect types")
async def list_defect_types(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="分类（过滤）"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="模糊匹配编号、名称、描述"),
    code: Optional[str] = Query(None, description="编号（模糊）"),
    name: Optional[str] = Query(None, description="名称（模糊）"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段：code,name,category,created_at,updated_at,is_active"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取不良品列表（分页，返回 data 与 total）
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    items, total = await ProcessService.list_defect_types(
        tenant_id,
        skip,
        limit,
        category,
        is_active,
        keyword=keyword,
        code=code,
        name=name,
        sort_by=sort_by,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return DefectTypeListResponse(data=items, total=total)


class BatchResolveOrCreateDefectTypesRequest(BaseModel):
    """批量解析或创建不良品项请求"""
    items: List[str] = Field(..., description="不良品编码或名称列表，支持混合；已存在则使用，不存在则创建（编码按规则自动）")


@router.post("/defect-types/batch-resolve-or-create", summary="Batch resolve or create defect types")
async def batch_resolve_or_create_defect_types(
    data: BatchResolveOrCreateDefectTypesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量解析或创建不良品项。用于工序导入等场景：
    - 已存在（按编码或名称匹配）：直接返回 uuid
    - 不存在：创建新不良品项，编码根据编码规则自动生成
    """
    try:
        result = await ProcessService.batch_resolve_or_create_defect_types(
            tenant_id, data.items, current_user=current_user
        )
        return {"results": result}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


_DEFECT_PRESET_DEPRECATED_DETAIL = (
    "不良品独立预设已移除：请在「工序管理」中选择行业并加载工序预设，"
    "系统会按编码规则创建工序并创建/复用不良品项且自动绑定。"
)


@router.get("/defect-types/preset-preview", summary="[Deprecated] Preview defect type preset")
async def get_defect_type_preset_preview(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """本接口已废弃，不再返回预设列表。"""
    raise FastAPIHTTPException(
        status_code=status.HTTP_410_GONE,
        detail=_DEFECT_PRESET_DEPRECATED_DETAIL,
    )


@router.post("/defect-types/load-preset", summary="[Deprecated] Load defect type preset")
async def load_preset_defect_types(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """本接口已废弃，不再创建不良品预设数据。"""
    raise FastAPIHTTPException(
        status_code=status.HTTP_410_GONE,
        detail=_DEFECT_PRESET_DEPRECATED_DETAIL,
    )


@router.get("/defect-types/{defect_type_uuid}", response_model=DefectTypeResponse, summary="Get defect type")
async def get_defect_type(
    defect_type_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取不良品详情
    
    - **defect_type_uuid**: 不良品UUID
    """
    try:
        return await ProcessService.get_defect_type_by_uuid(tenant_id, defect_type_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/defect-types/{defect_type_uuid}", response_model=DefectTypeResponse, summary="Update defect type")
async def update_defect_type(
    defect_type_uuid: str,
    data: DefectTypeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新不良品
    
    - **defect_type_uuid**: 不良品UUID
    - **code**: 不良品编码（可选）
    - **name**: 不良品名称（可选）
    - **category**: 分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await ProcessService.update_defect_type(
            tenant_id, defect_type_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/defect-types/{defect_type_uuid}", summary="Delete defect type")
async def delete_defect_type(
    defect_type_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除不良品（软删除）
    
    - **defect_type_uuid**: 不良品UUID
    """
    try:
        await ProcessService.delete_defect_type(tenant_id, defect_type_uuid)
        return {"message": "不良品删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 工序相关接口 ====================

@router.post("/operations", response_model=OperationResponse, summary="Create operation")
async def create_operation(
    data: OperationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工序
    
    - **code**: 工序编码（必填，组织内唯一）
    - **name**: 工序名称（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await ProcessService.create_operation(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/operations", response_model=OperationListResponse, summary="List operations")
async def list_operations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="模糊匹配编号、名称、描述"),
    code: Optional[str] = Query(None, description="编号（模糊）"),
    name: Optional[str] = Query(None, description="名称（模糊）"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段：code,name,created_at,updated_at,is_active,reporting_type"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取工序列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    try:
        items, total = await ProcessService.list_operations(
            tenant_id,
            skip,
            limit,
            is_active,
            keyword=keyword,
            code=code,
            name=name,
            sort_by=sort_by,
            sort_order=sort_order,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        return OperationListResponse(data=items, total=total)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取工序列表失败: {str(e)}",
        )


class LoadOperationPresetRequest(BaseModel):
    """按行业加载所选工序预设（工序与不良编码由编码规则生成）。"""

    model_config = ConfigDict(populate_by_name=True)

    industry_id: str = Field(..., alias="industryId", description="行业 id，与 preset-preview 中 industries[].id 一致")
    preset_keys: List[str] = Field(
        default_factory=list,
        alias="presetKeys",
        description="所选工序 presetKey 列表，与 preset-preview 中 operations[].presetKey 一致；空列表不创建",
    )


@router.get("/operations/preset-preview", summary="List operation industry preset catalog")
async def get_operation_preset_preview(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """返回行业树及每行业下的工序预设与附带不良名称预览（不含业务 code）。"""
    return ProcessService.get_operation_preset_catalog()


@router.post("/operations/load-preset", summary="Load operation presets by industry")
async def load_preset_operations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    body: LoadOperationPresetRequest,
):
    """
    按所选行业与 presetKey 批量创建工序（OPERATION_CODE）、不良品项（DEFECT_TYPE_CODE 或按名称复用），
    并写入工序-不良关联。同名未删除工序会跳过。
    """
    try:
        result = await ProcessService.load_preset_operations_by_industry(
            tenant_id,
            body.industry_id,
            body.preset_keys,
            current_user=current_user,
        )
        return {
            "createdOperations": result["created_operations"],
            "skippedOperations": result["skipped_operations"],
            "createdDefectTypes": result["created_defect_types"],
            "reusedDefectTypes": result["reused_defect_types"],
            "linkedPairs": result["linked_pairs"],
            "message": result["message"],
        }
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/operations/{operation_uuid}", response_model=OperationResponse, summary="Get operation")
async def get_operation(
    operation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取工序详情
    
    - **operation_uuid**: 工序UUID
    """
    try:
        return await ProcessService.get_operation_by_uuid(tenant_id, operation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/operations/{operation_uuid}", response_model=OperationResponse, summary="Update operation")
async def update_operation(
    operation_uuid: str,
    data: OperationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新工序
    
    - **operation_uuid**: 工序UUID
    - **code**: 工序编码（可选）
    - **name**: 工序名称（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await ProcessService.update_operation(
            tenant_id, operation_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/operations/{operation_uuid}", summary="Delete operation")
async def delete_operation(
    operation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工序（软删除）
    
    - **operation_uuid**: 工序UUID
    
    注意：删除工序前需要检查是否被SOP使用
    """
    try:
        await ProcessService.delete_operation(tenant_id, operation_uuid)
        return {"message": "工序删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工艺路线相关接口 ====================

@router.post("/routes", response_model=ProcessRouteResponse, summary="Create process route")
async def create_process_route(
    data: ProcessRouteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工艺路线

    - **code**: 工艺路线编码（必填，组织内唯一）
    - **name**: 工艺路线名称（必填）
    - **description**: 描述（可选）
    - **operation_sequence**: 工序序列（可选，JSON格式）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await ProcessService.create_process_route(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes", response_model=ProcessRouteListResponse, summary="List process routes")
async def list_process_routes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="模糊匹配编号、名称、描述"),
    code: Optional[str] = Query(None, description="编号（模糊）"),
    name: Optional[str] = Query(None, description="名称（模糊）"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段：code,name,created_at,updated_at,is_active"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取工艺路线列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    items, total = await ProcessService.list_process_routes(
        tenant_id,
        skip,
        limit,
        is_active,
        keyword=keyword,
        code=code,
        name=name,
        sort_by=sort_by,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ProcessRouteListResponse(data=items, total=total)


# ==================== 工艺路线变更管理相关接口 ====================
# 列表使用 /route-change-records，避免 GET /routes/changes 与 /routes/{process_route_uuid} 冲突

@router.get("/route-change-records", response_model=ProcessRouteChangeListResponse, summary="List process route change records")
async def list_route_change_records(
    process_route_uuid: Optional[str] = Query(None, description="工艺路线UUID（筛选条件）"),
    change_type: Optional[str] = Query(None, description="变更类型（筛选条件）"),
    status: Optional[str] = Query(None, description="变更状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """获取工艺路线变更记录列表（推荐路径，不与 /routes/{process_route_uuid} 冲突）"""
    try:
        return await ProcessRouteChangeService.list_changes(
            tenant_id=tenant_id,
            process_route_uuid=process_route_uuid,
            change_type=change_type,
            status=status,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取变更记录列表失败: {str(e)}",
        )


@router.post("/routes/changes", response_model=ProcessRouteChangeResponse, summary="Create process route change record")
async def create_process_route_change(
    data: ProcessRouteChangeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工艺路线变更记录
    
    - **process_route_uuid**: 工艺路线UUID（必填）
    - **change_type**: 变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）
    - **change_content**: 变更内容（JSON格式，可选）
    - **change_reason**: 变更原因（可选）
    - **change_impact**: 变更影响分析（JSON格式，可选）
    - **status**: 变更状态（默认：pending）
    - **approval_comment**: 审批意见（可选）
    """
    try:
        return await ProcessRouteChangeService.create_change(tenant_id, data, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes/changes", response_model=ProcessRouteChangeListResponse, summary="List process route change records")
async def list_process_route_changes(
    process_route_uuid: Optional[str] = Query(None, description="工艺路线UUID（筛选条件）"),
    change_type: Optional[str] = Query(None, description="变更类型（筛选条件）"),
    status: Optional[str] = Query(None, description="变更状态（筛选条件）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    获取工艺路线变更记录列表
    
    支持按工艺路线、变更类型、状态筛选和搜索。
    """
    try:
        return await ProcessRouteChangeService.list_changes(
            tenant_id=tenant_id,
            process_route_uuid=process_route_uuid,
            change_type=change_type,
            status=status,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取变更记录列表失败: {str(e)}"
        )


@router.get("/routes/changes/{change_uuid}", response_model=ProcessRouteChangeResponse, summary="Get process route change record")
async def get_process_route_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工艺路线变更记录详情
    """
    try:
        return await ProcessRouteChangeService.get_change_by_uuid(tenant_id, change_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/routes/changes/{change_uuid}", response_model=ProcessRouteChangeResponse, summary="Update process route change record")
async def update_process_route_change(
    change_uuid: str,
    data: ProcessRouteChangeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新工艺路线变更记录
    """
    try:
        return await ProcessRouteChangeService.update_change(
            tenant_id, change_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/routes/changes/{change_uuid}/approve", response_model=ProcessRouteChangeResponse, summary="Approve process route change record")
async def approve_process_route_change(
    change_uuid: str,
    approved: bool = Query(..., description="是否同意（true:同意, false:拒绝）"),
    approval_comment: Optional[str] = Query(None, description="审批意见（可选）"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None
):
    """
    审批工艺路线变更记录
    
    - **change_uuid**: 变更记录UUID
    - **approved**: 是否同意（true:同意, false:拒绝）
    - **approval_comment**: 审批意见（可选）
    """
    try:
        return await ProcessRouteChangeService.approve_change(
            tenant_id, change_uuid, current_user.id, approved, approval_comment
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/routes/changes/{change_uuid}/execute", response_model=ProcessRouteChangeResponse, summary="Execute process route change record")
async def execute_process_route_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    执行工艺路线变更记录
    
    将已审批的变更记录应用到工艺路线，创建新版本。
    """
    try:
        return await ProcessRouteChangeService.execute_change(tenant_id, change_uuid, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/routes/changes/{change_uuid}", summary="Delete process route change record")
async def delete_process_route_change(
    change_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工艺路线变更记录（软删除）
    """
    try:
        await ProcessRouteChangeService.delete_change(tenant_id, change_uuid)
        return {"message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/routes/{process_route_uuid}/operation-template",
    response_model=ProcessRouteOperationTemplateResponse,
    summary="Get process route operation template for product process import",
)
async def get_process_route_operation_template(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """解析工艺路线工序模板（服务端展开工序主数据，仅需 route:read）。"""
    try:
        allow_jump, lines = await MaterialProductProcessService.get_template_lines_for_route_uuid(
            tenant_id,
            str(process_route_uuid),
        )
        return ProcessRouteOperationTemplateResponse(
            allow_operation_jump=allow_jump,
            lines=lines,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/routes/{process_route_uuid}", response_model=ProcessRouteResponse, summary="Get process route")
async def get_process_route(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取工艺路线详情
    
    - **process_route_uuid**: 工艺路线UUID
    """
    try:
        return await ProcessService.get_process_route_by_uuid(tenant_id, str(process_route_uuid))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/routes/{process_route_uuid}", response_model=ProcessRouteResponse, summary="Update process route")
async def update_process_route(
    process_route_uuid: uuid.UUID,
    data: ProcessRouteUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新工艺路线

    - **process_route_uuid**: 工艺路线UUID
    - **code**: 工艺路线编码（可选）
    - **name**: 工艺路线名称（可选）
    - **description**: 描述（可选）
    - **operation_sequence**: 工序序列（可选，JSON格式）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await ProcessService.update_process_route(
            tenant_id, str(process_route_uuid), data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/routes/{process_route_uuid}", summary="Delete process route")
async def delete_process_route(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工艺路线（软删除）
    
    - **process_route_uuid**: 工艺路线UUID
    """
    try:
        await ProcessService.delete_process_route(tenant_id, str(process_route_uuid))
        return {"message": "工艺路线删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 工艺路线版本管理相关接口 ====================

@router.post("/routes/{process_route_code}/version", response_model=ProcessRouteResponse, summary="Create new process route version")
async def create_process_route_version(
    process_route_code: str,
    data: ProcessRouteVersionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工艺路线新版本
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **process_route_code**: 工艺路线编码
    - **version**: 版本号（如：v1.1）
    - **version_description**: 版本说明（可选）
    - **effective_date**: 生效日期（可选，默认为当前日期）
    - **apply_strategy**: 版本应用策略（new_only：仅新工单使用新版本，推荐；all：所有工单使用新版本，谨慎使用）
    
    系统会自动复制当前最新版本创建新版本。
    """
    try:
        return await ProcessService.create_process_route_version(
            tenant_id, process_route_code, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes/{process_route_code}/versions", response_model=List[ProcessRouteResponse], summary="List all process route versions")
async def get_process_route_versions(
    process_route_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工艺路线的所有版本
    
    - **process_route_code**: 工艺路线编码
    
    返回该工艺路线的所有版本列表（按版本号降序排列）。
    """
    try:
        return await ProcessService.get_process_route_versions(tenant_id, process_route_code)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/routes/{process_route_code}/compare-versions", response_model=ProcessRouteVersionCompareResult, summary="Compare process route versions")
async def compare_process_route_versions(
    process_route_code: str,
    data: ProcessRouteVersionCompare,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    对比工艺路线版本
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **process_route_code**: 工艺路线编码
    - **version1**: 版本1（如：v1.0）
    - **version2**: 版本2（如：v1.1）
    
    返回两个版本之间的差异，包括：
    - 新增工序
    - 删除工序
    - 修改工序（包含变化详情）
    - 工序顺序变化
    """
    try:
        return await ProcessService.compare_process_route_versions(tenant_id, process_route_code, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/routes/{process_route_code}/rollback-version", response_model=ProcessRouteResponse, summary="Roll back process route to version")
async def rollback_process_route_version(
    process_route_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    target_version: str = Query(..., description="目标版本（要回退到的版本）"),
    new_version: Optional[str] = Query(None, description="新版本号（可选，如果不提供则自动生成）")
):
    """
    回退工艺路线到指定版本
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **process_route_code**: 工艺路线编码
    - **target_version**: 目标版本（要回退到的版本，如：v1.0）
    - **new_version**: 新版本号（可选，如果不提供则自动生成，如：v1.2）
    
    系统会创建新版本，内容与目标版本相同，保留历史记录。
    """
    try:
        return await ProcessService.rollback_process_route_version(
            tenant_id, process_route_code, target_version, new_version
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工艺路线绑定管理相关接口 ====================

@router.post("/routes/{process_route_uuid}/bind-material-group", summary="Bind process route to material group")
async def bind_material_group(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_group_uuid: str = Query(..., description="物料分组UUID")
):
    """
    绑定工艺路线到物料分组
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **process_route_uuid**: 工艺路线UUID
    - **material_group_uuid**: 物料分组UUID
    
    绑定后，该物料分组下的所有物料（如果没有单独绑定工艺路线）将自动使用此工艺路线。
    """
    try:
        await ProcessService.bind_material_group(tenant_id, str(process_route_uuid), material_group_uuid)
        return {"message": "绑定成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/{process_route_uuid}/unbind-material-group", summary="Unbind process route from material group")
async def unbind_material_group(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_group_uuid: str = Query(..., description="物料分组UUID")
):
    """
    解绑物料分组的工艺路线
    
    - **process_route_uuid**: 工艺路线UUID
    - **material_group_uuid**: 物料分组UUID
    """
    try:
        await ProcessService.unbind_material_group(tenant_id, material_group_uuid)
        return {"message": "解绑成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/routes/{process_route_uuid}/bind-material", summary="Bind process route to material")
async def bind_material(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: str = Query(..., description="物料UUID")
):
    """
    绑定工艺路线到物料
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    物料绑定优先级高于物料分组绑定。
    
    - **process_route_uuid**: 工艺路线UUID
    - **material_uuid**: 物料UUID
    
    绑定后，该物料将优先使用此工艺路线（即使物料所属分组也绑定了其他工艺路线）。
    """
    try:
        await ProcessService.bind_material(tenant_id, str(process_route_uuid), material_uuid)
        return {"message": "绑定成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/{process_route_uuid}/unbind-material", summary="Unbind process route from material")
async def unbind_material(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: str = Query(..., description="物料UUID")
):
    """
    解绑物料的工艺路线
    
    - **process_route_uuid**: 工艺路线UUID
    - **material_uuid**: 物料UUID
    """
    try:
        await ProcessService.unbind_material(tenant_id, material_uuid)
        return {"message": "解绑成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/routes/{process_route_uuid}/bound-materials", summary="List materials and groups bound to process route")
async def get_bound_materials(
    process_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工艺路线绑定的物料和物料分组
    
    - **process_route_uuid**: 工艺路线UUID
    
    返回该工艺路线绑定的所有物料和物料分组列表。
    """
    try:
        return await ProcessService.get_bound_materials(tenant_id, str(process_route_uuid))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/materials/{material_uuid}/product-process",
    response_model=MaterialProductProcessResponse,
    summary="Get material product process config",
)
async def get_material_product_process(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await MaterialProductProcessService.get_for_material(tenant_id, material_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/materials/{material_uuid}/product-process",
    response_model=MaterialProductProcessResponse,
    summary="Save material product process config",
)
async def save_material_product_process(
    material_uuid: str,
    data: MaterialProductProcessSave,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await MaterialProductProcessService.save_for_material(
            tenant_id, material_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/materials/{material_uuid}/process-route", response_model=Optional[ProcessRouteResponse], summary="Get process route matched to material")
async def get_process_route_for_material(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料生效的工艺路线。

    优先级：产品工艺指派 > 物料 FK/defaults > 物料分组 > source_config。
    无绑定返回 null（开单时手工选择路线）。
    """
    try:
        return await ProcessService.get_process_route_for_material(tenant_id, material_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/material-groups/{material_group_uuid}/process-route", response_model=Optional[ProcessRouteResponse], summary="Get process route matched to material group")
async def get_process_route_for_material_group(
    material_group_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料组匹配的工艺路线
    
    物料组通过 process_route_id 直接绑定工艺路线。
    
    - **material_group_uuid**: 物料组UUID
    
    返回匹配的工艺路线，如果没有则返回null。
    """
    try:
        return await ProcessService.get_process_route_for_material_group(tenant_id, material_group_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 子工艺路线管理相关接口 ====================

@router.post("/routes/{parent_route_uuid}/sub-routes", response_model=ProcessRouteResponse, summary="Create sub process route")
async def create_sub_route(
    parent_route_uuid: uuid.UUID,
    data: ProcessRouteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    parent_operation_uuid: str = Query(..., description="父工序UUID（此子工艺路线所属的父工序）")
):
    """
    创建子工艺路线
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    - **parent_route_uuid**: 父工艺路线UUID
    - **parent_operation_uuid**: 父工序UUID（此子工艺路线所属的父工序）
    - **data**: 子工艺路线创建数据（code, name, description, operation_sequence等）
    
    系统会自动设置嵌套层级，最多支持3层嵌套。
    """
    try:
        return await ProcessService.create_sub_route(
            tenant_id, str(parent_route_uuid), parent_operation_uuid, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes/{parent_route_uuid}/sub-routes", response_model=List[ProcessRouteResponse], summary="List sub process routes")
async def get_sub_routes(
    parent_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    parent_operation_uuid: Optional[str] = Query(None, description="父工序UUID（可选，如果提供则只返回该工序的子工艺路线）")
):
    """
    获取子工艺路线列表
    
    - **parent_route_uuid**: 父工艺路线UUID
    - **parent_operation_uuid**: 父工序UUID（可选，如果提供则只返回该工序的子工艺路线）
    
    返回该父工艺路线的所有子工艺路线列表。
    """
    try:
        return await ProcessService.get_sub_routes(tenant_id, str(parent_route_uuid), parent_operation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/sub-routes/{sub_route_uuid}", summary="Delete sub process route")
async def delete_sub_route(
    sub_route_uuid: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除子工艺路线（软删除）
    
    - **sub_route_uuid**: 子工艺路线UUID
    
    如果子工艺路线下还有嵌套子工艺路线，则无法删除。
    """
    try:
        await ProcessService.delete_sub_route(tenant_id, str(sub_route_uuid))
        return {"message": "子工艺路线删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工艺路线模板管理相关接口 ====================

@router.post("/route-templates", response_model=ProcessRouteTemplateResponse, status_code=status.HTTP_201_CREATED, summary="Create process route template")
async def create_process_route_template(
    data: ProcessRouteTemplateCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工艺路线模板
    
    将现有工艺路线保存为模板，用于快速创建和复用。
    """
    try:
        return await ProcessService.create_process_route_template(
            tenant_id=tenant_id,
            template_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/route-templates", response_model=List[ProcessRouteTemplateResponse], summary="List process route templates")
async def list_process_route_templates(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="模板分类筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选")
):
    """
    获取工艺路线模板列表
    
    支持按分类和启用状态筛选。
    """
    return await ProcessService.list_process_route_templates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        category=category,
        is_active=is_active
    )


@router.get("/route-templates/{template_uuid}", response_model=ProcessRouteTemplateResponse, summary="Get process route template")
async def get_process_route_template(
    template_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工艺路线模板详情
    """
    try:
        return await ProcessService.get_process_route_template(tenant_id, template_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/routes/from-template", response_model=ProcessRouteResponse, status_code=status.HTTP_201_CREATED, summary="Create process route from template")
async def create_process_route_from_template(
    data: ProcessRouteFromTemplateCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    基于模板创建工艺路线
    
    从模板复制所有配置（工序顺序、标准工时、SOP关联、跳转规则等），创建新的工艺路线。
    """
    try:
        return await ProcessService.create_process_route_from_template(
            tenant_id=tenant_id,
            route_data=data,
            current_user=current_user,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 级联查询接口 ====================

@router.get("/routes/tree", response_model=List[ProcessRouteTreeResponse], response_model_by_alias=True, summary="Get process route tree")
async def get_process_route_tree(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）")
):
    """
    获取工艺路线树形结构（工艺路线→工序）
    
    返回完整的工艺路线层级结构，每个工艺路线包含其工序序列中的工序信息。
    用于级联选择等场景。
    
    - **is_active**: 是否只查询启用的数据（可选）
    
    返回结构：
    ```json
    [
      {
        "id": 1,
        "uuid": "...",
        "code": "ROUTE001",
        "name": "工艺路线1",
        "operations": [
          {
            "id": 1,
            "uuid": "...",
            "code": "OP001",
            "name": "工序1"
          },
          {
            "id": 2,
            "uuid": "...",
            "code": "OP002",
            "name": "工序2"
          }
        ]
      }
    ]
    ```
    """
    return await ProcessService.get_process_route_tree(tenant_id, is_active)


# ==================== 作业程序（SOP）相关接口 ====================
# 注意：/sop/batch-create-from-route、/sop/for-material 等具体路径必须定义在 /sop/{sop_uuid} 之前，
# 否则会被路径参数匹配导致 405 Method Not Allowed

@router.post("/sop/batch-create-from-route", response_model=List[SOPResponse], summary="Batch create SOPs from process route")
async def batch_create_sops_from_route(
    data: SOPBatchCreateFromRouteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    按工艺路线批量创建 SOP 草稿
    
    为工艺路线中的每道工序创建一个 SOP，自动绑定物料/物料组。
    """
    try:
        return await ProcessService.batch_create_sops_from_route(
            tenant_id, data, current_user=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sop", response_model=SOPResponse, summary="Create SOP")
async def create_sop(
    data: SOPCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建作业程序（SOP）
    
    - **code**: SOP编码（必填，组织内唯一）
    - **name**: SOP名称（必填）
    - **operation_id**: 关联工序ID（可选）
    - **version**: 版本号（可选）
    - **content**: SOP内容（可选，支持富文本）
    - **attachments**: 附件列表（可选，JSON格式）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await ProcessService.create_sop(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sop", response_model=SOPListResponse, summary="List SOPs")
async def list_sops(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    operation_id: Optional[int] = Query(None, alias="operationId", description="工序ID（过滤）"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选绑定该物料的SOP）"),
    material_group_uuid: Optional[str] = Query(None, description="物料组UUID（筛选绑定该物料组的SOP）"),
    route_uuid: Optional[str] = Query(None, description="工艺路线UUID（筛选载入该工艺路线的SOP）"),
    keyword: Optional[str] = Query(None, description="模糊匹配编号、名称、版本、内容"),
    code: Optional[str] = Query(None, description="编号（模糊）"),
    name: Optional[str] = Query(None, description="名称（模糊）"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段：code,name,version,created_at,updated_at,is_active,operation_id"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取作业程序（SOP）列表
    
    - **operation_id**: 工序ID（可选）
    - **material_uuid** / **material_group_uuid** / **route_uuid**: 按绑定与载入关系筛选
    """
    items, total = await ProcessService.list_sops(
        tenant_id,
        skip,
        limit,
        operation_id=operation_id,
        is_active=is_active,
        material_uuid=material_uuid,
        material_group_uuid=material_group_uuid,
        route_uuid=route_uuid,
        keyword=keyword,
        code=code,
        name=name,
        sort_by=sort_by,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return SOPListResponse(data=items, total=total)


@router.get(
    "/sop/for-material",
    response_model=Optional[SOPResponse],
    summary="Match SOP by material",
)
async def get_sop_for_material(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: str = Query(..., description="物料UUID"),
    operation_uuid: Optional[str] = Query(None, description="工序UUID（可选，进一步限定）"),
):
    """
    按物料匹配 SOP，供开工单时「以 SOP 为依据产生流程单据」使用。
    匹配规则：具体物料优先于物料组；无匹配时 fallback 仅按工序。
    """
    return await ProcessService.get_sop_for_material(
        tenant_id, material_uuid, operation_uuid=operation_uuid
    )


@router.get(
    "/sop/for-reporting",
    response_model=Optional[SOPResponse],
    summary="Match SOP by work order and operation",
)
async def get_sop_for_reporting(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    work_order_id: int = Query(..., description="工单ID"),
    operation_id: int = Query(..., description="工序ID"),
):
    """
    按工单+工序匹配 SOP，供报工使用。
    匹配规则：物料+工序 > 物料组+工序 > 仅工序。
    """
    return await ProcessService.get_sop_for_reporting(
        tenant_id, work_order_id, operation_id
    )


@router.get("/sop/{sop_uuid}", response_model=SOPResponse, summary="Get SOP")
async def get_sop(
    sop_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取作业程序（SOP）详情
    
    - **sop_uuid**: SOP UUID
    """
    try:
        return await ProcessService.get_sop_by_uuid(tenant_id, sop_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/sop/{sop_uuid}", response_model=SOPResponse, summary="Update SOP")
async def update_sop(
    sop_uuid: str,
    data: SOPUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新作业程序（SOP）
    
    - **sop_uuid**: SOP UUID
    - **code**: SOP编码（可选）
    - **name**: SOP名称（可选）
    - **operation_id**: 关联工序ID（可选）
    - **version**: 版本号（可选）
    - **content**: SOP内容（可选，支持富文本）
    - **attachments**: 附件列表（可选，JSON格式）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await ProcessService.update_sop(tenant_id, sop_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/sop/{sop_uuid}", summary="Delete SOP")
async def delete_sop(
    sop_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除作业程序（SOP）（软删除）
    
    - **sop_uuid**: SOP UUID
    """
    try:
        await ProcessService.delete_sop(tenant_id, sop_uuid)
        return {"message": "SOP删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

