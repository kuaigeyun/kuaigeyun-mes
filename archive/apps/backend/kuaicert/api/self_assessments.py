"""
自评打分 API 模块

提供自评打分的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.self_assessment_service import SelfAssessmentService
from apps.kuaicert.schemas.self_assessment_schemas import (
    SelfAssessmentCreate, SelfAssessmentUpdate, SelfAssessmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/self-assessment", tags=["Self Assessments"])


@router.post("", response_model=SelfAssessmentResponse, summary="创建自评打分")
async def create_selfassessment(
    data: SelfAssessmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建自评打分"""
    try:
        return await SelfAssessmentService.create_selfassessment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SelfAssessmentResponse], summary="获取自评打分列表")
async def list_selfassessments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取自评打分列表"""
    return await SelfAssessmentService.list_selfassessments(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=SelfAssessmentResponse, summary="获取自评打分详情")
async def get_selfassessment(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取自评打分详情"""
    try:
        return await SelfAssessmentService.get_selfassessment_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=SelfAssessmentResponse, summary="更新自评打分")
async def update_selfassessment(
    obj_uuid: str,
    data: SelfAssessmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新自评打分"""
    try:
        return await SelfAssessmentService.update_selfassessment(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除自评打分")
async def delete_selfassessment(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除自评打分（软删除）"""
    try:
        await SelfAssessmentService.delete_selfassessment(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
