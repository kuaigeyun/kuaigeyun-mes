"""
仓库数据 API 模块

提供仓库数据的 RESTful API 接口（仓库、库区、库位），支持多组织隔离。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status, Body
from typing import Any, List, Optional, Annotated
from pydantic import BaseModel, Field
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from apps.master_data.api._master_data_route_access import require_master_data_module_access
from infra.models.user import User
from apps.master_data.services.warehouse_service import WarehouseService
from apps.master_data.schemas.warehouse_schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse, WarehouseListResponse,
    StorageAreaCreate, StorageAreaUpdate, StorageAreaResponse, StorageAreaListResponse,
    StorageLocationCreate, StorageLocationUpdate, StorageLocationResponse, StorageLocationListResponse,
    WarehouseTreeResponse, BatchDeleteWarehousesRequest,
    BatchDeleteStorageAreasRequest, BatchDeleteStorageLocationsRequest
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/warehouse",
    tags=["App · Master Data · Warehouse"],
    dependencies=[Depends(require_master_data_module_access("warehouse"))],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/warehouse",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_warehouse_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


# ==================== 仓库相关接口 ====================

@router.post("/warehouses", response_model=WarehouseResponse, response_model_by_alias=True, summary="Create warehouse")
async def create_warehouse(
    data: WarehouseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建仓库
    
    - **code**: 仓库编码（必填，组织内唯一）
    - **name**: 仓库名称（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await WarehouseService.create_warehouse(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/warehouses", response_model=WarehouseListResponse, response_model_by_alias=True, summary="List warehouses")
async def list_warehouses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    warehouse_type: Optional[str] = Query(None, description="仓库类型（normal/line_side/wip/outsourcing/consignment/vmi/defect/quarantine）"),
    keyword: Optional[str] = Query(None, description="关键词（编码或名称模糊匹配）"),
    code: Optional[str] = Query(None, description="仓库编码（模糊匹配）"),
    name: Optional[str] = Query(None, description="仓库名称（模糊匹配）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    sort_field: Optional[str] = Query(None, description="排序字段（code/name/createdAt 等）"),
    sort_order: Optional[str] = Query(None, description="排序方向：asc / desc"),
):
    """
    获取仓库列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    - **warehouse_type**: 仓库类型（可选）
    - **keyword**: 模糊搜索（可选）
    - **sort_field** / **sort_order**: 表格排序（可选）
    """
    try:
        return await WarehouseService.list_warehouses(
            tenant_id,
            skip,
            limit,
            is_active,
            warehouse_type,
            keyword,
            code,
            name,
            created_start_date,
            created_end_date,
            updated_start_date,
            updated_end_date,
            sort_field,
            sort_order,
        )
    except Exception as e:
        from loguru import logger
        logger.exception(f"获取仓库列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取仓库列表失败: {str(e)}"
        )


class LoadWarehousePresetRequest(BaseModel):
    """加载仓库预设请求：可指定只创建选中的预设名称"""
    names: Optional[List[str]] = Field(None, description="要创建的预设仓库名称列表，不传则创建全部")


@router.get("/warehouses/preset-preview", summary="Preview warehouse preset")
async def get_warehouse_preset_preview(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """返回预设仓库列表，用于预览与勾选后再确认创建。"""
    return list(WarehouseService.PRESET_WAREHOUSES)


@router.post("/warehouses/load-preset", summary="Load warehouse preset")
async def load_preset_warehouses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    body: Optional[LoadWarehousePresetRequest] = Body(None),
):
    """
    加载中国中小制造业常见仓库预设数据（原料仓、成品仓、半成品仓、不良品仓）。
    请求体可传 names 数组，只创建选中的预设项；不传则创建全部。
    """
    names = body.names if body else None
    count = await WarehouseService.load_preset_sme(tenant_id, names=names)
    return {"created": count, "message": f"已加载 {count} 个仓库"}


@router.post("/warehouses/sync-line-side", summary="Sync line-side warehouses")
async def sync_line_side_warehouses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据车间/工位/工作中心自动建立线边仓。
    为每个车间、工位、工作中心创建对应的线边仓（若不存在）。
    """
    result = await WarehouseService.sync_line_side_warehouses(tenant_id)
    return {
        "created": result["created"],
        "skipped": result["skipped"],
        "message": f"已同步 {result['created']} 个线边仓" + (f"，跳过 {result['skipped']} 个" if result["skipped"] else ""),
    }


@router.get("/warehouses/{warehouse_uuid}", response_model=WarehouseResponse, response_model_by_alias=True, summary="Get warehouse")
async def get_warehouse(
    warehouse_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取仓库详情
    
    - **warehouse_uuid**: 仓库UUID
    """
    try:
        return await WarehouseService.get_warehouse_by_uuid(tenant_id, warehouse_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/warehouses/{warehouse_uuid}", response_model=WarehouseResponse, response_model_by_alias=True, summary="Update warehouse")
async def update_warehouse(
    warehouse_uuid: str,
    data: WarehouseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新仓库
    
    - **warehouse_uuid**: 仓库UUID
    - **code**: 仓库编码（可选）
    - **name**: 仓库名称（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await WarehouseService.update_warehouse(tenant_id, warehouse_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/warehouses/batch-delete", summary="Batch delete warehouses")
async def batch_delete_warehouses(
    request: BatchDeleteWarehousesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除仓库（软删除）
    
    - **uuids**: 要删除的仓库UUID列表（最多100条）
    
    注意：只能删除没有关联库区的仓库
    """
    try:
        result = await WarehouseService.batch_delete_warehouses(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个仓库，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除仓库失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除仓库失败: {str(e)}"
        )


@router.delete("/warehouses/{warehouse_uuid}", summary="Delete warehouse")
async def delete_warehouse(
    warehouse_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除仓库（软删除）
    
    - **warehouse_uuid**: 仓库UUID
    
    注意：删除仓库前需要检查是否有关联的库区
    """
    try:
        await WarehouseService.delete_warehouse(tenant_id, warehouse_uuid)
        return {"message": "仓库删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 库区相关接口 ====================

@router.post("/storage-areas", response_model=StorageAreaResponse, summary="Create storage area")
async def create_storage_area(
    data: StorageAreaCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建库区
    
    - **code**: 库区编码（必填，组织内唯一）
    - **name**: 库区名称（必填）
    - **warehouse_id**: 所属仓库ID（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await WarehouseService.create_storage_area(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/storage-areas", response_model=StorageAreaListResponse, summary="List storage areas")
async def list_storage_areas(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="关键词（编码或名称模糊匹配）"),
    code: Optional[str] = Query(None, description="库区编码（模糊匹配）"),
    name: Optional[str] = Query(None, description="库区名称（模糊匹配）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    sort_field: Optional[str] = Query(None, description="排序字段"),
    sort_order: Optional[str] = Query(None, description="排序方向：asc / desc"),
):
    """
    获取库区列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **warehouse_id**: 仓库ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 模糊搜索（可选）
    - **sort_field** / **sort_order**: 表格排序（可选）
    """
    return await WarehouseService.list_storage_areas(
        tenant_id,
        skip,
        limit,
        warehouse_id,
        is_active,
        keyword,
        code,
        name,
        created_start_date,
        created_end_date,
        updated_start_date,
        updated_end_date,
        sort_field,
        sort_order,
    )


@router.get("/storage-areas/{storage_area_uuid}", response_model=StorageAreaResponse, summary="Get storage area")
async def get_storage_area(
    storage_area_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取库区详情
    
    - **storage_area_uuid**: 库区UUID
    """
    try:
        return await WarehouseService.get_storage_area_by_uuid(tenant_id, storage_area_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/storage-areas/{storage_area_uuid}", response_model=StorageAreaResponse, summary="Update storage area")
async def update_storage_area(
    storage_area_uuid: str,
    data: StorageAreaUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新库区
    
    - **storage_area_uuid**: 库区UUID
    - **code**: 库区编码（可选）
    - **name**: 库区名称（可选）
    - **warehouse_id**: 所属仓库ID（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await WarehouseService.update_storage_area(tenant_id, storage_area_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/storage-areas/batch-delete", summary="Batch delete storage areas")
async def batch_delete_storage_areas(
    request: BatchDeleteStorageAreasRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除库区（软删除）
    
    - **uuids**: 要删除的库区UUID列表（最多100条）
    
    注意：只能删除没有关联库位的库区
    """
    try:
        result = await WarehouseService.batch_delete_storage_areas(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个库区，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除库区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除库区失败: {str(e)}"
        )


@router.delete("/storage-areas/{storage_area_uuid}", summary="Delete storage area")
async def delete_storage_area(
    storage_area_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除库区（软删除）
    
    - **storage_area_uuid**: 库区UUID
    
    注意：删除库区前需要检查是否有关联的库位
    """
    try:
        await WarehouseService.delete_storage_area(tenant_id, storage_area_uuid)
        return {"message": "库区删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 库位相关接口 ====================

@router.post("/storage-locations", response_model=StorageLocationResponse, summary="Create storage location")
async def create_storage_location(
    data: StorageLocationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建库位
    
    - **code**: 库位编码（必填，组织内唯一）
    - **name**: 库位名称（必填）
    - **storage_area_id**: 所属库区ID（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await WarehouseService.create_storage_location(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/storage-locations", response_model=StorageLocationListResponse, summary="List storage locations")
async def list_storage_locations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    storage_area_id: Optional[int] = Query(None, description="库区ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="关键词（编码或名称模糊匹配）"),
    code: Optional[str] = Query(None, description="库位编码（模糊匹配）"),
    name: Optional[str] = Query(None, description="库位名称（模糊匹配）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    sort_field: Optional[str] = Query(None, description="排序字段"),
    sort_order: Optional[str] = Query(None, description="排序方向：asc / desc"),
):
    """
    获取库位列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **storage_area_id**: 库区ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 模糊搜索（可选）
    - **sort_field** / **sort_order**: 表格排序（可选）
    """
    return await WarehouseService.list_storage_locations(
        tenant_id,
        skip,
        limit,
        storage_area_id,
        is_active,
        keyword,
        code,
        name,
        created_start_date,
        created_end_date,
        updated_start_date,
        updated_end_date,
        sort_field,
        sort_order,
    )


@router.get("/storage-locations/{storage_location_uuid}", response_model=StorageLocationResponse, summary="Get storage location")
async def get_storage_location(
    storage_location_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取库位详情
    
    - **storage_location_uuid**: 库位UUID
    """
    try:
        return await WarehouseService.get_storage_location_by_uuid(tenant_id, storage_location_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/storage-locations/{storage_location_uuid}", response_model=StorageLocationResponse, summary="Update storage location")
async def update_storage_location(
    storage_location_uuid: str,
    data: StorageLocationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新库位
    
    - **storage_location_uuid**: 库位UUID
    - **code**: 库位编码（可选）
    - **name**: 库位名称（可选）
    - **storage_area_id**: 所属库区ID（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await WarehouseService.update_storage_location(tenant_id, storage_location_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/storage-locations/batch-delete", summary="Batch delete storage locations")
async def batch_delete_storage_locations(
    request: BatchDeleteStorageLocationsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除库位（软删除）
    
    - **uuids**: 要删除的库位UUID列表（最多100条）
    """
    try:
        result = await WarehouseService.batch_delete_storage_locations(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个库位，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除库位失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除库位失败: {str(e)}"
        )


@router.delete("/storage-locations/{storage_location_uuid}", summary="Delete storage location")
async def delete_storage_location(
    storage_location_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除库位（软删除）
    
    - **storage_location_uuid**: 库位UUID
    """
    try:
        await WarehouseService.delete_storage_location(tenant_id, storage_location_uuid)
        return {"message": "库位删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 级联查询接口 ====================

@router.get("/tree", response_model=List[WarehouseTreeResponse], response_model_by_alias=True, summary="Get warehouse tree")
async def get_warehouse_tree(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）")
):
    """
    获取仓库数据树形结构（仓库→库区→库位）
    
    返回完整的仓库层级结构，用于级联选择等场景。
    
    - **is_active**: 是否只查询启用的数据（可选）
    
    返回结构：
    ```json
    [
      {
        "id": 1,
        "uuid": "...",
        "code": "WH001",
        "name": "仓库1",
        "storageAreas": [
          {
            "id": 1,
            "uuid": "...",
            "code": "SA001",
            "name": "库区1",
            "storageLocations": [
              {
                "id": 1,
                "uuid": "...",
                "code": "SL001",
                "name": "库位1"
              }
            ]
          }
        ]
      }
    ]
    ```
    """
    return await WarehouseService.get_warehouse_tree(tenant_id, is_active)

