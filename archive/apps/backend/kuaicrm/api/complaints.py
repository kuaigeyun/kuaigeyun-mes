"""
投诉处理 API 模块

提供投诉的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.complaint_service import ComplaintService
from apps.kuaicrm.schemas.complaint_schemas import (
    ComplaintCreate, ComplaintUpdate, ComplaintResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post("", response_model=ComplaintResponse, summary="创建投诉")
async def create_complaint(
    data: ComplaintCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建投诉
    
    - **complaint_no**: 投诉编号（必填，组织内唯一）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **complaint_type**: 投诉类型（必填）
    - **complaint_content**: 投诉内容（必填）
    """
    try:
        return await ComplaintService.create_complaint(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ComplaintResponse], summary="获取投诉列表")
async def list_complaints(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    handle_status: Optional[str] = Query(None, description="处理状态（过滤）"),
    complaint_type: Optional[str] = Query(None, description="投诉类型（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取投诉列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **handle_status**: 处理状态（可选，用于过滤）
    - **complaint_type**: 投诉类型（可选）
    - **customer_id**: 客户ID（可选）
    """
    return await ComplaintService.list_complaints(tenant_id, skip, limit, handle_status, complaint_type, customer_id)


@router.get("/{complaint_uuid}", response_model=ComplaintResponse, summary="获取投诉详情")
async def get_complaint(
    complaint_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取投诉详情
    
    - **complaint_uuid**: 投诉UUID
    """
    try:
        return await ComplaintService.get_complaint_by_uuid(tenant_id, complaint_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{complaint_uuid}/process", response_model=ComplaintResponse, summary="处理投诉")
async def process_complaint(
    complaint_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    handle_result: str = Query(..., description="处理结果")
):
    """
    处理投诉
    
    - **complaint_uuid**: 投诉UUID
    - **handle_result**: 处理结果
    """
    try:
        return await ComplaintService.process_complaint(tenant_id, complaint_uuid, handle_result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{complaint_uuid}", response_model=ComplaintResponse, summary="更新投诉")
async def update_complaint(
    complaint_uuid: str,
    data: ComplaintUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新投诉
    
    - **complaint_uuid**: 投诉UUID
    - **data**: 投诉更新数据
    """
    try:
        return await ComplaintService.update_complaint(tenant_id, complaint_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{complaint_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除投诉")
async def delete_complaint(
    complaint_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除投诉（软删除）
    
    - **complaint_uuid**: 投诉UUID
    """
    try:
        await ComplaintService.delete_complaint(tenant_id, complaint_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
