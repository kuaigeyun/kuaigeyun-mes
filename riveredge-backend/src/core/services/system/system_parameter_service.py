"""
系统参数服务模块

提供系统参数的 CRUD 操作和 Redis 缓存管理。
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from tortoise.exceptions import IntegrityError
import json

from core.models.system_parameter import SystemParameter
from core.schemas.system_parameter import SystemParameterCreate, SystemParameterUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache import cache
from core.utils.timezone_utils import resolve_business_datetime


class SystemParameterService:
    """
    系统参数服务类
    
    提供系统参数的 CRUD 操作和 Redis 缓存管理。
    """
    
    @staticmethod
    def _get_cache_key(tenant_id: int, key: str) -> str:
        """
        获取缓存键
        
        Args:
            tenant_id: 组织ID
            key: 参数键
            
        Returns:
            str: 缓存键
        """
        return f"system_parameter:{tenant_id}:{key}"
    
    @staticmethod
    async def _get_from_cache(tenant_id: int, key: str) -> Optional[Any]:
        """
        从缓存获取参数值
        
        Args:
            tenant_id: 组织ID
            key: 参数键
            
        Returns:
            参数值，如果不存在返回 None
        """
        try:
            cache_key = SystemParameterService._get_cache_key(tenant_id, key)
            value = await cache.get(cache_key)
            if value:
                return json.loads(value)
        except Exception:
            # 缓存失败不影响主流程，静默处理
            pass
        return None
    
    @staticmethod
    async def _set_to_cache(tenant_id: int, key: str, value: Any, expire: int = 3600) -> None:
        """
        设置缓存
        
        Args:
            tenant_id: 组织ID
            key: 参数键
            value: 参数值
            expire: 过期时间（秒），默认 3600 秒（1小时）
        """
        try:
            cache_key = SystemParameterService._get_cache_key(tenant_id, key)
            await cache.set(cache_key, json.dumps(value, ensure_ascii=False), expire=expire)
        except Exception:
            # 缓存失败不影响主流程，静默处理
            pass
    
    @staticmethod
    async def _delete_from_cache(tenant_id: int, key: str) -> None:
        """
        删除缓存
        
        Args:
            tenant_id: 组织ID
            key: 参数键
        """
        try:
            cache_key = SystemParameterService._get_cache_key(tenant_id, key)
            await cache.delete(cache_key)
        except Exception:
            # 缓存失败不影响主流程，静默处理
            pass
    
    @staticmethod
    async def get_parameter(
        tenant_id: int,
        key: str,
        use_cache: bool = True
    ) -> Optional[SystemParameter]:
        """
        获取参数（优先从缓存读取）
        
        Args:
            tenant_id: 组织ID
            key: 参数键
            use_cache: 是否使用缓存
            
        Returns:
            SystemParameter: 参数对象，如果不存在返回 None
        """
        # 尝试从缓存读取
        if use_cache:
            cached_value = await SystemParameterService._get_from_cache(tenant_id, key)
            if cached_value is not None:
                # 缓存命中，从数据库获取完整对象
                parameter = await SystemParameter.filter(
                    tenant_id=tenant_id,
                    key=key,
                    deleted_at__isnull=True,
                    is_active=True
                ).first()
                if parameter:
                    return parameter
        
        # 从数据库读取
        parameter = await SystemParameter.filter(
            tenant_id=tenant_id,
            key=key,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        # 写入缓存
        if parameter and use_cache:
            await SystemParameterService._set_to_cache(
                tenant_id, key, parameter.get_value()
            )
        
        return parameter
    
    @staticmethod
    async def get_parameter_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> SystemParameter:
        """
        根据UUID获取参数
        
        Args:
            tenant_id: 组织ID
            uuid: 参数UUID
            
        Returns:
            SystemParameter: 参数对象
            
        Raises:
            NotFoundError: 当参数不存在时抛出
        """
        parameter = await SystemParameter.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not parameter:
            raise NotFoundError("参数不存在")
        
        return parameter
    
    @staticmethod
    async def list_parameters(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[SystemParameter]:
        """
        获取参数列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[SystemParameter]: 参数列表
        """
        query = SystemParameter.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("-created_at")
    
    @staticmethod
    async def create_parameter(
        tenant_id: int,
        data: SystemParameterCreate
    ) -> SystemParameter:
        """
        创建参数
        
        Args:
            tenant_id: 组织ID
            data: 参数创建数据
            
        Returns:
            SystemParameter: 创建的参数对象
            
        Raises:
            ValidationError: 当参数键已存在时抛出
        """
        try:
            parameter = SystemParameter(
                tenant_id=tenant_id,
                key=data.key,
                type=data.type,
                description=data.description,
                is_system=data.is_system,
                is_active=data.is_active
            )
            parameter.set_value(data.value)
            await parameter.save()
            
            # 写入缓存
            await SystemParameterService._set_to_cache(
                tenant_id, data.key, parameter.get_value()
            )
            
            return parameter
        except IntegrityError:
            raise ValidationError(f"参数键 {data.key} 已存在")
    
    @staticmethod
    async def update_parameter(
        tenant_id: int,
        uuid: str,
        data: SystemParameterUpdate
    ) -> SystemParameter:
        """
        更新参数
        
        Args:
            tenant_id: 组织ID
            uuid: 参数UUID
            data: 参数更新数据
            
        Returns:
            SystemParameter: 更新后的参数对象
            
        Raises:
            NotFoundError: 当参数不存在时抛出
        """
        parameter = await SystemParameterService.get_parameter_by_uuid(tenant_id, uuid)
        
        if data.value is not None:
            parameter.set_value(data.value)
        if data.description is not None:
            parameter.description = data.description
        if data.is_active is not None:
            parameter.is_active = data.is_active
        
        await parameter.save()
        
        # 更新缓存
        await SystemParameterService._set_to_cache(
            tenant_id, parameter.key, parameter.get_value()
        )
        
        return parameter
    
    @staticmethod
    async def delete_parameter(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除参数（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 参数UUID
            
        Raises:
            NotFoundError: 当参数不存在时抛出
            ValidationError: 当参数是系统参数时抛出
        """
        parameter = await SystemParameterService.get_parameter_by_uuid(tenant_id, uuid)
        
        if parameter.is_system:
            raise ValidationError("系统参数不可删除")
        
        # 软删除
        from datetime import datetime
        parameter.deleted_at = resolve_business_datetime()
        await parameter.save()
        
        # 删除缓存
        await SystemParameterService._delete_from_cache(tenant_id, parameter.key)
    
    @staticmethod
    async def batch_update_parameters(
        tenant_id: int,
        updates: Dict[str, Any]
    ) -> List[SystemParameter]:
        """
        批量更新参数
        
        Args:
            tenant_id: 组织ID
            updates: 更新字典，key 为参数键，value 为参数值
            
        Returns:
            List[SystemParameter]: 更新后的参数列表
        """
        parameters = []
        for key, value in updates.items():
            parameter = await SystemParameterService.get_parameter(
                tenant_id, key, use_cache=False
            )
            if parameter:
                parameter.set_value(value)
                await parameter.save()
                parameters.append(parameter)
                
                # 更新缓存
                await SystemParameterService._set_to_cache(
                    tenant_id, key, parameter.get_value()
                )
        
        return parameters

