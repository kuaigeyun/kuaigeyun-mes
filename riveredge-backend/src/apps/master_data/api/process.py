"""
工艺数据 API 模块

提供工艺数据的 RESTful API 接口（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.process_service import ProcessService
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse,
    OperationCreate, OperationUpdate, OperationResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse,
    ProcessRouteTreeResponse,
    SOPCreate, SOPUpdate, SOPResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/process", tags=["Process"])


# ==================== 不良品相关接口 ====================

@router.post("/defect-types", response_model=DefectTypeResponse, summary="创建不良品")
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
        return await ProcessService.create_defect_type(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/defect-types", response_model=List[DefectTypeResponse], summary="获取不良品列表")
async def list_defect_types(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取不良品列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await ProcessService.list_defect_types(tenant_id, skip, limit, category, is_active)


@router.get("/defect-types/{defect_type_uuid}", response_model=DefectTypeResponse, summary="获取不良品详情")
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


@router.put("/defect-types/{defect_type_uuid}", response_model=DefectTypeResponse, summary="更新不良品")
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
        return await ProcessService.update_defect_type(tenant_id, defect_type_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/defect-types/{defect_type_uuid}", summary="删除不良品")
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

@router.post("/operations", response_model=OperationResponse, summary="创建工序")
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
        return await ProcessService.create_operation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/operations", response_model=List[OperationResponse], summary="获取工序列表")
async def list_operations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取工序列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    return await ProcessService.list_operations(tenant_id, skip, limit, is_active)


@router.get("/operations/{operation_uuid}", response_model=OperationResponse, summary="获取工序详情")
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


@router.put("/operations/{operation_uuid}", response_model=OperationResponse, summary="更新工序")
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
        return await ProcessService.update_operation(tenant_id, operation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/operations/{operation_uuid}", summary="删除工序")
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

@router.post("/routes", response_model=ProcessRouteResponse, summary="创建工艺路线")
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
        return await ProcessService.create_process_route(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes", response_model=List[ProcessRouteResponse], summary="获取工艺路线列表")
async def list_process_routes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取工艺路线列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    return await ProcessService.list_process_routes(tenant_id, skip, limit, is_active)


@router.get("/routes/{process_route_uuid}", response_model=ProcessRouteResponse, summary="获取工艺路线详情")
async def get_process_route(
    process_route_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取工艺路线详情
    
    - **process_route_uuid**: 工艺路线UUID
    """
    try:
        return await ProcessService.get_process_route_by_uuid(tenant_id, process_route_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/routes/{process_route_uuid}", response_model=ProcessRouteResponse, summary="更新工艺路线")
async def update_process_route(
    process_route_uuid: str,
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
        return await ProcessService.update_process_route(tenant_id, process_route_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/routes/{process_route_uuid}", summary="删除工艺路线")
async def delete_process_route(
    process_route_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除工艺路线（软删除）
    
    - **process_route_uuid**: 工艺路线UUID
    """
    try:
        await ProcessService.delete_process_route(tenant_id, process_route_uuid)
        return {"message": "工艺路线删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 级联查询接口 ====================

@router.get("/routes/tree", response_model=List[ProcessRouteTreeResponse], response_model_by_alias=True, summary="获取工艺路线树形结构")
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

@router.post("/sop", response_model=SOPResponse, summary="创建作业程序（SOP）")
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
        return await ProcessService.create_sop(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sop", response_model=List[SOPResponse], summary="获取作业程序（SOP）列表")
async def list_sops(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    operation_id: Optional[int] = Query(None, description="工序ID（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取作业程序（SOP）列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **operation_id**: 工序ID（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await ProcessService.list_sops(tenant_id, skip, limit, operation_id, is_active)


@router.get("/sop/{sop_uuid}", response_model=SOPResponse, summary="获取作业程序（SOP）详情")
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


@router.put("/sop/{sop_uuid}", response_model=SOPResponse, summary="更新作业程序（SOP）")
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
        return await ProcessService.update_sop(tenant_id, sop_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/sop/{sop_uuid}", summary="删除作业程序（SOP）")
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

