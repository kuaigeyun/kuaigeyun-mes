"""
工艺数据 API 模块

提供工艺数据的 RESTful API 接口（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.process_service import ProcessService
from apps.master_data.services.process_route_change_service import ProcessRouteChangeService
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse,
    OperationCreate, OperationUpdate, OperationResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse,
    ProcessRouteTreeResponse,
    ProcessRouteVersionCreate, ProcessRouteVersionCompare, ProcessRouteVersionCompareResult,
    ProcessRouteTemplateCreate, ProcessRouteTemplateUpdate, ProcessRouteTemplateResponse,
    ProcessRouteTemplateVersionCreate, ProcessRouteFromTemplateCreate,
    SOPCreate, SOPUpdate, SOPResponse
)
from apps.master_data.schemas.process_route_change_schemas import (
    ProcessRouteChangeCreate, ProcessRouteChangeUpdate, ProcessRouteChangeResponse,
    ProcessRouteChangeListResponse,
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


# ==================== 工艺路线版本管理相关接口 ====================

@router.post("/routes/{process_route_code}/version", response_model=ProcessRouteResponse, summary="创建工艺路线新版本")
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
        return await ProcessService.create_process_route_version(tenant_id, process_route_code, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes/{process_route_code}/versions", response_model=List[ProcessRouteResponse], summary="获取工艺路线所有版本")
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


@router.post("/routes/{process_route_code}/compare-versions", response_model=ProcessRouteVersionCompareResult, summary="对比工艺路线版本")
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


@router.post("/routes/{process_route_code}/rollback-version", response_model=ProcessRouteResponse, summary="回退工艺路线到指定版本")
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

@router.post("/routes/{process_route_uuid}/bind-material-group", summary="绑定工艺路线到物料分组")
async def bind_material_group(
    process_route_uuid: str,
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
        await ProcessService.bind_material_group(tenant_id, process_route_uuid, material_group_uuid)
        return {"message": "绑定成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/{process_route_uuid}/unbind-material-group", summary="解绑物料分组的工艺路线")
async def unbind_material_group(
    process_route_uuid: str,
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


@router.post("/routes/{process_route_uuid}/bind-material", summary="绑定工艺路线到物料")
async def bind_material(
    process_route_uuid: str,
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
        await ProcessService.bind_material(tenant_id, process_route_uuid, material_uuid)
        return {"message": "绑定成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/{process_route_uuid}/unbind-material", summary="解绑物料的工艺路线")
async def unbind_material(
    process_route_uuid: str,
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


@router.get("/routes/{process_route_uuid}/bound-materials", summary="获取工艺路线绑定的物料和物料分组")
async def get_bound_materials(
    process_route_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工艺路线绑定的物料和物料分组
    
    - **process_route_uuid**: 工艺路线UUID
    
    返回该工艺路线绑定的所有物料和物料分组列表。
    """
    try:
        return await ProcessService.get_bound_materials(tenant_id, process_route_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/materials/{material_uuid}/process-route", response_model=Optional[ProcessRouteResponse], summary="获取物料匹配的工艺路线")
async def get_process_route_for_material(
    material_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取物料匹配的工艺路线（按优先级）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    优先级从高到低：
    1. 物料主数据中的工艺路线关联（最高优先级）
    2. 物料绑定工艺路线（第二优先级）
    3. 物料分组绑定工艺路线（第三优先级）
    4. 默认工艺路线（最低优先级，如果配置了）
    
    - **material_uuid**: 物料UUID
    
    返回匹配的工艺路线，如果没有则返回null。
    """
    try:
        return await ProcessService.get_process_route_for_material(tenant_id, material_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 子工艺路线管理相关接口 ====================

@router.post("/routes/{parent_route_uuid}/sub-routes", response_model=ProcessRouteResponse, summary="创建子工艺路线")
async def create_sub_route(
    parent_route_uuid: str,
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
        return await ProcessService.create_sub_route(tenant_id, parent_route_uuid, parent_operation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/routes/{parent_route_uuid}/sub-routes", response_model=List[ProcessRouteResponse], summary="获取子工艺路线列表")
async def get_sub_routes(
    parent_route_uuid: str,
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
        return await ProcessService.get_sub_routes(tenant_id, parent_route_uuid, parent_operation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/routes/sub-routes/{sub_route_uuid}", summary="删除子工艺路线")
async def delete_sub_route(
    sub_route_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除子工艺路线（软删除）
    
    - **sub_route_uuid**: 子工艺路线UUID
    
    如果子工艺路线下还有嵌套子工艺路线，则无法删除。
    """
    try:
        await ProcessService.delete_sub_route(tenant_id, sub_route_uuid)
        return {"message": "子工艺路线删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工艺路线模板管理相关接口 ====================

@router.post("/route-templates", response_model=ProcessRouteTemplateResponse, status_code=status.HTTP_201_CREATED, summary="创建工艺路线模板")
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


@router.get("/route-templates", response_model=List[ProcessRouteTemplateResponse], summary="获取工艺路线模板列表")
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


@router.get("/route-templates/{template_uuid}", response_model=ProcessRouteTemplateResponse, summary="获取工艺路线模板详情")
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


@router.post("/routes/from-template", response_model=ProcessRouteResponse, status_code=status.HTTP_201_CREATED, summary="基于模板创建工艺路线")
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
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
    is_active: Optional[bool] = Query(None, description="是否启用"),
    material_uuid: Optional[str] = Query(None, description="物料UUID（筛选绑定该物料的SOP）"),
    material_group_uuid: Optional[str] = Query(None, description="物料组UUID（筛选绑定该物料组的SOP）"),
    route_uuid: Optional[str] = Query(None, description="工艺路线UUID（筛选载入该工艺路线的SOP）"),
):
    """
    获取作业程序（SOP）列表
    
    - **operation_id**: 工序ID（可选）
    - **material_uuid** / **material_group_uuid** / **route_uuid**: 按绑定与载入关系筛选
    """
    return await ProcessService.list_sops(
        tenant_id, skip, limit,
        operation_id=operation_id,
        is_active=is_active,
        material_uuid=material_uuid,
        material_group_uuid=material_group_uuid,
        route_uuid=route_uuid,
    )


@router.get(
    "/sop/for-material",
    response_model=Optional[SOPResponse],
    summary="按物料匹配 SOP（工单/报工依据）",
)
async def get_sop_for_material(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: str = Query(..., description="物料UUID"),
    operation_uuid: Optional[str] = Query(None, description="工序UUID（可选，进一步限定）"),
):
    """
    按物料匹配 SOP，供开工单时「以 SOP 为依据产生流程单据」使用。
    匹配规则：具体物料优先于物料组；无匹配时返回 null。
    """
    return await ProcessService.get_sop_for_material(
        tenant_id, material_uuid, operation_uuid=operation_uuid
    )


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


# ==================== 工艺路线变更管理相关接口 ====================

@router.post("/routes/changes", response_model=ProcessRouteChangeResponse, summary="创建工艺路线变更记录")
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


@router.get("/routes/changes", response_model=ProcessRouteChangeListResponse, summary="获取工艺路线变更记录列表")
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


@router.get("/routes/changes/{change_uuid}", response_model=ProcessRouteChangeResponse, summary="获取工艺路线变更记录详情")
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


@router.put("/routes/changes/{change_uuid}", response_model=ProcessRouteChangeResponse, summary="更新工艺路线变更记录")
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
        return await ProcessRouteChangeService.update_change(tenant_id, change_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/routes/changes/{change_uuid}/approve", response_model=ProcessRouteChangeResponse, summary="审批工艺路线变更记录")
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


@router.post("/routes/changes/{change_uuid}/execute", response_model=ProcessRouteChangeResponse, summary="执行工艺路线变更记录")
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


@router.delete("/routes/changes/{change_uuid}", summary="删除工艺路线变更记录")
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

