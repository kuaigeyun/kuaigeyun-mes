"""
组织服务模块

提供组织的 CRUD 操作和业务逻辑处理
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

from tortoise.exceptions import DoesNotExist, IntegrityError

from models.tenant import Tenant, TenantStatus, TenantPlan
from models.tenant_config import TenantConfig
from models.tenant_activity_log import TenantActivityLog
from schemas.tenant import TenantCreate, TenantUpdate
from core.query_filter import get_tenant_queryset
from core.package_config import get_package_config


class TenantService:
    """
    组织服务类
    
    提供组织的 CRUD 操作和业务逻辑处理。
    注意：组织管理通常需要超级管理员权限，可以跨组织访问。
    """
    
    async def create_tenant(self, data: TenantCreate) -> Tenant:
        """
        创建组织
        
        创建新组织并保存到数据库。如果域名已存在，则抛出异常。
        
        Args:
            data: 组织创建数据
            
        Returns:
            Tenant: 创建的组织对象
            
        Raises:
            IntegrityError: 当域名已存在时抛出
            
        Example:
            >>> service = TenantService()
            >>> tenant = await service.create_tenant(
            ...     TenantCreate(
            ...         name="测试组织",
            ...         domain="test",
            ...         status=TenantStatus.ACTIVE
            ...     )
            ... )
        """
        try:
            # 如果未指定 max_users 或 max_storage，根据套餐配置自动设置
            max_users = data.max_users
            max_storage = data.max_storage
            
            if max_users is None or max_storage is None:
                # 根据套餐配置获取默认限制
                package_config = get_package_config(data.plan)
                if max_users is None:
                    max_users = package_config["max_users"]
                if max_storage is None:
                    max_storage = package_config["max_storage_mb"]
            
            # 创建组织（组织表本身不包含 tenant_id，所以设置为 None）
            tenant = await Tenant.create(
                tenant_id=None,  # 组织表本身不需要 tenant_id
                name=data.name,
                domain=data.domain,
                status=data.status,
                plan=data.plan,
                settings=data.settings,
                max_users=max_users,
                max_storage=max_storage,
                expires_at=data.expires_at,
            )
            
            # 记录活动日志：组织创建
            await self._log_activity(
                tenant_id=tenant.id,
                action="create",
                description=f"组织创建：{data.name} (域名: {data.domain})",
                operator_id=None,  # 创建时可能没有操作人信息
                operator_name=None,
            )
            
            return tenant
        except IntegrityError as e:
            if "domain" in str(e).lower():
                raise ValueError(f"域名 {data.domain} 已存在")
            raise
    
    async def get_tenant_by_id(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True  # 组织查询需要跨组织访问
    ) -> Optional[Tenant]:
        """
        根据 ID 获取组织
        
        Args:
            tenant_id: 组织 ID
            skip_tenant_filter: 是否跳过组织过滤（组织查询需要跨组织访问，默认为 True）
            
        Returns:
            Optional[Tenant]: 组织对象，如果不存在则返回 None
        """
        queryset = get_tenant_queryset(
            Tenant,
            skip_tenant_filter=skip_tenant_filter
        )
        return await queryset.get_or_none(id=tenant_id)
    
    async def get_tenant_by_domain(
        self,
        domain: str,
        skip_tenant_filter: bool = True
    ) -> Optional[Tenant]:
        """
        根据域名获取组织
        
        Args:
            domain: 组织域名
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            Optional[Tenant]: 组织对象，如果不存在则返回 None
        """
        queryset = get_tenant_queryset(
            Tenant,
            skip_tenant_filter=skip_tenant_filter
        )
        return await queryset.get_or_none(domain=domain)
    
    async def list_tenants(
        self,
        page: int = 1,
        page_size: int = 10,
        status: Optional[TenantStatus] = None,
        plan: Optional[TenantPlan] = None,
        skip_tenant_filter: bool = True  # 组织列表需要跨组织访问
    ) -> Dict[str, Any]:
        """
        获取组织列表
        
        支持分页、状态筛选、套餐筛选。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            status: 组织状态筛选（可选）
            plan: 组织套餐筛选（可选）
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            dict: 包含 items、total、page、page_size 的字典
        """
        queryset = get_tenant_queryset(
            Tenant,
            skip_tenant_filter=skip_tenant_filter
        )
        
        # 添加筛选条件
        filters = {}
        if status is not None:
            filters["status"] = status
        if plan is not None:
            filters["plan"] = plan
        
        query = queryset.filter(**filters) if filters else queryset.all()
        
        # 计算总数
        total = await query.count()
        
        # 分页查询
        items = await query.offset((page - 1) * page_size).limit(page_size).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    async def update_tenant(
        self,
        tenant_id: int,
        data: TenantUpdate,
        skip_tenant_filter: bool = True
    ) -> Optional[Tenant]:
        """
        更新组织信息
        
        Args:
            tenant_id: 组织 ID
            data: 组织更新数据
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            Optional[Tenant]: 更新后的组织对象，如果不存在则返回 None
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            return None
        
        # 更新字段（只更新提供的字段）
        update_data = data.model_dump(exclude_unset=True)
        
        # 记录变更信息（用于日志）
        changes = []
        old_plan = tenant.plan
        old_status = tenant.status
        
        # 如果更新了套餐，自动更新 max_users 和 max_storage（如果未指定）
        if "plan" in update_data:
            new_plan = update_data["plan"]
            if "max_users" not in update_data or "max_storage" not in update_data:
                package_config = get_package_config(new_plan)
                if "max_users" not in update_data:
                    update_data["max_users"] = package_config["max_users"]
                if "max_storage" not in update_data:
                    update_data["max_storage"] = package_config["max_storage_mb"]
        
        for field, value in update_data.items():
            old_value = getattr(tenant, field, None)
            setattr(tenant, field, value)
            
            # 记录重要字段的变更
            if field == "plan" and old_value != value:
                changes.append(f"套餐变更：{old_plan.value} → {value.value}")
            elif field == "status" and old_value != value:
                changes.append(f"状态变更：{old_status.value} → {value.value}")
            elif field in ["name", "domain", "max_users", "max_storage"]:
                changes.append(f"{field} 变更：{old_value} → {value}")
        
        await tenant.save()
        
        # 记录活动日志：组织更新
        if changes:
            await self._log_activity(
                tenant_id=tenant_id,
                action="update",
                description=f"组织信息更新：{', '.join(changes)}",
                operator_id=None,  # 更新时可能没有操作人信息
                operator_name=None,
            )
        
        return tenant
    
    async def delete_tenant(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> bool:
        """
        删除组织（软删除）
        
        将组织状态设置为 SUSPENDED，而不是真正删除数据。
        
        Args:
            tenant_id: 组织 ID
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            bool: 如果删除成功则返回 True，否则返回 False
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            return False
        
        # 软删除：将状态设置为 SUSPENDED
        tenant.status = TenantStatus.SUSPENDED
        await tenant.save()
        
        # 记录活动日志：组织删除（软删除）
        await self._log_activity(
            tenant_id=tenant_id,
            action="delete",
            description=f"组织删除（软删除）：{tenant.name} (域名: {tenant.domain})",
            operator_id=None,
            operator_name=None,
        )
        
        return True
    
    async def activate_tenant(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> Optional[Tenant]:
        """
        激活组织
        
        Args:
            tenant_id: 组织 ID
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            Optional[Tenant]: 更新后的组织对象，如果不存在则返回 None
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            return None
        
        tenant.status = TenantStatus.ACTIVE
        await tenant.save()
        
        # 记录活动日志：组织激活
        await self._log_activity(
            tenant_id=tenant_id,
            action="activate",
            description=f"组织激活：{tenant.name} (域名: {tenant.domain})",
            operator_id=None,
            operator_name=None,
        )
        
        return tenant
    
    async def deactivate_tenant(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> Optional[Tenant]:
        """
        停用组织
        
        Args:
            tenant_id: 组织 ID
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            Optional[Tenant]: 更新后的组织对象，如果不存在则返回 None
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            return None
        
        tenant.status = TenantStatus.INACTIVE
        await tenant.save()
        
        # 记录活动日志：组织停用
        await self._log_activity(
            tenant_id=tenant_id,
            action="deactivate",
            description=f"组织停用：{tenant.name} (域名: {tenant.domain})",
            operator_id=None,
            operator_name=None,
        )
        
        return tenant
    
    async def get_tenant_config(
        self,
        tenant_id: int,
        config_key: str
    ) -> Optional[TenantConfig]:
        """
        获取组织配置
        
        Args:
            tenant_id: 组织 ID
            config_key: 配置键
            
        Returns:
            Optional[TenantConfig]: 配置对象，如果不存在则返回 None
        """
        queryset = get_tenant_queryset(
            TenantConfig,
            tenant_id=tenant_id
        )
        return await queryset.get_or_none(config_key=config_key)
    
    async def set_tenant_config(
        self,
        tenant_id: int,
        config_key: str,
        config_value: Dict[str, Any],
        description: Optional[str] = None
    ) -> TenantConfig:
        """
        设置组织配置
        
        如果配置已存在则更新，否则创建新配置。
        
        Args:
            tenant_id: 组织 ID
            config_key: 配置键
            config_value: 配置值
            description: 配置描述（可选）
            
        Returns:
            TenantConfig: 配置对象
        """
        config = await self.get_tenant_config(tenant_id, config_key)
        
        if config:
            # 更新现有配置
            config.config_value = config_value
            if description is not None:
                config.description = description
            await config.save()
        else:
            # 创建新配置
            config = await TenantConfig.create(
                tenant_id=tenant_id,
                config_key=config_key,
                config_value=config_value,
                description=description,
            )
        
        return config
    
    async def _log_activity(
        self,
        tenant_id: int,
        action: str,
        description: str,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None
    ) -> None:
        """
        记录组织活动日志（内部方法）
        
        记录组织的重要操作，便于审计和问题排查。
        
        Args:
            tenant_id: 组织 ID
            action: 操作类型（如：create, activate, deactivate, update_plan 等）
            description: 操作描述（详细说明）
            operator_id: 操作人 ID（可选）
            operator_name: 操作人名称（可选）
        """
        try:
            await TenantActivityLog.create(
                tenant_id=tenant_id,
                action=action,
                description=description,
                operator_id=operator_id,
                operator_name=operator_name,
            )
        except Exception as e:
            # 日志记录失败不应该影响主流程，只记录错误
            from loguru import logger
            logger.error(f"记录组织活动日志失败: {e}")
    
    async def get_tenant_activity_logs(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 10,
        action: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取组织活动日志列表
        
        支持分页和操作类型筛选。
        
        Args:
            tenant_id: 组织 ID
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            action: 操作类型筛选（可选）
            
        Returns:
            dict: 包含 items、total、page、page_size 的字典
        """
        queryset = TenantActivityLog.filter(tenant_id=tenant_id)
        
        # 添加操作类型筛选
        if action:
            queryset = queryset.filter(action=action)
        
        # 按创建时间倒序排列（最新的在前）
        queryset = queryset.order_by("-created_at")
        
        # 计算总数
        total = await queryset.count()
        
        # 分页查询
        items = await queryset.offset((page - 1) * page_size).limit(page_size).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    async def initialize_tenant_data(
        self,
        tenant_id: int
    ) -> None:
        """
        初始化组织数据
        
        在创建新组织后调用，初始化组织的默认数据（如默认角色、权限等）。
        此方法为占位方法，后续完善。
        
        Args:
            tenant_id: 组织 ID
        """
        # TODO: 实现组织数据初始化逻辑
        # 1. 创建默认角色
        # 2. 创建默认权限
        # 3. 创建默认配置
        pass

