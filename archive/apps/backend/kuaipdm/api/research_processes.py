"""
研发流程 API 模块

提供研发流程的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipdm.services.research_process_service import ResearchProcessService
from apps.kuaipdm.schemas.research_process_schemas import (
    ResearchProcessCreate, ResearchProcessUpdate, ResearchProcessResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/research-processes", tags=["Research Processes"])


@router.post("", response_model=ResearchProcessResponse, status_code=status.HTTP_201_CREATED, summary="创建研发流程")
async def create_research_process(
    data: ResearchProcessCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建研发流程
    
    - **process_no**: 流程编号（必填，组织内唯一）
    - **process_name**: 流程名称（必填）
    - **process_type**: 流程类型（必填，IPD、CMMI、APQP等）
    """
    try:
        return await ResearchProcessService.create_research_process(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ResearchProcessResponse], summary="获取研发流程列表")
async def list_research_processes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="流程状态（过滤）"),
    process_type: Optional[str] = Query(None, description="流程类型（过滤）")
):
    """
    获取研发流程列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 流程状态（可选，用于过滤）
    - **process_type**: 流程类型（可选）
    """
    return await ResearchProcessService.list_research_processes(tenant_id, skip, limit, status, process_type)


@router.get("/{process_uuid}", response_model=ResearchProcessResponse, summary="获取研发流程详情")
async def get_research_process(
    process_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取研发流程详情
    
    - **process_uuid**: 流程UUID
    """
    try:
        return await ResearchProcessService.get_research_process_by_uuid(tenant_id, process_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{process_uuid}", response_model=ResearchProcessResponse, summary="更新研发流程")
async def update_research_process(
    process_uuid: str,
    data: ResearchProcessUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新研发流程
    
    - **process_uuid**: 流程UUID
    - **data**: 流程更新数据
    """
    try:
        return await ResearchProcessService.update_research_process(tenant_id, process_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{process_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除研发流程")
async def delete_research_process(
    process_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除研发流程（软删除）
    
    - **process_uuid**: 流程UUID
    """
    try:
        await ResearchProcessService.delete_research_process(tenant_id, process_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
