"""
保存搜索条件 API 模块

提供保存搜索条件的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status
from loguru import logger

from infra.schemas.saved_search import (
    SavedSearchResponse, 
    SavedSearchListResponse, 
    SavedSearchCreate, 
    SavedSearchUpdate
)
from infra.services.saved_search_service import SavedSearchService
from infra.models.user import User
from infra.domain.tenant_context import get_current_tenant_id
from infra.api.deps.deps import get_current_user

# 创建路由
router = APIRouter(prefix="/saved-searches", tags=["Saved Searches"])


@router.get("", response_model=SavedSearchListResponse)
async def list_saved_searches(
    page_path: str = Query(..., description="页面路径"),
    include_shared: bool = Query(True, description="是否包含共享的搜索条件"),
    current_user: User = Depends(get_current_user)
):
    """
    获取保存搜索条件列表
    
    获取指定页面的保存搜索条件列表，包括自己的和共享的（如果 include_shared=True）。
    
    Args:
        page_path: 页面路径
        include_shared: 是否包含共享的搜索条件（默认 True）
        current_user: 当前用户（依赖注入）
        
    Returns:
        SavedSearchListResponse: 保存搜索条件列表响应
    """
    service = SavedSearchService()
    tenant_id = get_current_tenant_id()
    
    result = await service.list_saved_searches(
        page_path=page_path,
        user_id=current_user.id,
        include_shared=include_shared,
        tenant_id=tenant_id
    )
    
    # 将 SavedSearch 模型对象转换为 SavedSearchResponse schema 对象
    saved_search_responses = [
        SavedSearchResponse.model_validate(saved_search)
        for saved_search in result['items']
    ]
    
    return SavedSearchListResponse(
        items=saved_search_responses,
        total=result['total']
    )


@router.post("", response_model=SavedSearchResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_search(
    data: SavedSearchCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建保存搜索条件
    
    创建新保存搜索条件并保存到数据库。
    
    Args:
        data: 保存搜索条件创建数据
        current_user: 当前用户（依赖注入）
        
    Returns:
        SavedSearchResponse: 创建的保存搜索条件
    """
    service = SavedSearchService()
    tenant_id = get_current_tenant_id()
    
    try:
        saved_search = await service.create_saved_search(
            data=data,
            user_id=current_user.id,
            tenant_id=tenant_id
        )
        logger.info(f"用户 {current_user.id} 创建保存搜索条件: {saved_search.name} (UUID: {saved_search.uuid})")
        return SavedSearchResponse.model_validate(saved_search)
    except Exception as e:
        logger.error(f"创建保存搜索条件失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"创建保存搜索条件失败: {str(e)}"
        )


@router.get("/{search_uuid}", response_model=SavedSearchResponse)
async def get_saved_search(
    search_uuid: str,
    current_user: User = Depends(get_current_user)
):
    """
    获取保存搜索条件详情
    
    获取指定保存搜索条件的详细信息。只能获取自己的或共享的搜索条件。
    
    Args:
        search_uuid: 搜索条件 UUID（业务ID）
        current_user: 当前用户（依赖注入）
        
    Returns:
        SavedSearchResponse: 保存搜索条件详情
        
    Raises:
        HTTPException: 当搜索条件不存在或无权访问时抛出
    """
    service = SavedSearchService()
    saved_search = await service.get_saved_search_by_uuid(
        uuid=search_uuid,
        user_id=current_user.id
    )
    
    if not saved_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="保存搜索条件不存在或无权访问"
        )
    
    return SavedSearchResponse.model_validate(saved_search)


@router.put("/{search_uuid}", response_model=SavedSearchResponse)
async def update_saved_search(
    search_uuid: str,
    data: SavedSearchUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新保存搜索条件
    
    更新保存搜索条件信息。只能更新自己的搜索条件。
    
    Args:
        search_uuid: 搜索条件 UUID（业务ID）
        data: 保存搜索条件更新数据
        current_user: 当前用户（依赖注入）
        
    Returns:
        SavedSearchResponse: 更新后的保存搜索条件
        
    Raises:
        HTTPException: 当搜索条件不存在或无权访问时抛出
    """
    service = SavedSearchService()
    saved_search = await service.update_saved_search(
        uuid=search_uuid,
        data=data,
        user_id=current_user.id
    )
    
    if not saved_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="保存搜索条件不存在或无权访问"
        )
    
    logger.info(f"用户 {current_user.id} 更新保存搜索条件: {saved_search.name} (UUID: {saved_search.uuid})")
    return SavedSearchResponse.model_validate(saved_search)


@router.delete("/{search_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_search(
    search_uuid: str,
    current_user: User = Depends(get_current_user)
):
    """
    删除保存搜索条件
    
    删除保存搜索条件。只能删除自己的搜索条件。
    
    Args:
        search_uuid: 搜索条件 UUID（业务ID）
        current_user: 当前用户（依赖注入）
        
    Raises:
        HTTPException: 当搜索条件不存在或无权访问时抛出
    """
    service = SavedSearchService()
    success = await service.delete_saved_search(
        uuid=search_uuid,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="保存搜索条件不存在或无权访问"
        )
    
    logger.info(f"用户 {current_user.id} 删除保存搜索条件: UUID {search_uuid}")

