"""
用户消息管理 API 路由

提供用户消息的查询、标记已读等功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict

from core.schemas.user_message import (
    UserMessageResponse,
    UserMessageListResponse,
    UserMessageStatsResponse,
    UserMessageMarkReadRequest,
)
from core.services.user.user_message_service import UserMessageService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/user-messages", tags=["UserMessages"])


@router.get("", response_model=UserMessageListResponse)
async def get_user_messages(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: str = Query(None, description="消息状态过滤（pending、sent、read、failed）"),
    channel: str = Query(None, description="消息渠道过滤（email、sms、internal、push）"),
    unread_only: bool = Query(False, description="是否只显示未读消息"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户消息列表
    
    Args:
        page: 页码
        page_size: 每页数量
        status: 消息状态过滤
        channel: 消息渠道过滤
        unread_only: 是否只显示未读消息
        
    Returns:
        UserMessageListResponse: 用户消息列表
    """
    return await UserMessageService.get_user_messages(
        tenant_id=tenant_id,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        channel=channel,
        unread_only=unread_only,
    )


@router.get("/stats", response_model=UserMessageStatsResponse)
async def get_user_message_stats(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户消息统计
    
    Returns:
        UserMessageStatsResponse: 用户消息统计
    """
    return await UserMessageService.get_user_message_stats(
        tenant_id=tenant_id,
        user_id=current_user.id,
    )


@router.get("/{message_uuid}", response_model=UserMessageResponse)
async def get_user_message(
    message_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户消息详情
    
    Args:
        message_uuid: 消息UUID
        
    Returns:
        UserMessageResponse: 用户消息对象
        
    Raises:
        HTTPException: 当消息不存在时抛出
    """
    try:
        return await UserMessageService.get_user_message(
            tenant_id=tenant_id,
            user_id=current_user.id,
            message_uuid=message_uuid,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/mark-read", response_model=Dict[str, int])
async def mark_messages_read(
    data: UserMessageMarkReadRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    标记消息为已读
    
    Args:
        data: 标记已读请求数据
        
    Returns:
        Dict[str, int]: 更新的消息数量
    """
    updated_count = await UserMessageService.mark_messages_read(
        tenant_id=tenant_id,
        user_id=current_user.id,
        message_uuids=data.message_uuids,
    )
    
    return {"updated_count": updated_count}


from typing import Dict

