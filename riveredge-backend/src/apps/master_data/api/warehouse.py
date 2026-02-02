"""
仓库数据 API 模块

提供仓库数据的 RESTful API 接口（仓库、库区、库位），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.warehouse_service import WarehouseService
from apps.master_data.schemas.warehouse_schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StorageAreaCreate, StorageAreaUpdate, StorageAreaResponse,
    StorageLocationCreate, StorageLocationUpdate, StorageLocationResponse,
    WarehouseTreeResponse, BatchDeleteWarehousesRequest,
    BatchDeleteStorageAreasRequest, BatchDeleteStorageLocationsRequest
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/warehouse", tags=["Warehouse"])


# ==================== 仓库相关接口 ====================

@router.post("/warehouses", response_model=WarehouseResponse, summary="创建仓库")
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


@router.get("/warehouses", response_model=List[WarehouseResponse], summary="获取仓库列表")
async def list_warehouses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取仓库列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await WarehouseService.list_warehouses(tenant_id, skip, limit, is_active)
    except Exception as e:
        from loguru import logger
        logger.exception(f"获取仓库列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取仓库列表失败: {str(e)}"
        )


@router.get("/warehouses/{warehouse_uuid}", response_model=WarehouseResponse, summary="获取仓库详情")
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


@router.put("/warehouses/{warehouse_uuid}", response_model=WarehouseResponse, summary="更新仓库")
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


@router.delete("/warehouses/batch-delete", summary="批量删除仓库")
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


@router.delete("/warehouses/{warehouse_uuid}", summary="删除仓库")
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

@router.post("/storage-areas", response_model=StorageAreaResponse, summary="创建库区")
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


@router.get("/storage-areas", response_model=List[StorageAreaResponse], summary="获取库区列表")
async def list_storage_areas(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取库区列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **warehouse_id**: 仓库ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await WarehouseService.list_storage_areas(tenant_id, skip, limit, warehouse_id, is_active)


@router.get("/storage-areas/{storage_area_uuid}", response_model=StorageAreaResponse, summary="获取库区详情")
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


@router.put("/storage-areas/{storage_area_uuid}", response_model=StorageAreaResponse, summary="更新库区")
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


@router.delete("/storage-areas/batch-delete", summary="批量删除库区")
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


@router.delete("/storage-areas/{storage_area_uuid}", summary="删除库区")
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

@router.post("/storage-locations", response_model=StorageLocationResponse, summary="创建库位")
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


@router.get("/storage-locations", response_model=List[StorageLocationResponse], summary="获取库位列表")
async def list_storage_locations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    storage_area_id: Optional[int] = Query(None, description="库区ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取库位列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **storage_area_id**: 库区ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await WarehouseService.list_storage_locations(tenant_id, skip, limit, storage_area_id, is_active)


@router.get("/storage-locations/{storage_location_uuid}", response_model=StorageLocationResponse, summary="获取库位详情")
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


@router.put("/storage-locations/{storage_location_uuid}", response_model=StorageLocationResponse, summary="更新库位")
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


@router.delete("/storage-locations/batch-delete", summary="批量删除库位")
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


@router.delete("/storage-locations/{storage_location_uuid}", summary="删除库位")
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

@router.get("/tree", response_model=List[WarehouseTreeResponse], response_model_by_alias=True, summary="获取仓库数据树形结构")
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

