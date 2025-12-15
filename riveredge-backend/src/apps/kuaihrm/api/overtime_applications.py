"""
加班申请 API 模块

提供加班申请的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.overtime_application_service import OvertimeApplicationService
from apps.kuaihrm.schemas.overtime_application_schemas import (
    OvertimeApplicationCreate, OvertimeApplicationUpdate, OvertimeApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/overtime-applications", tags=["加班申请"])


@router.post("", response_model=OvertimeApplicationResponse, summary="创建加班申请")
async def create_overtime_application(
    data: OvertimeApplicationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建加班申请"""
    try:
        return await OvertimeApplicationService.create_overtime_application(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OvertimeApplicationResponse], summary="获取加班申请列表")
async def list_overtime_applications(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取加班申请列表"""
    return await OvertimeApplicationService.list_overtime_applications(
        tenant_id, skip, limit, employee_id, status
    )


@router.get("/{application_uuid}", response_model=OvertimeApplicationResponse, summary="获取加班申请详情")
async def get_overtime_application(
    application_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取加班申请详情"""
    try:
        return await OvertimeApplicationService.get_overtime_application_by_uuid(tenant_id, application_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{application_uuid}", response_model=OvertimeApplicationResponse, summary="更新加班申请")
async def update_overtime_application(
    application_uuid: str,
    data: OvertimeApplicationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新加班申请"""
    try:
        return await OvertimeApplicationService.update_overtime_application(tenant_id, application_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{application_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除加班申请")
async def delete_overtime_application(
    application_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除加班申请（软删除）"""
    try:
        await OvertimeApplicationService.delete_overtime_application(tenant_id, application_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

