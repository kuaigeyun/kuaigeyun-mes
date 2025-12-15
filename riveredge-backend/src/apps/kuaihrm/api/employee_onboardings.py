"""
员工入职 API 模块

提供员工入职的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.employee_onboarding_service import EmployeeOnboardingService
from apps.kuaihrm.schemas.employee_onboarding_schemas import (
    EmployeeOnboardingCreate, EmployeeOnboardingUpdate, EmployeeOnboardingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/employee-onboardings", tags=["员工入职"])


@router.post("", response_model=EmployeeOnboardingResponse, summary="创建员工入职")
async def create_employee_onboarding(
    data: EmployeeOnboardingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建员工入职"""
    try:
        return await EmployeeOnboardingService.create_employee_onboarding(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EmployeeOnboardingResponse], summary="获取员工入职列表")
async def list_employee_onboardings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None)
):
    """获取员工入职列表"""
    return await EmployeeOnboardingService.list_employee_onboardings(
        tenant_id, skip, limit, status, employee_id
    )


@router.get("/{onboarding_uuid}", response_model=EmployeeOnboardingResponse, summary="获取员工入职详情")
async def get_employee_onboarding(
    onboarding_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取员工入职详情"""
    try:
        return await EmployeeOnboardingService.get_employee_onboarding_by_uuid(tenant_id, onboarding_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{onboarding_uuid}", response_model=EmployeeOnboardingResponse, summary="更新员工入职")
async def update_employee_onboarding(
    onboarding_uuid: str,
    data: EmployeeOnboardingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新员工入职"""
    try:
        return await EmployeeOnboardingService.update_employee_onboarding(tenant_id, onboarding_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{onboarding_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除员工入职")
async def delete_employee_onboarding(
    onboarding_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除员工入职（软删除）"""
    try:
        await EmployeeOnboardingService.delete_employee_onboarding(tenant_id, onboarding_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

