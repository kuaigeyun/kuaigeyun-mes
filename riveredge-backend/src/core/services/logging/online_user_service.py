"""
在线用户管理服务模块

提供在线用户的查询和会话管理功能。
从 PostgreSQL 用户活动表读取数据，判断用户是否在线。
"""

from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone

from loguru import logger
from core.models.user_activity import UserActivity
from core.schemas.online_user import (
    OnlineUserResponse,
    OnlineUserListResponse,
    OnlineUserStatisticsResponse,
)
from infra.models.user import User


class OnlineUserService:
    """
    在线用户管理服务类
    
    提供在线用户的查询和会话管理功能。
    从 PostgreSQL 用户活动表读取数据，判断用户是否在线。
    """
    
    # 在线用户判断阈值（最近30分钟有活动视为在线）
    ONLINE_THRESHOLD_MINUTES = 30

    @staticmethod
    def _to_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
        """
        将任意 datetime 规范为 UTC 感知时间，避免 naive/aware 比较异常。
        """
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    
    @staticmethod
    async def update_user_activity(
        tenant_id: Optional[int],
        user_id: int,
        login_ip: Optional[str] = None,
        login_time: Optional[datetime] = None,
    ) -> None:
        """
        更新用户活动时间
        
        在用户每次 API 请求时调用，更新用户最后活动时间。
        
        Args:
            tenant_id: 组织ID (平台超级管理员可为 None)
            user_id: 用户ID
            login_ip: 登录IP（可选）
            login_time: 登录时间（可选，首次登录时设置）
        """
        try:
            now = datetime.now(timezone.utc)
            expire_seconds = (OnlineUserService.ONLINE_THRESHOLD_MINUTES + 10) * 60
            expires_at = now + timedelta(seconds=expire_seconds)
            entry = await UserActivity.filter(tenant_id=tenant_id, user_id=user_id).first()
            if entry:
                entry.last_activity_time = now
                entry.login_ip = login_ip or entry.login_ip
                entry.login_time = login_time or entry.login_time or now
                entry.expires_at = expires_at
                await entry.save()
            else:
                await UserActivity.create(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    last_activity_time=now,
                    login_ip=login_ip,
                    login_time=login_time or now,
                    expires_at=expires_at,
                )
            logger.info(
                "✅ 已更新用户活动状态: tenant_id={}, user_id={}, IP={}, 过期时间={}s",
                tenant_id,
                user_id,
                login_ip,
                expire_seconds,
            )
        except Exception as e:
            logger.error(f"❌ 更新用户活动时间失败: {e}", exc_info=True)
    
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
            online_users = []
            activity_threshold = datetime.now(timezone.utc) - timedelta(minutes=OnlineUserService.ONLINE_THRESHOLD_MINUTES)
            query = UserActivity.filter(last_activity_time__gte=activity_threshold)
            if tenant_id is not None:
                query = query.filter(tenant_id=tenant_id)
            activities = await query.all()

            for activity in activities:
                try:
                    logger.info(f"检查活动记录: user_id={activity.user_id}, tenant_id={activity.tenant_id}")
                    last_activity_time = OnlineUserService._to_utc_aware(activity.last_activity_time)
                    if not last_activity_time:
                        logger.debug(f"用户 {activity.user_id} 无最后活动时间")
                        continue
                    if last_activity_time < activity_threshold:
                        logger.debug(f"用户 {activity.user_id} 活动已过期")
                        continue
                    user_id = activity.user_id
                    user = await User.get_or_none(id=user_id)
                    if not user:
                        logger.warning(f"找不到用户记录: user_id={user_id}")
                        continue
                    if not user.is_active:
                        logger.debug(f"用户 {user_id} 不处于活跃状态")
                        continue
                    online_user = OnlineUserResponse(
                        user_id=user.id,
                        username=user.username,
                        email=user.email,
                        full_name=user.full_name,
                        tenant_id=activity.tenant_id
                        if activity.tenant_id is not None
                        else tenant_id,
                        login_ip=activity.login_ip,
                        login_time=activity.login_time,
                        last_activity_time=last_activity_time,
                        session_id=None,  # JWT Token 没有会话ID
                    )
                    online_users.append(online_user)
                except Exception as e:
                    logger.warning(f"解析活动数据失败 user_id={activity.user_id}: {e}", exc_info=True)
                    continue
            
            logger.info(f"查询到 {len(online_users)} 个在线用户")
            return online_users
        except Exception as e:
            logger.error(f"获取在线用户列表失败: {e}", exc_info=True)
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
            activity = await UserActivity.filter(tenant_id=tenant_id, user_id=user_id).first()
            if not activity:
                return None
            last_activity_time = OnlineUserService._to_utc_aware(activity.last_activity_time)
            if not last_activity_time:
                return None
            activity_threshold = datetime.now(timezone.utc) - timedelta(minutes=OnlineUserService.ONLINE_THRESHOLD_MINUTES)
            if last_activity_time < activity_threshold:
                return None
            user = await User.filter(id=user_id).first()
            if not user or not user.is_active:
                return None
            return OnlineUserResponse(
                user_id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                tenant_id=activity.tenant_id
                if activity.tenant_id is not None
                else tenant_id,
                login_ip=activity.login_ip,
                login_time=activity.login_time,
                last_activity_time=last_activity_time,
                session_id=None,
            )
        except Exception as e:
            logger.warning(f"获取在线用户信息失败: {e}")
            return None

    @staticmethod
    async def is_user_online(
        tenant_id: int,
        user_id: int,
        threshold_minutes: int = 30,
    ) -> bool:
        """
        判断用户是否在线

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            threshold_minutes: 在线判断阈值（分钟）

        Returns:
            bool: 是否在线
        """
        try:
            activity = await UserActivity.filter(tenant_id=tenant_id, user_id=user_id).first()
            if not activity:
                return False
            
            activity_threshold = (
                datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
            )
            last_activity_time = OnlineUserService._to_utc_aware(activity.last_activity_time)
            if not last_activity_time:
                return False
            return last_activity_time >= activity_threshold
        except Exception as e:
            logger.error(f"判断用户在线状态失败: {e}")
            return False
    
    @staticmethod
    async def force_logout(
        tenant_id: int,
        user_id: int
    ) -> bool:
        """
        强制用户下线
        
        删除用户活动记录。
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            bool: 是否成功
        """
        try:
            return await UserActivity.filter(tenant_id=tenant_id, user_id=user_id).delete() > 0
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
        active_threshold = datetime.now(timezone.utc) - timedelta(minutes=5)
        active = 0
        for user in online_users:
            normalized_last_activity = OnlineUserService._to_utc_aware(user.last_activity_time)
            if normalized_last_activity and normalized_last_activity >= active_threshold:
                active += 1
        
        # 按组织统计
        by_tenant: Dict[str, int] = {}
        for user in online_users:
            tid = user.tenant_id
            tenant_id_key = str(tid) if tid is not None else "_"
            by_tenant[tenant_id_key] = by_tenant.get(tenant_id_key, 0) + 1
            
        return OnlineUserStatisticsResponse(
            total=total,
            active=active,
            by_tenant=by_tenant,
            today_active=0,
            yesterday_active=0,
            trend_data=[],
        )

    @staticmethod
    async def cleanup_expired_activities() -> None:
        """定时任务：清理已过期的在线用户活动记录。"""
        try:
            now = datetime.now(timezone.utc)
            deleted_count = await UserActivity.filter(expires_at__lt=now).delete()
            if deleted_count > 0:
                logger.info(f"🧹 在线用户清理任务：已清理 {deleted_count} 条过期记录")
        except Exception as e:
            logger.error(f"在线用户清理任务执行失败: {e}")

