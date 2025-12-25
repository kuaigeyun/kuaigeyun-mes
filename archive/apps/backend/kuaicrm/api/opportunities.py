"""
商机 API 模块

提供商机的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from decimal import Decimal

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.opportunity_service import OpportunityService
from apps.kuaicrm.schemas.opportunity_schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


@router.post("", response_model=OpportunityResponse, summary="创建商机")
async def create_opportunity(
    data: OpportunityCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建商机
    
    - **oppo_no**: 商机编号（必填，组织内唯一）
    - **oppo_name**: 商机名称（必填）
    - **customer_id**: 客户ID（可选，关联master-data）
    - **stage**: 商机阶段（默认：初步接触）
    - **amount**: 商机金额（可选）
    - **expected_close_date**: 预计成交日期（可选）
    - **owner_id**: 负责人（可选）
    - **probability**: 成交概率（默认：0）
    """
    try:
        return await OpportunityService.create_opportunity(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OpportunityResponse], summary="获取商机列表")
async def list_opportunities(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    stage: Optional[str] = Query(None, description="商机阶段（过滤）"),
    owner_id: Optional[int] = Query(None, description="负责人（过滤）"),
    status: Optional[str] = Query(None, description="商机状态（过滤）")
):
    """
    获取商机列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **stage**: 商机阶段（可选，用于过滤）
    - **owner_id**: 负责人（可选）
    - **status**: 商机状态（可选）
    """
    return await OpportunityService.list_opportunities(tenant_id, skip, limit, stage, owner_id, status)


@router.get("/{opportunity_uuid}", response_model=OpportunityResponse, summary="获取商机详情")
async def get_opportunity(
    opportunity_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取商机详情
    
    - **opportunity_uuid**: 商机UUID
    """
    try:
        return await OpportunityService.get_opportunity_by_uuid(tenant_id, opportunity_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{opportunity_uuid}", response_model=OpportunityResponse, summary="更新商机")
async def update_opportunity(
    opportunity_uuid: str,
    data: OpportunityUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新商机
    
    - **opportunity_uuid**: 商机UUID
    - **data**: 商机更新数据
    """
    try:
        return await OpportunityService.update_opportunity(tenant_id, opportunity_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{opportunity_uuid}/calculate-probability", summary="计算成交概率")
async def calculate_probability(
    opportunity_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    计算商机成交概率
    
    - **opportunity_uuid**: 商机UUID
    """
    try:
        probability = await OpportunityService.calculate_probability(tenant_id, opportunity_uuid)
        return {"probability": float(probability)}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{opportunity_uuid}/change-stage", response_model=OpportunityResponse, summary="变更商机阶段")
async def change_stage(
    opportunity_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    new_stage: str = Query(..., description="新阶段"),
    reason: Optional[str] = Query(None, description="变更原因")
):
    """
    变更商机阶段
    
    - **opportunity_uuid**: 商机UUID
    - **new_stage**: 新阶段（初步接触、需求确认、方案报价、商务谈判、成交）
    - **reason**: 变更原因（可选）
    """
    try:
        return await OpportunityService.change_stage(tenant_id, opportunity_uuid, new_stage, reason)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{opportunity_uuid}/convert", response_model=OpportunityResponse, summary="转化商机为订单")
async def convert_opportunity(
    opportunity_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    转化商机为订单
    
    - **opportunity_uuid**: 商机UUID
    
    自动创建销售订单
    """
    try:
        return await OpportunityService.convert_opportunity(tenant_id, opportunity_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{opportunity_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除商机")
async def delete_opportunity(
    opportunity_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除商机（软删除）
    
    - **opportunity_uuid**: 商机UUID
    """
    try:
        await OpportunityService.delete_opportunity(tenant_id, opportunity_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
