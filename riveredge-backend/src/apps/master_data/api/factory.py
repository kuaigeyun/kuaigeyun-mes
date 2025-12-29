"""
工厂数据 API 模块

提供工厂数据的 RESTful API 接口（车间、产线、工位），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from uuid import UUID

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.factory_service import FactoryService
from apps.master_data.schemas.factory_schemas import (
    WorkshopCreate, WorkshopUpdate, WorkshopResponse,
    ProductionLineCreate, ProductionLineUpdate, ProductionLineResponse,
    WorkstationCreate, WorkstationUpdate, WorkstationResponse,
    WorkshopTreeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/factory", tags=["Factory"])


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

