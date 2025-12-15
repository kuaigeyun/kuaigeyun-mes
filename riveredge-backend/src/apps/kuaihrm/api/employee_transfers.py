"""
员工异动 API 模块

提供员工异动的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.employee_transfer_service import EmployeeTransferService
from apps.kuaihrm.schemas.employee_transfer_schemas import (
    EmployeeTransferCreate, EmployeeTransferUpdate, EmployeeTransferResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/employee-transfers", tags=["员工异动"])


@router.post("", response_model=EmployeeTransferResponse, summary="创建员工异动")
async def create_employee_transfer(
    data: EmployeeTransferCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建员工异动"""
    try:
        return await EmployeeTransferService.create_employee_transfer(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EmployeeTransferResponse], summary="获取员工异动列表")
async def list_employee_transfers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    transfer_type: Optional[str] = Query(None)
):
    """获取员工异动列表"""
    return await EmployeeTransferService.list_employee_transfers(
        tenant_id, skip, limit, status, employee_id, transfer_type
    )


@router.get("/{transfer_uuid}", response_model=EmployeeTransferResponse, summary="获取员工异动详情")
async def get_employee_transfer(
    transfer_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取员工异动详情"""
    try:
        return await EmployeeTransferService.get_employee_transfer_by_uuid(tenant_id, transfer_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{transfer_uuid}", response_model=EmployeeTransferResponse, summary="更新员工异动")
async def update_employee_transfer(
    transfer_uuid: str,
    data: EmployeeTransferUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新员工异动"""
    try:
        return await EmployeeTransferService.update_employee_transfer(tenant_id, transfer_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{transfer_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除员工异动")
async def delete_employee_transfer(
    transfer_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除员工异动（软删除）"""
    try:
        await EmployeeTransferService.delete_employee_transfer(tenant_id, transfer_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

