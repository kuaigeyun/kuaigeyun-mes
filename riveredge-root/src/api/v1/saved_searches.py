"""
保存搜索条件 API 模块

提供保存搜索条件的 API 端点
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query

from models.user import User
from api.deps import get_current_user
from schemas.saved_search import (
    SavedSearchCreate,
    SavedSearchUpdate,
    SavedSearchResponse,
    SavedSearchListResponse
)
from services.saved_search_service import SavedSearchService

router = APIRouter(prefix="/saved-searches", tags=["Saved Searches"])

# 创建服务实例
saved_search_service = SavedSearchService()


@router.post("", response_model=SavedSearchResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_search(
    data: SavedSearchCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建保存搜索条件
    
    创建新的搜索条件，支持个人和共享两种类型。
    共享搜索条件租户内其他用户也能看到。
    """
    saved_search = await saved_search_service.create_saved_search(
        user=current_user,
        page_path=data.page_path,
        name=data.name,
        search_params=data.search_params,
        is_shared=data.is_shared,
        is_pinned=data.is_pinned
    )
    return saved_search


@router.get("", response_model=SavedSearchListResponse)
async def list_saved_searches(
    page_path: str = Query(..., description="页面路径"),
    include_shared: bool = Query(True, description="是否包含共享搜索条件"),
    current_user: User = Depends(get_current_user)
):
    """
    获取保存的搜索条件列表
    
    获取当前用户在指定页面的搜索条件，包括个人和共享的。
    """
    saved_searches = await saved_search_service.list_saved_searches(
        user=current_user,
        page_path=page_path,
        include_shared=include_shared
    )
    return {
        "total": len(saved_searches),
        "items": saved_searches
    }


@router.get("/{search_id}", response_model=SavedSearchResponse)
async def get_saved_search(
    search_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    获取单个保存的搜索条件
    
    获取指定 ID 的搜索条件，只能获取自己的或共享的。
    """
    saved_search = await saved_search_service.get_saved_search(
        user=current_user,
        search_id=search_id
    )
    return saved_search


@router.put("/{search_id}", response_model=SavedSearchResponse)
async def update_saved_search(
    search_id: int,
    data: SavedSearchUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新保存的搜索条件
    
    只能更新自己创建的搜索条件。
    """
    saved_search = await saved_search_service.update_saved_search(
        user=current_user,
        search_id=search_id,
        name=data.name,
        is_shared=data.is_shared,
        is_pinned=data.is_pinned,
        search_params=data.search_params
    )
    return saved_search


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_search(
    search_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    删除保存的搜索条件
    
    只能删除自己创建的搜索条件。
    """
    await saved_search_service.delete_saved_search(
        user=current_user,
        search_id=search_id
    )
    return None

