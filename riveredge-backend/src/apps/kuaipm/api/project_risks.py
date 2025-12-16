"""
项目风险 API 模块

提供项目风险的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.project_risk_service import ProjectRiskService
from apps.kuaipm.schemas.project_risk_schemas import (
    ProjectRiskCreate, ProjectRiskUpdate, ProjectRiskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/project-risk", tags=["Project Risks"])


@router.post("", response_model=ProjectRiskResponse, summary="创建项目风险")
async def create_projectrisk(
    data: ProjectRiskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建项目风险"""
    try:
        return await ProjectRiskService.create_projectrisk(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProjectRiskResponse], summary="获取项目风险列表")
async def list_projectrisks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取项目风险列表"""
    return await ProjectRiskService.list_projectrisks(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ProjectRiskResponse, summary="获取项目风险详情")
async def get_projectrisk(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取项目风险详情"""
    try:
        return await ProjectRiskService.get_projectrisk_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ProjectRiskResponse, summary="更新项目风险")
async def update_projectrisk(
    obj_uuid: str,
    data: ProjectRiskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新项目风险"""
    try:
        return await ProjectRiskService.update_projectrisk(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目风险")
async def delete_projectrisk(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除项目风险（软删除）"""
    try:
        await ProjectRiskService.delete_projectrisk(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
