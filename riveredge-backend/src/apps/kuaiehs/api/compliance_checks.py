"""
合规检查 API 模块

提供合规检查的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.compliance_check_service import ComplianceCheckService
from apps.kuaiehs.schemas.compliance_check_schemas import (
    ComplianceCheckCreate, ComplianceCheckUpdate, ComplianceCheckResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/compliance-check", tags=["合规检查"])


@router.post("", response_model=ComplianceCheckResponse, summary="创建合规检查")
async def create_compliancecheck(
    data: ComplianceCheckCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建合规检查"""
    try:
        return await ComplianceCheckService.create_compliancecheck(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ComplianceCheckResponse], summary="获取合规检查列表")
async def list_compliancechecks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取合规检查列表"""
    return await ComplianceCheckService.list_compliancechecks(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ComplianceCheckResponse, summary="获取合规检查详情")
async def get_compliancecheck(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取合规检查详情"""
    try:
        return await ComplianceCheckService.get_compliancecheck_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ComplianceCheckResponse, summary="更新合规检查")
async def update_compliancecheck(
    obj_uuid: str,
    data: ComplianceCheckUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新合规检查"""
    try:
        return await ComplianceCheckService.update_compliancecheck(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除合规检查")
async def delete_compliancecheck(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除合规检查（软删除）"""
    try:
        await ComplianceCheckService.delete_compliancecheck(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
