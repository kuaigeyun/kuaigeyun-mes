"""
用户消息管理服务模块

提供用户消息的查询、标记已读等功能。
复用 MessageLog 模型，但提供用户视角的服务。
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import DoesNotExist
from tortoise.expressions import Q

from tree_root.models.message_log import MessageLog
from tree_root.schemas.user_message import (
    UserMessageResponse,
    UserMessageListResponse,
    UserMessageStatsResponse,
)
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError


class UserMessageService:
    """
    用户消息管理服务类
    
    提供用户消息的查询、标记已读等功能。
    复用 MessageLog 模型，但提供用户视角的服务。
    """
    
    @staticmethod
    async def get_user_messages(
        tenant_id: int,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        channel: Optional[str] = None,
        unread_only: bool = False,
    ) -> UserMessageListResponse:
        """
        获取用户消息列表
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            status: 消息状态过滤（可选）
            channel: 消息渠道过滤（可选）
            unread_only: 是否只显示未读消息
            
        Returns:
            UserMessageListResponse: 用户消息列表
        """
        # 构建查询条件
        # MessageLog 的 recipient 字段可能存储用户ID、邮箱或手机号
        # 需要同时匹配用户ID和用户的联系方式（邮箱、手机号等）
        user = await User.get_or_none(id=user_id, tenant_id=tenant_id)
        if not user:
            # 如果用户不存在，返回空列表
            return UserMessageListResponse(
                items=[],
                total=0,
                page=page,
                page_size=page_size,
            )
        
        # 构建 recipient 匹配条件（用户ID、邮箱、手机号等）
        recipient_conditions = [str(user_id)]
        if user.email:
            recipient_conditions.append(user.email)
        # 如果有手机号字段，也可以添加
        # if user.phone:
        #     recipient_conditions.append(user.phone)
        
        # 使用 OR 条件查询
        # Tortoise ORM 的 Q 对象支持使用 __in 操作符进行多值匹配
        query = Q(tenant_id=tenant_id, recipient__in=recipient_conditions)
        
        # 状态过滤
        if status:
            query &= Q(status=status)
        
        # 渠道过滤（使用 type 字段）
        if channel:
            query &= Q(type=channel)
        
        # 未读过滤（pending、sending、success 都可能是未读）
        if unread_only:
            query &= Q(status__in=["pending", "sending", "success"])  # 未读消息状态
        
        # 查询总数
        total = await MessageLog.filter(query).count()
        
        # 查询列表（按创建时间倒序）
        offset = (page - 1) * page_size
        messages = await MessageLog.filter(query).order_by("-created_at").offset(offset).limit(page_size)
        
        # 转换为响应格式
        items = [UserMessageResponse.model_validate(msg) for msg in messages]
        
        return UserMessageListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    
    @staticmethod
    async def get_user_message(
        tenant_id: int,
        user_id: int,
        message_uuid: str
    ) -> UserMessageResponse:
        """
        获取用户消息详情
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            message_uuid: 消息UUID
            
        Returns:
            UserMessageResponse: 用户消息对象
            
        Raises:
            NotFoundError: 当消息不存在时抛出
        """
        # 获取用户信息以匹配 recipient
        user = await User.get_or_none(id=user_id, tenant_id=tenant_id)
        if not user:
            raise NotFoundError("用户不存在")
        
        # 构建 recipient 匹配条件
        recipient_conditions = [str(user_id)]
        if user.email:
            recipient_conditions.append(user.email)
        
        # 查询消息
        message = await MessageLog.filter(
            uuid=message_uuid,
            tenant_id=tenant_id,
            recipient__in=recipient_conditions
        ).first()
        
        if not message:
            raise NotFoundError("消息不存在")
        
        return UserMessageResponse.model_validate(message)
    
    @staticmethod
    async def mark_messages_read(
        tenant_id: int,
        user_id: int,
        message_uuids: List[UUID]
    ) -> int:
        """
        标记消息为已读
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            message_uuids: 消息UUID列表
            
        Returns:
            int: 更新的消息数量
        """
        # 获取用户信息以匹配 recipient
        user = await User.get_or_none(id=user_id, tenant_id=tenant_id)
        if not user:
            return 0
        
        # 构建 recipient 匹配条件
        recipient_conditions = [str(user_id)]
        if user.email:
            recipient_conditions.append(user.email)
        
        # 构建查询条件
        query = Q(
            tenant_id=tenant_id,
            recipient__in=recipient_conditions,
            uuid__in=message_uuids,
            status__in=["pending", "sending", "success"]  # 只标记未读消息
        )
        
        # 更新消息状态为已读
        # 注意：MessageLog 模型没有 read_at 字段，只更新 status
        updated_count = await MessageLog.filter(query).update(
            status="read",
        )
        
        return updated_count
    
    @staticmethod
    async def get_user_message_stats(
        tenant_id: int,
        user_id: int
    ) -> UserMessageStatsResponse:
        """
        获取用户消息统计
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            UserMessageStatsResponse: 用户消息统计
        """
        # 获取用户信息以匹配 recipient
        user = await User.get_or_none(id=user_id, tenant_id=tenant_id)
        if not user:
            return UserMessageStatsResponse(
                total=0,
                unread=0,
                read=0,
                failed=0,
            )
        
        # 构建 recipient 匹配条件
        recipient_conditions = [str(user_id)]
        if user.email:
            recipient_conditions.append(user.email)
        
        # 构建基础查询条件
        base_query = Q(tenant_id=tenant_id, recipient__in=recipient_conditions)
        
        # 统计总数
        total = await MessageLog.filter(base_query).count()
        
        # 统计未读（pending、sending、success 状态）
        unread = await MessageLog.filter(base_query & Q(status__in=["pending", "sending", "success"])).count()
        
        # 统计已读
        read = await MessageLog.filter(base_query & Q(status="read")).count()
        
        # 统计失败
        failed = await MessageLog.filter(base_query & Q(status="failed")).count()
        
        return UserMessageStatsResponse(
            total=total,
            unread=unread,
            read=read,
            failed=failed,
        )

