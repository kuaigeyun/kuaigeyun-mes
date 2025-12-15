"""
请假申请 API 模块

提供请假申请的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.leave_application_service import LeaveApplicationService
from apps.kuaihrm.schemas.leave_application_schemas import (
    LeaveApplicationCreate, LeaveApplicationUpdate, LeaveApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/leave-applications", tags=["请假申请"])


@router.post("", response_model=LeaveApplicationResponse, summary="创建请假申请")
async def create_leave_application(
    data: LeaveApplicationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建请假申请"""
    try:
        return await LeaveApplicationService.create_leave_application(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[LeaveApplicationResponse], summary="获取请假申请列表")
async def list_leave_applications(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    leave_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取请假申请列表"""
    return await LeaveApplicationService.list_leave_applications(
        tenant_id, skip, limit, employee_id, leave_type, status
    )


@router.get("/{application_uuid}", response_model=LeaveApplicationResponse, summary="获取请假申请详情")
async def get_leave_application(
    application_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取请假申请详情"""
    try:
        return await LeaveApplicationService.get_leave_application_by_uuid(tenant_id, application_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{application_uuid}", response_model=LeaveApplicationResponse, summary="更新请假申请")
async def update_leave_application(
    application_uuid: str,
    data: LeaveApplicationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新请假申请"""
    try:
        return await LeaveApplicationService.update_leave_application(tenant_id, application_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{application_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除请假申请")
async def delete_leave_application(
    application_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除请假申请（软删除）"""
    try:
        await LeaveApplicationService.delete_leave_application(tenant_id, application_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

