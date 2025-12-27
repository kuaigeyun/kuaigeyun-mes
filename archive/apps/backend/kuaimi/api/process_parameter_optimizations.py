"""
工艺参数优化 API 模块

提供工艺参数优化的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimi.services.process_parameter_optimization_service import ProcessParameterOptimizationService
from apps.kuaimi.schemas.process_parameter_optimization_schemas import (
    ProcessParameterOptimizationCreate, ProcessParameterOptimizationUpdate, ProcessParameterOptimizationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/process-parameter-optimizations", tags=["ProcessParameterOptimizations"])


@router.post("", response_model=ProcessParameterOptimizationResponse, status_code=status.HTTP_201_CREATED, summary="创建工艺参数优化")
async def create_process_parameter_optimization(
    data: ProcessParameterOptimizationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建工艺参数优化"""
    try:
        return await ProcessParameterOptimizationService.create_process_parameter_optimization(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProcessParameterOptimizationResponse], summary="获取工艺参数优化列表")
async def list_process_parameter_optimizations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    process_id: Optional[int] = Query(None, description="工艺ID（过滤）"),
    improvement_status: Optional[str] = Query(None, description="改进状态（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取工艺参数优化列表"""
    return await ProcessParameterOptimizationService.list_process_parameter_optimizations(tenant_id, skip, limit, process_id, improvement_status, status)


@router.get("/{optimization_uuid}", response_model=ProcessParameterOptimizationResponse, summary="获取工艺参数优化详情")
async def get_process_parameter_optimization(
    optimization_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取工艺参数优化详情"""
    try:
        return await ProcessParameterOptimizationService.get_process_parameter_optimization_by_uuid(tenant_id, optimization_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{optimization_uuid}", response_model=ProcessParameterOptimizationResponse, summary="更新工艺参数优化")
async def update_process_parameter_optimization(
    optimization_uuid: str,
    data: ProcessParameterOptimizationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新工艺参数优化"""
    try:
        return await ProcessParameterOptimizationService.update_process_parameter_optimization(tenant_id, optimization_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{optimization_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除工艺参数优化")
async def delete_process_parameter_optimization(
    optimization_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除工艺参数优化"""
    try:
        await ProcessParameterOptimizationService.delete_process_parameter_optimization(tenant_id, optimization_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

