"""
维护执行记录 API 模块

提供维护执行记录的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.maintenance_execution_service import MaintenanceExecutionService
from apps.kuaieam.schemas.maintenance_execution_schemas import (
    MaintenanceExecutionCreate, MaintenanceExecutionUpdate, MaintenanceExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-executions", tags=["MaintenanceExecutions"])


@router.post("", response_model=MaintenanceExecutionResponse, status_code=status.HTTP_201_CREATED, summary="创建维护执行记录")
async def create_maintenance_execution(
    data: MaintenanceExecutionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建维护执行记录"""
    try:
        return await MaintenanceExecutionService.create_maintenance_execution(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MaintenanceExecutionResponse], summary="获取维护执行记录列表")
async def list_maintenance_executions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    workorder_uuid: Optional[str] = Query(None, description="维护工单UUID（过滤）"),
    status: Optional[str] = Query(None, description="记录状态（过滤）")
):
    """获取维护执行记录列表"""
    return await MaintenanceExecutionService.list_maintenance_executions(tenant_id, skip, limit, workorder_uuid, status)


@router.get("/{execution_uuid}", response_model=MaintenanceExecutionResponse, summary="获取维护执行记录详情")
async def get_maintenance_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取维护执行记录详情"""
    try:
        return await MaintenanceExecutionService.get_maintenance_execution_by_uuid(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{execution_uuid}", response_model=MaintenanceExecutionResponse, summary="更新维护执行记录")
async def update_maintenance_execution(
    execution_uuid: str,
    data: MaintenanceExecutionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新维护执行记录"""
    try:
        return await MaintenanceExecutionService.update_maintenance_execution(tenant_id, execution_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{execution_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除维护执行记录")
async def delete_maintenance_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除维护执行记录"""
    try:
        await MaintenanceExecutionService.delete_maintenance_execution(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
