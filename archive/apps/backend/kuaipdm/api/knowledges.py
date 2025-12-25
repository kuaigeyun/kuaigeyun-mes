"""
知识管理 API 模块

提供知识管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipdm.services.knowledge_service import KnowledgeService
from apps.kuaipdm.schemas.knowledge_schemas import (
    KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/knowledges", tags=["Knowledges"])


@router.post("", response_model=KnowledgeResponse, status_code=status.HTTP_201_CREATED, summary="创建知识")
async def create_knowledge(
    data: KnowledgeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建知识
    
    - **knowledge_no**: 知识编号（必填，组织内唯一）
    - **knowledge_type**: 知识类型（必填）
    - **title**: 知识标题（必填）
    - **content**: 知识内容（必填）
    """
    try:
        return await KnowledgeService.create_knowledge(tenant_id, data, current_user.id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[KnowledgeResponse], summary="获取知识列表")
async def list_knowledges(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    knowledge_type: Optional[str] = Query(None, description="知识类型（过滤）"),
    category: Optional[str] = Query(None, description="知识分类（过滤）"),
    is_public: Optional[bool] = Query(None, description="是否公开（过滤）")
):
    """
    获取知识列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **knowledge_type**: 知识类型（可选，用于过滤）
    - **category**: 知识分类（可选）
    - **is_public**: 是否公开（可选）
    """
    return await KnowledgeService.list_knowledges(tenant_id, skip, limit, knowledge_type, category, is_public)


@router.get("/{knowledge_uuid}", response_model=KnowledgeResponse, summary="获取知识详情")
async def get_knowledge(
    knowledge_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取知识详情（自动增加查看次数）
    
    - **knowledge_uuid**: 知识UUID
    """
    try:
        return await KnowledgeService.get_knowledge_by_uuid(tenant_id, knowledge_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{knowledge_uuid}", response_model=KnowledgeResponse, summary="更新知识")
async def update_knowledge(
    knowledge_uuid: str,
    data: KnowledgeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新知识
    
    - **knowledge_uuid**: 知识UUID
    - **data**: 知识更新数据
    """
    try:
        return await KnowledgeService.update_knowledge(tenant_id, knowledge_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{knowledge_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除知识")
async def delete_knowledge(
    knowledge_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除知识（软删除）
    
    - **knowledge_uuid**: 知识UUID
    """
    try:
        await KnowledgeService.delete_knowledge(tenant_id, knowledge_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{knowledge_uuid}/like", response_model=KnowledgeResponse, summary="点赞知识")
async def like_knowledge(
    knowledge_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    点赞知识（自动增加点赞次数）
    
    - **knowledge_uuid**: 知识UUID
    """
    try:
        return await KnowledgeService.like_knowledge(tenant_id, knowledge_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
