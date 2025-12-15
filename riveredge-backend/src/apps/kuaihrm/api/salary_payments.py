"""
薪资发放 API 模块

提供薪资发放的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.salary_payment_service import SalaryPaymentService
from apps.kuaihrm.schemas.salary_payment_schemas import (
    SalaryPaymentCreate, SalaryPaymentUpdate, SalaryPaymentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/salary-payments", tags=["薪资发放"])


@router.post("", response_model=SalaryPaymentResponse, summary="创建薪资发放")
async def create_salary_payment(
    data: SalaryPaymentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建薪资发放"""
    try:
        return await SalaryPaymentService.create_salary_payment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SalaryPaymentResponse], summary="获取薪资发放列表")
async def list_salary_payments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    payment_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取薪资发放列表"""
    return await SalaryPaymentService.list_salary_payments(
        tenant_id, skip, limit, employee_id, payment_period, status
    )


@router.get("/{payment_uuid}", response_model=SalaryPaymentResponse, summary="获取薪资发放详情")
async def get_salary_payment(
    payment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取薪资发放详情"""
    try:
        return await SalaryPaymentService.get_salary_payment_by_uuid(tenant_id, payment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{payment_uuid}", response_model=SalaryPaymentResponse, summary="更新薪资发放")
async def update_salary_payment(
    payment_uuid: str,
    data: SalaryPaymentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新薪资发放"""
    try:
        return await SalaryPaymentService.update_salary_payment(tenant_id, payment_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{payment_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除薪资发放")
async def delete_salary_payment(
    payment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除薪资发放（软删除）"""
    try:
        await SalaryPaymentService.delete_salary_payment(tenant_id, payment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

