"""
现状评估 API 模块

提供现状评估的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.current_assessment_service import CurrentAssessmentService
from apps.kuaicert.schemas.current_assessment_schemas import (
    CurrentAssessmentCreate, CurrentAssessmentUpdate, CurrentAssessmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/current-assessment", tags=["Current Assessments"])


@router.post("", response_model=CurrentAssessmentResponse, summary="创建现状评估")
async def create_currentassessment(
    data: CurrentAssessmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建现状评估"""
    try:
        return await CurrentAssessmentService.create_currentassessment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CurrentAssessmentResponse], summary="获取现状评估列表")
async def list_currentassessments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取现状评估列表"""
    return await CurrentAssessmentService.list_currentassessments(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CurrentAssessmentResponse, summary="获取现状评估详情")
async def get_currentassessment(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取现状评估详情"""
    try:
        return await CurrentAssessmentService.get_currentassessment_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CurrentAssessmentResponse, summary="更新现状评估")
async def update_currentassessment(
    obj_uuid: str,
    data: CurrentAssessmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新现状评估"""
    try:
        return await CurrentAssessmentService.update_currentassessment(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除现状评估")
async def delete_currentassessment(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除现状评估（软删除）"""
    try:
        await CurrentAssessmentService.delete_currentassessment(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
