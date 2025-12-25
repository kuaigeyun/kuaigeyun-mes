"""
评分规则 API 模块

提供评分规则的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.scoring_rule_service import ScoringRuleService
from apps.kuaicert.schemas.scoring_rule_schemas import (
    ScoringRuleCreate, ScoringRuleUpdate, ScoringRuleResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scoring-rule", tags=["Scoring Rules"])


@router.post("", response_model=ScoringRuleResponse, summary="创建评分规则")
async def create_scoringrule(
    data: ScoringRuleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建评分规则"""
    try:
        return await ScoringRuleService.create_scoringrule(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ScoringRuleResponse], summary="获取评分规则列表")
async def list_scoringrules(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取评分规则列表"""
    return await ScoringRuleService.list_scoringrules(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ScoringRuleResponse, summary="获取评分规则详情")
async def get_scoringrule(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取评分规则详情"""
    try:
        return await ScoringRuleService.get_scoringrule_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ScoringRuleResponse, summary="更新评分规则")
async def update_scoringrule(
    obj_uuid: str,
    data: ScoringRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新评分规则"""
    try:
        return await ScoringRuleService.update_scoringrule(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除评分规则")
async def delete_scoringrule(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除评分规则（软删除）"""
    try:
        await ScoringRuleService.delete_scoringrule(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
