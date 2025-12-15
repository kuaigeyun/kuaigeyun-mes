"""
员工离职 API 模块

提供员工离职的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.employee_resignation_service import EmployeeResignationService
from apps.kuaihrm.schemas.employee_resignation_schemas import (
    EmployeeResignationCreate, EmployeeResignationUpdate, EmployeeResignationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/employee-resignations", tags=["员工离职"])


@router.post("", response_model=EmployeeResignationResponse, summary="创建员工离职")
async def create_employee_resignation(
    data: EmployeeResignationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建员工离职"""
    try:
        return await EmployeeResignationService.create_employee_resignation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EmployeeResignationResponse], summary="获取员工离职列表")
async def list_employee_resignations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None)
):
    """获取员工离职列表"""
    return await EmployeeResignationService.list_employee_resignations(
        tenant_id, skip, limit, status, employee_id
    )


@router.get("/{resignation_uuid}", response_model=EmployeeResignationResponse, summary="获取员工离职详情")
async def get_employee_resignation(
    resignation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取员工离职详情"""
    try:
        return await EmployeeResignationService.get_employee_resignation_by_uuid(tenant_id, resignation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{resignation_uuid}", response_model=EmployeeResignationResponse, summary="更新员工离职")
async def update_employee_resignation(
    resignation_uuid: str,
    data: EmployeeResignationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新员工离职"""
    try:
        return await EmployeeResignationService.update_employee_resignation(tenant_id, resignation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{resignation_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除员工离职")
async def delete_employee_resignation(
    resignation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除员工离职（软删除）"""
    try:
        await EmployeeResignationService.delete_employee_resignation(tenant_id, resignation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

