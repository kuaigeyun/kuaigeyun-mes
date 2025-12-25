"""
运输执行 API 模块

提供运输执行的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaitms.services.transport_execution_service import TransportExecutionService
from apps.kuaitms.schemas.transport_execution_schemas import (
    TransportExecutionCreate, TransportExecutionUpdate, TransportExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/transport-executions", tags=["TransportExecutions"])


@router.post("", response_model=TransportExecutionResponse, status_code=status.HTTP_201_CREATED, summary="创建运输执行")
async def create_transport_execution(
    data: TransportExecutionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建运输执行"""
    try:
        return await TransportExecutionService.create_transport_execution(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[TransportExecutionResponse], summary="获取运输执行列表")
async def list_transport_executions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="执行状态（过滤）"),
    tracking_status: Optional[str] = Query(None, description="跟踪状态（过滤）")
):
    """获取运输执行列表"""
    return await TransportExecutionService.list_transport_executions(tenant_id, skip, limit, status, tracking_status)


@router.get("/{execution_uuid}", response_model=TransportExecutionResponse, summary="获取运输执行详情")
async def get_transport_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取运输执行详情"""
    try:
        return await TransportExecutionService.get_transport_execution_by_uuid(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{execution_uuid}", response_model=TransportExecutionResponse, summary="更新运输执行")
async def update_transport_execution(
    execution_uuid: str,
    data: TransportExecutionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新运输执行"""
    try:
        return await TransportExecutionService.update_transport_execution(tenant_id, execution_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{execution_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除运输执行")
async def delete_transport_execution(
    execution_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除运输执行"""
    try:
        await TransportExecutionService.delete_transport_execution(tenant_id, execution_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

