"""
用户活动服务接口实现

实现用户活动服务接口，封装core层的OnlineUserService，
为infra层提供统一的接口调用方式。
"""

from typing import Dict, Any, Optional
from datetime import datetime
import json

from ..service_interface import UserActivityServiceInterface
from ..service_registry import service_implementation
from ...logging.online_user_service import OnlineUserService


@service_implementation(UserActivityServiceInterface)
class UserActivityServiceImpl(UserActivityServiceInterface):
    """
    用户活动服务实现类

    封装OnlineUserService，提供统一的接口调用。
    """

    def __init__(self):
        self._online_user_service = OnlineUserService()

    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "service": self.service_name,
            "version": self.service_version,
            "status": "healthy",
            "implementation": "UserActivityServiceImpl",
        }

    async def update_user_activity(
        self,
        tenant_id: int,
        user_id: int,
        login_ip: Optional[str] = None,
        login_time: Optional[datetime] = None,
    ) -> None:
        """
        更新用户活动时间

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            login_ip: 登录IP（可选）
            login_time: 登录时间（可选）
        """
        await self._online_user_service.update_user_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            login_ip=login_ip,
            login_time=login_time,
        )

    async def get_user_last_activity(
        self,
        tenant_id: int,
        user_id: int,
    ) -> Optional[datetime]:
        """
        获取用户最后活动时间

        Args:
            tenant_id: 组织ID
            user_id: 用户ID

        Returns:
            Optional[datetime]: 最后活动时间
        """
        # 从缓存中获取用户活动信息
        from infra.infrastructure.cache.cache import cache

        activity_key = self._online_user_service._get_activity_key(tenant_id, user_id)
        activity_data = await cache.get(activity_key)

        if activity_data:
            try:
                data = json.loads(activity_data)
                last_activity_str = data.get("last_activity_time")
                if last_activity_str:
                    return datetime.fromisoformat(last_activity_str)
            except (json.JSONDecodeError, ValueError):
                pass

        return None

    async def is_user_online(
        self,
        tenant_id: int,
        user_id: int,
        threshold_minutes: int = 30,
    ) -> bool:
        """
        检查用户是否在线

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            threshold_minutes: 在线判断阈值（分钟）

        Returns:
            bool: 是否在线
        """
        return await self._online_user_service.is_user_online(
            tenant_id=tenant_id,
            user_id=user_id,
            threshold_minutes=threshold_minutes,
        )
