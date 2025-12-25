"""
实验管理 API 模块

提供实验管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuailims.services.experiment_management_service import ExperimentManagementService
from apps.kuailims.schemas.experiment_management_schemas import (
    ExperimentManagementCreate, ExperimentManagementUpdate, ExperimentManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/experiment-managements", tags=["ExperimentManagements"])


@router.post("", response_model=ExperimentManagementResponse, status_code=status.HTTP_201_CREATED, summary="创建实验管理")
async def create_experiment_management(
    data: ExperimentManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建实验管理"""
    try:
        return await ExperimentManagementService.create_experiment_management(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ExperimentManagementResponse], summary="获取实验管理列表")
async def list_experiment_managements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    experiment_type: Optional[str] = Query(None, description="实验类型（过滤）"),
    experiment_status: Optional[str] = Query(None, description="实验状态（过滤）"),
    confirmation_status: Optional[str] = Query(None, description="确认状态（过滤）")
):
    """获取实验管理列表"""
    return await ExperimentManagementService.list_experiment_managements(tenant_id, skip, limit, experiment_type, experiment_status, confirmation_status)


@router.get("/{management_uuid}", response_model=ExperimentManagementResponse, summary="获取实验管理详情")
async def get_experiment_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取实验管理详情"""
    try:
        return await ExperimentManagementService.get_experiment_management_by_uuid(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{management_uuid}", response_model=ExperimentManagementResponse, summary="更新实验管理")
async def update_experiment_management(
    management_uuid: str,
    data: ExperimentManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新实验管理"""
    try:
        return await ExperimentManagementService.update_experiment_management(tenant_id, management_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{management_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除实验管理")
async def delete_experiment_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除实验管理"""
    try:
        await ExperimentManagementService.delete_experiment_management(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

