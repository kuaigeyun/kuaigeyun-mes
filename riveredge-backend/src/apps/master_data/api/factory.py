"""
工厂数据 API 模块

提供工厂数据的 RESTful API 接口（厂区、车间、产线、工位），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from uuid import UUID

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.factory_service import FactoryService
from apps.master_data.schemas.factory_schemas import (
    PlantCreate, PlantUpdate, PlantResponse,
    WorkshopCreate, WorkshopUpdate, WorkshopResponse,
    ProductionLineCreate, ProductionLineUpdate, ProductionLineResponse,
    WorkstationCreate, WorkstationUpdate, WorkstationResponse,
    WorkshopTreeResponse, BatchDeletePlantsRequest, BatchDeleteWorkshopsRequest,
    BatchDeleteProductionLinesRequest, BatchDeleteWorkstationsRequest
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/factory", tags=["Factory"])


# ==================== 厂区相关接口 ====================

@router.post("/plants", response_model=PlantResponse, response_model_by_alias=True, summary="创建厂区")
async def create_plant(
    data: PlantCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建厂区
    
    - **code**: 厂区编码（必填，组织内唯一）
    - **name**: 厂区名称（必填）
    - **description**: 描述（可选）
    - **address**: 地址（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await FactoryService.create_plant(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/plants", response_model=List[PlantResponse], response_model_by_alias=True, summary="获取厂区列表")
async def list_plants(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（厂区编码或名称）"),
    code: Optional[str] = Query(None, description="厂区编码（精确匹配）"),
    name: Optional[str] = Query(None, description="厂区名称（模糊匹配）")
):
    """
    获取厂区列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（厂区编码或名称）
    - **code**: 厂区编码（精确匹配）
    - **name**: 厂区名称（模糊匹配）
    """
    try:
        return await FactoryService.list_plants(tenant_id, skip, limit, is_active, keyword, code, name)
    except Exception as e:
        from loguru import logger
        logger.exception(f"获取厂区列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取厂区列表失败: {str(e)}"
        )


@router.get("/plants/{plant_uuid}", response_model=PlantResponse, response_model_by_alias=True, summary="获取厂区详情")
async def get_plant(
    plant_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取厂区详情
    
    - **plant_uuid**: 厂区UUID
    """
    try:
        return await FactoryService.get_plant_by_uuid(tenant_id, plant_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/plants/{plant_uuid}", response_model=PlantResponse, response_model_by_alias=True, summary="更新厂区")
async def update_plant(
    plant_uuid: str,
    data: PlantUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新厂区
    
    - **plant_uuid**: 厂区UUID
    - **code**: 厂区编码（可选）
    - **name**: 厂区名称（可选）
    - **description**: 描述（可选）
    - **address**: 地址（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await FactoryService.update_plant(tenant_id, plant_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/plants/batch-delete", summary="批量删除厂区")
async def batch_delete_plants(
    request: BatchDeletePlantsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除厂区（软删除）
    
    - **uuids**: 要删除的厂区UUID列表（最多100条）
    
    注意：只能删除没有关联车间的厂区
    """
    try:
        result = await FactoryService.batch_delete_plants(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个厂区，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除厂区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除厂区失败: {str(e)}"
        )


@router.delete("/plants/{plant_uuid}", summary="删除厂区")
async def delete_plant(
    plant_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除厂区（软删除）
    
    - **plant_uuid**: 厂区UUID
    
    注意：删除厂区前需要检查是否有关联的车间
    """
    try:
        await FactoryService.delete_plant(tenant_id, plant_uuid)
        return {"message": "厂区删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 车间相关接口 ====================

@router.post("/workshops", response_model=WorkshopResponse, response_model_by_alias=True, summary="创建车间")
async def create_workshop(
    data: WorkshopCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建车间
    
    - **code**: 车间编码（必填，组织内唯一）
    - **name**: 车间名称（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await FactoryService.create_workshop(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/workshops", response_model=List[WorkshopResponse], response_model_by_alias=True, summary="获取车间列表")
async def list_workshops(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（车间编码或名称）"),
    code: Optional[str] = Query(None, description="车间编码（精确匹配）"),
    name: Optional[str] = Query(None, description="车间名称（模糊匹配）")
):
    """
    获取车间列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（车间编码或名称）
    - **code**: 车间编码（精确匹配）
    - **name**: 车间名称（模糊匹配）
    """
    try:
        return await FactoryService.list_workshops(tenant_id, skip, limit, is_active, keyword, code, name)
    except Exception as e:
        from loguru import logger
        logger.exception(f"获取车间列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取车间列表失败: {str(e)}"
        )


@router.get("/workshops/{workshop_uuid}", response_model=WorkshopResponse, response_model_by_alias=True, summary="获取车间详情")
async def get_workshop(
    workshop_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取车间详情
    
    - **workshop_uuid**: 车间UUID
    """
    try:
        return await FactoryService.get_workshop_by_uuid(tenant_id, workshop_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/workshops/{workshop_uuid}", response_model=WorkshopResponse, response_model_by_alias=True, summary="更新车间")
async def update_workshop(
    workshop_uuid: str,
    data: WorkshopUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新车间
    
    - **workshop_uuid**: 车间UUID
    - **code**: 车间编码（可选）
    - **name**: 车间名称（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await FactoryService.update_workshop(tenant_id, workshop_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/workshops/batch-delete", summary="批量删除车间")
async def batch_delete_workshops(
    request: BatchDeleteWorkshopsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除车间（软删除）
    
    - **uuids**: 要删除的车间UUID列表（最多100条）
    
    注意：只能删除没有关联产线的车间
    """
    try:
        result = await FactoryService.batch_delete_workshops(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个车间，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除车间失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除车间失败: {str(e)}"
        )


@router.delete("/workshops/{workshop_uuid}", summary="删除车间")
async def delete_workshop(
    workshop_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除车间（软删除）
    
    - **workshop_uuid**: 车间UUID
    
    注意：删除车间前需要检查是否有关联的产线
    """
    try:
        await FactoryService.delete_workshop(tenant_id, workshop_uuid)
        return {"message": "车间删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 产线相关接口 ====================

@router.post("/production-lines", response_model=ProductionLineResponse, response_model_by_alias=True, summary="创建产线")
async def create_production_line(
    data: ProductionLineCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建产线
    
    - **code**: 产线编码（必填，组织内唯一）
    - **name**: 产线名称（必填）
    - **workshop_id**: 所属车间ID（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await FactoryService.create_production_line(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/production-lines", response_model=List[ProductionLineResponse], response_model_by_alias=True, summary="获取产线列表")
async def list_production_lines(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    workshop_id: Optional[int] = Query(None, description="车间ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取产线列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **workshop_id**: 车间ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await FactoryService.list_production_lines(tenant_id, skip, limit, workshop_id, is_active)


@router.get("/production-lines/{production_line_uuid}", response_model=ProductionLineResponse, response_model_by_alias=True, summary="获取产线详情")
async def get_production_line(
    production_line_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取产线详情
    
    - **production_line_uuid**: 产线UUID
    """
    try:
        return await FactoryService.get_production_line_by_uuid(tenant_id, production_line_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/production-lines/{production_line_uuid}", response_model=ProductionLineResponse, response_model_by_alias=True, summary="更新产线")
async def update_production_line(
    production_line_uuid: str,
    data: ProductionLineUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新产线
    
    - **production_line_uuid**: 产线UUID
    - **code**: 产线编码（可选）
    - **name**: 产线名称（可选）
    - **workshop_id**: 所属车间ID（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await FactoryService.update_production_line(tenant_id, production_line_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/production-lines/batch-delete", summary="批量删除产线")
async def batch_delete_production_lines(
    request: BatchDeleteProductionLinesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除产线（软删除）
    
    - **uuids**: 要删除的产线UUID列表（最多100条）
    
    注意：只能删除没有关联工位的产线
    """
    try:
        result = await FactoryService.batch_delete_production_lines(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个产线，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除产线失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除产线失败: {str(e)}"
        )


@router.delete("/production-lines/{production_line_uuid}", summary="删除产线")
async def delete_production_line(
    production_line_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除产线（软删除）
    
    - **production_line_uuid**: 产线UUID
    
    注意：删除产线前需要检查是否有关联的工位
    """
    try:
        await FactoryService.delete_production_line(tenant_id, production_line_uuid)
        return {"message": "产线删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工位相关接口 ====================

@router.post("/workstations", response_model=WorkstationResponse, response_model_by_alias=True, summary="创建工位")
async def create_workstation(
    data: WorkstationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建工位
    
    - **code**: 工位编码（必填，组织内唯一）
    - **name**: 工位名称（必填）
    - **production_line_id**: 所属产线ID（必填）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await FactoryService.create_workstation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/workstations", response_model=List[WorkstationResponse], response_model_by_alias=True, summary="获取工位列表")
async def list_workstations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    production_line_id: Optional[int] = Query(None, description="产线ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取工位列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **production_line_id**: 产线ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await FactoryService.list_workstations(tenant_id, skip, limit, production_line_id, is_active)


@router.get("/workstations/{workstation_uuid}", response_model=WorkstationResponse, response_model_by_alias=True, summary="获取工位详情")
async def get_workstation(
    workstation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取工位详情
    
    - **workstation_uuid**: 工位UUID
    """
    try:
        return await FactoryService.get_workstation_by_uuid(tenant_id, workstation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/workstations/{workstation_uuid}", response_model=WorkstationResponse, response_model_by_alias=True, summary="更新工位")
async def update_workstation(
    workstation_uuid: str,
    data: WorkstationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新工位
    
    - **workstation_uuid**: 工位UUID
    - **code**: 工位编码（可选）
    - **name**: 工位名称（可选）
    - **production_line_id**: 所属产线ID（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await FactoryService.update_workstation(tenant_id, workstation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/workstations/batch-delete", summary="批量删除工位")
async def batch_delete_workstations(
    request: BatchDeleteWorkstationsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    批量删除工位（软删除）
    
    - **uuids**: 要删除的工位UUID列表（最多100条）
    """
    try:
        result = await FactoryService.batch_delete_workstations(tenant_id, request.uuids)
        return {
            "success": result["failed_count"] == 0,
            "message": f"成功删除 {result['success_count']} 个工位，失败 {result['failed_count']} 个",
            "data": result
        }
    except Exception as e:
        from loguru import logger
        logger.exception(f"批量删除工位失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除工位失败: {str(e)}"
        )


@router.delete("/workstations/{workstation_uuid}", summary="删除工位")
async def delete_workstation(
    workstation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工位（软删除）
    
    - **workstation_uuid**: 工位UUID
    """
    try:
        await FactoryService.delete_workstation(tenant_id, workstation_uuid)
        return {"message": "工位删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 级联查询接口 ====================

@router.get("/tree", response_model=List[WorkshopTreeResponse], response_model_by_alias=True, summary="获取工厂数据树形结构")
async def get_factory_tree(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(None, description="是否只查询启用的数据（可选）")
):
    """
    获取工厂数据树形结构（车间→产线→工位）
    
    返回完整的工厂层级结构，用于级联选择等场景。
    
    - **is_active**: 是否只查询启用的数据（可选）
    
    返回结构：
    ```json
    [
      {
        "id": 1,
        "uuid": "...",
        "code": "WS001",
        "name": "车间1",
        "productionLines": [
          {
            "id": 1,
            "uuid": "...",
            "code": "PL001",
            "name": "产线1",
            "workstations": [
              {
                "id": 1,
                "uuid": "...",
                "code": "ST001",
                "name": "工位1"
              }
            ]
          }
        ]
      }
    ]
    ```
    """
    return await FactoryService.get_factory_tree(tenant_id, is_active)

