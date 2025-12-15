"""
薪资结构 API 模块

提供薪资结构的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.salary_structure_service import SalaryStructureService
from apps.kuaihrm.schemas.salary_structure_schemas import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/salary-structures", tags=["薪资结构"])


@router.post("", response_model=SalaryStructureResponse, summary="创建薪资结构")
async def create_salary_structure(
    data: SalaryStructureCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建薪资结构"""
    try:
        return await SalaryStructureService.create_salary_structure(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SalaryStructureResponse], summary="获取薪资结构列表")
async def list_salary_structures(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    structure_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取薪资结构列表"""
    return await SalaryStructureService.list_salary_structures(
        tenant_id, skip, limit, structure_type, status
    )


@router.get("/{structure_uuid}", response_model=SalaryStructureResponse, summary="获取薪资结构详情")
async def get_salary_structure(
    structure_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取薪资结构详情"""
    try:
        return await SalaryStructureService.get_salary_structure_by_uuid(tenant_id, structure_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{structure_uuid}", response_model=SalaryStructureResponse, summary="更新薪资结构")
async def update_salary_structure(
    structure_uuid: str,
    data: SalaryStructureUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新薪资结构"""
    try:
        return await SalaryStructureService.update_salary_structure(tenant_id, structure_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{structure_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除薪资结构")
async def delete_salary_structure(
    structure_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除薪资结构（软删除）"""
    try:
        await SalaryStructureService.delete_salary_structure(tenant_id, structure_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

