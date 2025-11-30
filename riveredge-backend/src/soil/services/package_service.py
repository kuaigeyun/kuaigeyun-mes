"""
套餐服务模块

提供套餐的 CRUD 操作和业务逻辑处理
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

from tortoise.exceptions import DoesNotExist, IntegrityError

from soil.models.package import Package
from soil.models.tenant import TenantPlan
from soil.schemas.package import PackageCreate, PackageUpdate
from soil.core.package_config import get_package_config


class PackageService:
    """
    套餐服务类
    
    提供套餐的 CRUD 操作和业务逻辑处理。
    注意：套餐管理是平台级功能，不涉及组织隔离。
    """
    
    async def create_package(self, data: PackageCreate) -> Package:
        """
        创建套餐

        创建新套餐并保存到数据库。如果套餐类型已存在，则抛出异常。

        Args:
            data: 套餐创建数据

        Returns:
            Package: 创建的套餐对象

        Raises:
            IntegrityError: 当套餐类型已存在时抛出

        Example:
            >>> service = PackageService()
            >>> package = await service.create_package(
            ...     PackageCreate(
            ...         name="基础版",
            ...         plan=TenantPlan.BASIC,
            ...         max_users=50,
            ...         max_storage_mb=5120
            ...     )
            ... )
        """
        # 检查套餐类型是否已存在
        existing = await Package.get_or_none(plan=data.plan)
        if existing:
            raise IntegrityError(f"套餐类型 {data.plan} 已存在")

        # 获取数据字典，只包含非None值的字段
        # 这样可以避免传递null值给Tortoise ORM，让模型使用默认值
        create_data = data.model_dump(exclude_unset=True)
        # 额外过滤掉None值，确保数据完整性
        create_data = {k: v for k, v in create_data.items() if v is not None}

        package = await Package.create(
            **create_data
        )
        return package
    
    async def get_package_by_id(self, package_id: int) -> Optional[Package]:
        """
        根据 ID 获取套餐
        
        Args:
            package_id: 套餐 ID
            
        Returns:
            Optional[Package]: 套餐对象，如果不存在则返回 None
        """
        return await Package.get_or_none(id=package_id)
    
    async def get_package_by_plan(self, plan: TenantPlan) -> Optional[Package]:
        """
        根据套餐类型获取套餐
        
        Args:
            plan: 套餐类型
            
        Returns:
            Optional[Package]: 套餐对象，如果不存在则返回 None
        """
        return await Package.get_or_none(plan=plan)
    
    async def list_packages(
        self,
        page: int = 1,
        page_size: int = 10,
        plan: Optional[TenantPlan] = None,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        allow_pro_apps: Optional[bool] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None
    ) -> dict:
        """
        获取套餐列表
        
        支持分页、套餐类型筛选、名称搜索、状态筛选、排序等功能。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            plan: 套餐类型筛选（可选，精确匹配）
            name: 套餐名称搜索（可选，模糊搜索）
            is_active: 是否激活筛选（可选，精确匹配）
            allow_pro_apps: 是否允许PRO应用筛选（可选，精确匹配）
            sort: 排序字段（可选，如：name、plan、created_at、max_users）
            order: 排序顺序（可选，asc 或 desc）
            
        Returns:
            dict: 包含 items、total、page、page_size 的字典
        """
        # 获取查询集
        query = Package.all()
        
        # 应用精确匹配条件
        if plan is not None:
            query = query.filter(plan=plan)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if allow_pro_apps is not None:
            query = query.filter(allow_pro_apps=allow_pro_apps)
        
        # 应用文本字段的模糊搜索
        if name:
            query = query.filter(name__icontains=name)
        
        # 应用排序
        if sort:
            # 处理排序字段映射
            sort_field_map = {
                'name': 'name',
                'plan': 'plan',
                'created_at': 'created_at',
                'updated_at': 'updated_at',
                'max_users': 'max_users',
                'max_storage_mb': 'max_storage_mb',
            }
            sort_field = sort_field_map.get(sort, 'created_at')
            
            # 处理排序顺序
            if order and order.lower() == 'asc':
                query = query.order_by(sort_field)
            else:
                query = query.order_by(f'-{sort_field}')
        else:
            # 默认按创建时间倒序
            query = query.order_by('-created_at')
        
        # 获取总数（在分页前）
        total = await query.count()
        
        # 应用分页
        items = await query.offset((page - 1) * page_size).limit(page_size).all()
        
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size
        }
    
    async def update_package(
        self,
        package_id: int,
        data: PackageUpdate
    ) -> Optional[Package]:
        """
        更新套餐
        
        Args:
            package_id: 套餐 ID
            data: 套餐更新数据
            
        Returns:
            Optional[Package]: 更新后的套餐对象，如果不存在则返回 None
        """
        package = await Package.get_or_none(id=package_id)
        if not package:
            return None
        
        # 只更新提供的字段
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(package, field, value)
        
        await package.save()
        return package
    
    async def delete_package(self, package_id: int) -> bool:
        """
        删除套餐
        
        Args:
            package_id: 套餐 ID
            
        Returns:
            bool: 是否删除成功
        """
        package = await Package.get_or_none(id=package_id)
        if not package:
            return False
        
        await package.delete()
        return True
    
    async def get_package_config_for_plan(self, plan: TenantPlan) -> Dict[str, Any]:
        """
        获取套餐配置（从配置模块）
        
        从 package_config 模块获取套餐配置信息。
        
        Args:
            plan: 套餐类型
            
        Returns:
            Dict[str, Any]: 套餐配置字典
        """
        return get_package_config(plan)

