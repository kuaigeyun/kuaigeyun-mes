"""
用户偏好管理服务模块

提供用户偏好的 CRUD 操作和缓存功能。
"""

from typing import Optional, Dict, Any
from uuid import UUID

from tortoise.exceptions import DoesNotExist

from tree_root.models.user_preference import UserPreference
from tree_root.schemas.user_preference import UserPreferenceUpdate, UserPreferenceResponse
from soil.exceptions.exceptions import NotFoundError
from soil.infrastructure.cache.cache import cache


class UserPreferenceService:
    """
    用户偏好管理服务类
    
    提供用户偏好的 CRUD 操作和缓存功能。
    """
    
    @staticmethod
    def _get_cache_key(tenant_id: int, user_id: int) -> str:
        """生成缓存键"""
        return f"user_preference:{tenant_id}:{user_id}"
    
    @staticmethod
    async def get_user_preference(
        tenant_id: int,
        user_id: int,
        use_cache: bool = True
    ) -> UserPreferenceResponse:
        """
        获取用户偏好
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            use_cache: 是否使用缓存
            
        Returns:
            UserPreferenceResponse: 用户偏好对象
            
        Raises:
            NotFoundError: 当用户偏好不存在时抛出
        """
        cache_key = UserPreferenceService._get_cache_key(tenant_id, user_id)
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache.get(cache_key)
                if cached:
                    import json
                    # cache.get 返回的是字符串，需要解析
                    cached_data = json.loads(cached)
                    return UserPreferenceResponse.model_validate(cached_data)
            except Exception:
                # 缓存失败不影响主流程，静默处理
                pass
        
        # 从数据库获取
        try:
            user_preference = await UserPreference.get(
                tenant_id=tenant_id,
                user_id=user_id
            )
        except DoesNotExist:
            # 如果不存在，创建默认偏好设置
            user_preference = await UserPreference.create(
                tenant_id=tenant_id,
                user_id=user_id,
                preferences={}
            )
        
        result = UserPreferenceResponse.model_validate(user_preference)
        
        # 缓存结果
        if use_cache:
            try:
                import json
                await cache.set(cache_key, json.dumps(result.model_dump(mode='json'), ensure_ascii=False), expire=3600)  # 缓存1小时
            except Exception:
                # 缓存失败不影响主流程，静默处理
                pass
        
        return result
    
    @staticmethod
    async def update_user_preference(
        tenant_id: int,
        user_id: int,
        data: UserPreferenceUpdate
    ) -> UserPreferenceResponse:
        """
        更新用户偏好
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            data: 用户偏好更新数据
            
        Returns:
            UserPreferenceResponse: 更新后的用户偏好对象
            
        Raises:
            NotFoundError: 当用户偏好不存在时抛出
        """
        try:
            user_preference = await UserPreference.get(
                tenant_id=tenant_id,
                user_id=user_id
            )
        except DoesNotExist:
            # 如果不存在，创建新的偏好设置
            user_preference = await UserPreference.create(
                tenant_id=tenant_id,
                user_id=user_id,
                preferences=data.preferences or {}
            )
        else:
            # 更新偏好设置（合并）
            if data.preferences:
                current_preferences = user_preference.preferences or {}
                current_preferences.update(data.preferences)
                user_preference.preferences = current_preferences
                await user_preference.save()
        
        # 清除缓存
        cache_key = UserPreferenceService._get_cache_key(tenant_id, user_id)
        try:
            await cache.delete(cache_key)
        except Exception:
            # 缓存失败不影响主流程，静默处理
            pass
        
        return UserPreferenceResponse.model_validate(user_preference)

