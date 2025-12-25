"""
线索 API 模块

提供线索的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.lead_service import LeadService
from apps.kuaicrm.schemas.lead_schemas import (
    LeadCreate, LeadUpdate, LeadResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.post("", response_model=LeadResponse, summary="创建线索")
async def create_lead(
    data: LeadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建线索
    
    - **lead_no**: 线索编号（必填，组织内唯一）
    - **lead_source**: 线索来源（必填）
    - **customer_name**: 客户名称（必填）
    - **contact_name**: 联系人（可选）
    - **contact_phone**: 联系电话（可选）
    - **contact_email**: 联系邮箱（可选）
    - **address**: 地址（可选）
    - **score**: 线索评分（默认：0）
    - **assigned_to**: 分配给（可选）
    """
    try:
        return await LeadService.create_lead(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[LeadResponse], summary="获取线索列表")
async def list_leads(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="线索状态（过滤）"),
    assigned_to: Optional[int] = Query(None, description="分配给（过滤）"),
    lead_source: Optional[str] = Query(None, description="线索来源（过滤）")
):
    """
    获取线索列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 线索状态（可选，用于过滤）
    - **assigned_to**: 分配给（可选）
    - **lead_source**: 线索来源（可选）
    """
    return await LeadService.list_leads(tenant_id, skip, limit, status, assigned_to, lead_source)


@router.get("/{lead_uuid}", response_model=LeadResponse, summary="获取线索详情")
async def get_lead(
    lead_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取线索详情
    
    - **lead_uuid**: 线索UUID
    """
    try:
        return await LeadService.get_lead_by_uuid(tenant_id, lead_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{lead_uuid}", response_model=LeadResponse, summary="更新线索")
async def update_lead(
    lead_uuid: str,
    data: LeadUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新线索
    
    - **lead_uuid**: 线索UUID
    - **data**: 线索更新数据
    """
    try:
        return await LeadService.update_lead(tenant_id, lead_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{lead_uuid}/score", response_model=LeadResponse, summary="线索评分")
async def score_lead(
    lead_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    score: Optional[int] = Query(None, ge=0, le=100, description="评分（可选，不提供则自动计算）")
):
    """
    线索评分
    
    - **lead_uuid**: 线索UUID
    - **score**: 评分（可选，不提供则自动计算）
    """
    try:
        return await LeadService.score_lead(tenant_id, lead_uuid, score)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{lead_uuid}/assign", response_model=LeadResponse, summary="分配线索")
async def assign_lead(
    lead_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    assigned_to: int = Query(..., description="分配给（用户ID）")
):
    """
    分配线索
    
    - **lead_uuid**: 线索UUID
    - **assigned_to**: 分配给（用户ID）
    """
    try:
        return await LeadService.assign_lead(tenant_id, lead_uuid, assigned_to)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{lead_uuid}/convert", response_model=LeadResponse, summary="转化线索")
async def convert_lead(
    lead_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    convert_type: str = Query(..., description="转化类型（opportunity: 转化为商机, customer: 转化为客户）"),
    convert_reason: Optional[str] = Query(None, description="转化原因")
):
    """
    转化线索
    
    - **lead_uuid**: 线索UUID
    - **convert_type**: 转化类型（opportunity: 转化为商机, customer: 转化为客户）
    - **convert_reason**: 转化原因（可选）
    """
    try:
        return await LeadService.convert_lead(tenant_id, lead_uuid, convert_type, convert_reason)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{lead_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除线索")
async def delete_lead(
    lead_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除线索（软删除）
    
    - **lead_uuid**: 线索UUID
    """
    try:
        await LeadService.delete_lead(tenant_id, lead_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
