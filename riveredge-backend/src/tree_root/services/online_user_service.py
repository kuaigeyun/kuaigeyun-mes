"""
在线用户管理服务模块

提供在线用户的查询和会话管理功能。
从 Redis 中读取用户活动信息，判断用户是否在线。
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from soil.infrastructure.cache.cache import cache
from tree_root.schemas.online_user import (
    OnlineUserResponse,
    OnlineUserListResponse,
    OnlineUserStatisticsResponse,
)
from soil.models.user import User
from loguru import logger


class OnlineUserService:
    """
    在线用户管理服务类
    
    提供在线用户的查询和会话管理功能。
    从 Redis 中读取用户活动信息，判断用户是否在线。
    """
    
    # Redis 键前缀
    ACTIVITY_KEY_PREFIX = "user:activity"
    # 在线用户判断阈值（最近30分钟有活动视为在线）
    ONLINE_THRESHOLD_MINUTES = 30
    
    @staticmethod
    def _get_activity_key(tenant_id: int, user_id: int) -> str:
        """
        获取用户活动 Redis 键
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            str: Redis 键
        """
        return f"{OnlineUserService.ACTIVITY_KEY_PREFIX}:{tenant_id}:{user_id}"
    
    @staticmethod
    async def update_user_activity(
        tenant_id: int,
        user_id: int,
        login_ip: Optional[str] = None,
        login_time: Optional[datetime] = None,
    ) -> None:
        """
        更新用户活动时间
        
        在用户每次 API 请求时调用，更新用户最后活动时间。
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            login_ip: 登录IP（可选）
            login_time: 登录时间（可选，首次登录时设置）
        """
        try:
            activity_key = OnlineUserService._get_activity_key(tenant_id, user_id)
            now = datetime.now()
            
            # 获取现有活动信息
            existing_data = await cache.get(activity_key)
            if existing_data:
                try:
                    activity_data = json.loads(existing_data)
                    # 保留登录时间和登录IP（如果已存在）
                    if not login_time and activity_data.get("login_time"):
                        login_time = datetime.fromisoformat(activity_data["login_time"])
                    if not login_ip and activity_data.get("login_ip"):
                        login_ip = activity_data["login_ip"]
                except Exception:
                    pass
            
            # 构建活动数据
            activity_data = {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "last_activity_time": now.isoformat(),
                "login_ip": login_ip,
                "login_time": login_time.isoformat() if login_time else now.isoformat(),
            }
            
            # 存储到 Redis，设置过期时间为在线阈值 + 10分钟（缓冲时间）
            expire_seconds = (OnlineUserService.ONLINE_THRESHOLD_MINUTES + 10) * 60
            await cache.set(
                activity_key,
                json.dumps(activity_data),
                expire=expire_seconds
            )
        except Exception as e:
            logger.warning(f"更新用户活动时间失败: {e}")
    
    @staticmethod
    async def list_online_users(
        tenant_id: Optional[int] = None
    ) -> List[OnlineUserResponse]:
        """
        获取在线用户列表
        
        Args:
            tenant_id: 组织ID（可选，如果提供则只返回该组织的在线用户）
            
        Returns:
            List[OnlineUserResponse]: 在线用户列表
        """
        try:
            redis_client = cache._redis
            if not redis_client:
                logger.warning("Redis 未连接，无法获取在线用户列表")
                return []
            
            online_users = []
            activity_threshold = datetime.now() - timedelta(minutes=OnlineUserService.ONLINE_THRESHOLD_MINUTES)
            
            # 获取所有活动键
            if tenant_id:
                # 如果指定了组织，只查询该组织的活动键
                pattern = f"{OnlineUserService.ACTIVITY_KEY_PREFIX}:{tenant_id}:*"
            else:
                # 查询所有活动键
                pattern = f"{OnlineUserService.ACTIVITY_KEY_PREFIX}:*"
            
            # 使用 SCAN 代替 KEYS（避免阻塞）
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
                for key in keys:
                    try:
                        # 获取活动数据
                        activity_data_str = await cache.get(key)
                        if not activity_data_str:
                            continue
                        
                        activity_data = json.loads(activity_data_str)
                        
                        # 检查最后活动时间
                        last_activity_time_str = activity_data.get("last_activity_time")
                        if not last_activity_time_str:
                            continue
                        
                        last_activity_time = datetime.fromisoformat(last_activity_time_str)
                        if last_activity_time < activity_threshold:
                            # 超过阈值，视为不在线
                            continue
                        
                        # 获取用户信息
                        user_id = activity_data.get("user_id")
                        if not user_id:
                            continue
                        
                        user = await User.filter(id=user_id).first()
                        if not user or not user.is_active:
                            continue
                        
                        # 构建在线用户信息
                        login_time_str = activity_data.get("login_time")
                        login_time = datetime.fromisoformat(login_time_str) if login_time_str else None
                        
                        online_user = OnlineUserResponse(
                            user_id=user.id,
                            username=user.username,
                            email=user.email,
                            full_name=user.full_name,
                            tenant_id=activity_data.get("tenant_id", tenant_id) if tenant_id else activity_data.get("tenant_id"),
                            login_ip=activity_data.get("login_ip"),
                            login_time=login_time,
                            last_activity_time=last_activity_time,
                            session_id=None,  # JWT Token 没有会话ID
                        )
                        
                        online_users.append(online_user)
                    except Exception as e:
                        logger.warning(f"解析活动数据失败 {key}: {e}")
                        continue
                
                if cursor == 0:
                    break
            
            return online_users
        except Exception as e:
            logger.error(f"获取在线用户列表失败: {e}")
            return []
    
    @staticmethod
    async def get_online_user_by_user_id(
        tenant_id: int,
        user_id: int
    ) -> Optional[OnlineUserResponse]:
        """
        根据用户ID获取在线用户信息
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            Optional[OnlineUserResponse]: 在线用户信息，如果不存在则返回 None
        """
        try:
            activity_key = OnlineUserService._get_activity_key(tenant_id, user_id)
            activity_data_str = await cache.get(activity_key)
            
            if not activity_data_str:
                return None
            
            activity_data = json.loads(activity_data_str)
            
            # 检查最后活动时间
            last_activity_time_str = activity_data.get("last_activity_time")
            if not last_activity_time_str:
                return None
            
            last_activity_time = datetime.fromisoformat(last_activity_time_str)
            activity_threshold = datetime.now() - timedelta(minutes=OnlineUserService.ONLINE_THRESHOLD_MINUTES)
            
            if last_activity_time < activity_threshold:
                # 超过阈值，视为不在线
                return None
            
            # 获取用户信息
            user = await User.filter(id=user_id).first()
            if not user or not user.is_active:
                return None
            
            login_time_str = activity_data.get("login_time")
            login_time = datetime.fromisoformat(login_time_str) if login_time_str else None
            
            return OnlineUserResponse(
                user_id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                tenant_id=tenant_id,
                login_ip=activity_data.get("login_ip"),
                login_time=login_time,
                last_activity_time=last_activity_time,
                session_id=None,
            )
        except Exception as e:
            logger.warning(f"获取在线用户信息失败: {e}")
            return None
    
    @staticmethod
    async def force_logout(
        tenant_id: int,
        user_id: int
    ) -> bool:
        """
        强制用户下线
        
        删除 Redis 中的用户活动信息。
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            bool: 是否成功
        """
        try:
            activity_key = OnlineUserService._get_activity_key(tenant_id, user_id)
            await cache.delete(activity_key)
            return True
        except Exception as e:
            logger.warning(f"强制用户下线失败: {e}")
            return False
    
    @staticmethod
    async def get_online_user_statistics(
        tenant_id: Optional[int] = None
    ) -> OnlineUserStatisticsResponse:
        """
        获取在线用户统计
        
        Args:
            tenant_id: 组织ID（可选）
            
        Returns:
            OnlineUserStatisticsResponse: 在线用户统计信息
        """
        online_users = await OnlineUserService.list_online_users(tenant_id=tenant_id)
        
        total = len(online_users)
        
        # 统计活跃用户（最近5分钟有活动）
        active_threshold = datetime.now() - timedelta(minutes=5)
        active = sum(
            1 for user in online_users
            if user.last_activity_time and user.last_activity_time >= active_threshold
        )
        
        # 按组织统计
        by_tenant: Dict[str, int] = {}
        for user in online_users:
            tenant_id_key = str(user.tenant_id)
            by_tenant[tenant_id_key] = by_tenant.get(tenant_id_key, 0) + 1
        
        return OnlineUserStatisticsResponse(
            total=total,
            active=active,
            by_tenant=by_tenant
        )

