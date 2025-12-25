"""
商机跟进记录 API 模块

提供商机跟进记录的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.opportunity_followup_service import OpportunityFollowUpService
from apps.kuaicrm.schemas.opportunity_followup_schemas import (
    OpportunityFollowUpCreate, OpportunityFollowUpUpdate, OpportunityFollowUpResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/opportunity-followups", tags=["Opportunity FollowUps"])


@router.post("", response_model=OpportunityFollowUpResponse, summary="创建商机跟进记录")
async def create_followup(
    data: OpportunityFollowUpCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建商机跟进记录
    
    - **opportunity_id**: 商机ID（必填，关联Opportunity）
    - **followup_type**: 跟进类型（必填，电话、邮件、拜访、会议、演示等）
    - **followup_content**: 跟进内容（必填）
    - **followup_result**: 跟进结果（可选）
    - **next_followup_date**: 下次跟进日期（可选）
    - **followup_by**: 跟进人（必填，用户ID）
    """
    try:
        return await OpportunityFollowUpService.create_followup(tenant_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OpportunityFollowUpResponse], summary="获取商机跟进记录列表")
async def list_followups(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    opportunity_id: Optional[int] = Query(None, description="商机ID（过滤）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量")
):
    """
    获取商机跟进记录列表
    
    - **opportunity_id**: 商机ID（可选，用于过滤）
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    """
    return await OpportunityFollowUpService.list_followups(tenant_id, opportunity_id, skip, limit)


@router.get("/{followup_uuid}", response_model=OpportunityFollowUpResponse, summary="获取商机跟进记录详情")
async def get_followup(
    followup_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取商机跟进记录详情
    
    - **followup_uuid**: 跟进记录UUID
    """
    try:
        return await OpportunityFollowUpService.get_followup_by_uuid(tenant_id, followup_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{followup_uuid}", response_model=OpportunityFollowUpResponse, summary="更新商机跟进记录")
async def update_followup(
    followup_uuid: str,
    data: OpportunityFollowUpUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新商机跟进记录
    
    - **followup_uuid**: 跟进记录UUID
    - **data**: 跟进记录更新数据
    """
    try:
        return await OpportunityFollowUpService.update_followup(tenant_id, followup_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{followup_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除商机跟进记录")
async def delete_followup(
    followup_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除商机跟进记录（软删除）
    
    - **followup_uuid**: 跟进记录UUID
    """
    try:
        await OpportunityFollowUpService.delete_followup(tenant_id, followup_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
