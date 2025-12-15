"""
薪资计算 API 模块

提供薪资计算的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.salary_calculation_service import SalaryCalculationService
from apps.kuaihrm.schemas.salary_calculation_schemas import (
    SalaryCalculationCreate, SalaryCalculationUpdate, SalaryCalculationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/salary-calculations", tags=["薪资计算"])


@router.post("", response_model=SalaryCalculationResponse, summary="创建薪资计算")
async def create_salary_calculation(
    data: SalaryCalculationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建薪资计算"""
    try:
        return await SalaryCalculationService.create_salary_calculation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SalaryCalculationResponse], summary="获取薪资计算列表")
async def list_salary_calculations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    salary_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取薪资计算列表"""
    return await SalaryCalculationService.list_salary_calculations(
        tenant_id, skip, limit, employee_id, salary_period, status
    )


@router.get("/{calculation_uuid}", response_model=SalaryCalculationResponse, summary="获取薪资计算详情")
async def get_salary_calculation(
    calculation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取薪资计算详情"""
    try:
        return await SalaryCalculationService.get_salary_calculation_by_uuid(tenant_id, calculation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{calculation_uuid}", response_model=SalaryCalculationResponse, summary="更新薪资计算")
async def update_salary_calculation(
    calculation_uuid: str,
    data: SalaryCalculationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新薪资计算"""
    try:
        return await SalaryCalculationService.update_salary_calculation(tenant_id, calculation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{calculation_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除薪资计算")
async def delete_salary_calculation(
    calculation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除薪资计算（软删除）"""
    try:
        await SalaryCalculationService.delete_salary_calculation(tenant_id, calculation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

