"""
组织服务模块

提供组织的 CRUD 操作和业务逻辑处理
"""

import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger

from tortoise.exceptions import DoesNotExist, IntegrityError
from tortoise.functions import Max, Count
from tortoise.backends.base.client import BaseDBAsyncClient

from infra.models.tenant import Tenant, TenantStatus, TenantPlan
from infra.models.user import User
from core.models.login_log import LoginLog
from infra.models.tenant_config import TenantConfig
from infra.models.tenant_activity_log import TenantActivityLog
from infra.schemas.tenant import TenantCreate, TenantUpdate
from infra.domain.query_filter import get_tenant_queryset
from infra.services.package_service import PackageService
from infra.exceptions.exceptions import tenant_name_already_exists, TenantError, ValidationError


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
        # 检查组织名称是否已存在（名称不能重复）
        tenant_name = (data.name or "").strip()
        if not tenant_name:
            raise TenantError("组织名称不能为空")
        from infra.domain.tenant.reserved_tenant_domain import normalize_tenant_domain

        data.domain = normalize_tenant_domain(str(data.domain or "").strip())
        if await Tenant.filter(name__iexact=tenant_name).exists():
            raise tenant_name_already_exists(tenant_name)

        parent_tenant_id = data.parent_tenant_id
        is_subtenant = parent_tenant_id is not None
        if parent_tenant_id is not None:
            parent_tenant = await Tenant.get_or_none(id=parent_tenant_id)
            if not parent_tenant:
                raise ValidationError("父组织不存在，无法创建子组织")
            # 层级硬规则：仅允许两级（主组织 -> 子组织）。
            if parent_tenant.is_subtenant:
                raise ValidationError("子组织不允许再创建下级组织")

        try:
            # 如果未指定 max_users 或 max_storage，根据套餐配置自动设置
            max_users = data.max_users
            max_storage = data.max_storage
            
            if max_users is None or max_storage is None:
                # 根据套餐配置获取默认限制（DB 优先，静态配置兜底）
                package_config = await PackageService().get_effective_package_config_for_plan(data.plan)
                if max_users is None:
                    max_users = package_config["max_users"]
                if max_storage is None:
                    max_storage = package_config["max_storage_mb"]
            
            # 创建组织（组织表本身不包含 tenant_id，所以设置为 None）
            tenant = await Tenant.create(
                tenant_id=None,  # 组织表本身不需要 tenant_id
                name=tenant_name,
                domain=data.domain,
                status=data.status,
                plan=data.plan,
                settings=data.settings,
                parent_tenant_id=parent_tenant_id,
                is_subtenant=is_subtenant,
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

            if parent_tenant_id is not None:
                await self._log_activity(
                    tenant_id=parent_tenant_id,
                    action="create_subtenant",
                    description=f"新增子组织：{tenant.name} (ID: {tenant.id}, 域名: {tenant.domain})",
                    operator_id=None,
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
        parent_tenant_id: Optional[int] = None,
        is_subtenant: Optional[bool] = None,
        name: Optional[str] = None,
        domain: Optional[str] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        skip_tenant_filter: bool = True  # 组织列表需要跨组织访问
    ) -> Dict[str, Any]:
        """
        获取组织列表
        
        支持分页、状态筛选、套餐筛选、文本字段模糊搜索、排序。
        使用 ProTable 原生搜索逻辑，简单可靠。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            status: 组织状态筛选（可选，精确匹配）
            plan: 组织套餐筛选（可选，精确匹配）
            name: 组织名称搜索（可选，模糊搜索）
            domain: 域名搜索（可选，模糊搜索）
            sort: 排序字段（可选，如：name、status、created_at）
            order: 排序顺序（可选，asc 或 desc）
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）
            
        Returns:
            dict: 包含 items、total、page、page_size 的字典
        """
        # ⭐ 恢复为 ProTable 原生搜索逻辑：简单的字段过滤
        # 不使用复杂的搜索工具，直接使用 Tortoise ORM 的简单查询
        
        # 获取查询集
        query = Tenant.all()
        if not skip_tenant_filter:
            # 如果不需要跳过组织过滤，这里可以添加组织过滤逻辑
            # 但对于超级管理员，通常 skip_tenant_filter=True
            pass
        
        # 应用精确匹配条件（status、plan）
        if status is not None:
            query = query.filter(status=status)
        if plan is not None:
            query = query.filter(plan=plan)
        if parent_tenant_id is not None:
            query = query.filter(parent_tenant_id=parent_tenant_id)
        if is_subtenant is not None:
            query = query.filter(is_subtenant=is_subtenant)
        
        # 应用文本字段的模糊搜索（name、domain）
        # ProTable 默认对文本字段使用模糊搜索
        if name:
            query = query.filter(name__icontains=name.strip())
        if domain:
            query = query.filter(domain__icontains=domain.strip())
        
        # 应用排序
        if sort:
            # 验证排序字段是否允许
            allowed_sort_fields = [
                'id', 'name', 'domain', 'status', 'plan',
                'is_subtenant', 'parent_tenant_id',
                'max_users', 'max_storage', 'created_at', 'updated_at'
            ]
            if sort in allowed_sort_fields:
                if order == 'desc':
                    query = query.order_by(f'-{sort}')
                else:
                    query = query.order_by(sort)
            else:
                # 默认排序
                query = query.order_by('-created_at')
        else:
            # 默认排序
            query = query.order_by('-created_at')
        
        # 分页查询
        total = await query.count()
        offset = (page - 1) * page_size
        items = await query.offset(offset).limit(page_size).all()

        last_login_map = await self._get_tenant_last_login_map([t.id for t in items])
        user_count_map = await self._get_tenant_user_count_map([t.id for t in items])
        for tenant in items:
            setattr(tenant, "last_login_at", last_login_map.get(tenant.id))
            setattr(tenant, "user_count", user_count_map.get(tenant.id, 0))
        
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size
        }

    async def _get_tenant_last_login_map(self, tenant_ids: List[int]) -> Dict[int, datetime]:
        """批量查询各组织最后登录时间（取成功登录日志的最新时间）。"""
        if not tenant_ids:
            return {}

        rows = await LoginLog.filter(
            tenant_id__in=tenant_ids,
            login_status="success",
        ).group_by("tenant_id").annotate(last_login_at=Max("created_at")).values(
            "tenant_id", "last_login_at"
        )

        return {row["tenant_id"]: row["last_login_at"] for row in rows}

    async def _get_tenant_user_count_map(self, tenant_ids: List[int]) -> Dict[int, int]:
        """批量查询各组织已使用用户数（未删除用户）。"""
        if not tenant_ids:
            return {}

        rows = await User.filter(
            tenant_id__in=tenant_ids,
            deleted_at__isnull=True,
        ).group_by("tenant_id").annotate(user_count=Count("id")).values(
            "tenant_id", "user_count"
        )

        return {row["tenant_id"]: row["user_count"] for row in rows}

    async def resolve_root_tenant(self, tenant_id: int) -> Tenant:
        """
        解析共享配额主组织。

        若传入子组织，则返回其父组织；若传入主组织则返回自身。
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise ValidationError("组织不存在")
        if not tenant.is_subtenant:
            return tenant
        if not tenant.parent_tenant_id:
            raise ValidationError("子组织缺少父组织配置，请先修复组织关系")
        root_tenant = await Tenant.get_or_none(id=tenant.parent_tenant_id)
        if not root_tenant:
            raise ValidationError("父组织不存在，请先修复组织关系")
        return root_tenant

    async def get_shared_user_quota_summary(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取主组织共享用户池统计。

        统计口径：主组织 + 全部直属子组织的“启用且未删除”用户总数。
        """
        root_tenant = await self.resolve_root_tenant(tenant_id)
        if root_tenant.is_subtenant:
            raise ValidationError("共享配额统计仅支持主组织")

        subtenants = await Tenant.filter(
            parent_tenant_id=root_tenant.id,
        ).all()
        tenant_list = [root_tenant, *subtenants]
        tenant_ids = [t.id for t in tenant_list]

        rows = await User.filter(
            tenant_id__in=tenant_ids,
            deleted_at__isnull=True,
            is_active=True,
        ).group_by("tenant_id").annotate(user_count=Count("id")).values("tenant_id", "user_count")
        count_map = {row["tenant_id"]: row["user_count"] for row in rows}

        tenants_usage = []
        used_users = 0
        for tenant in tenant_list:
            user_count = count_map.get(tenant.id, 0)
            used_users += user_count
            tenants_usage.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.name,
                "is_subtenant": bool(tenant.is_subtenant),
                "user_count": user_count,
            })

        max_users = int(root_tenant.max_users or 0)
        remaining_users = max(max_users - used_users, 0)
        return {
            "root_tenant_id": root_tenant.id,
            "root_tenant_name": root_tenant.name,
            "max_users": max_users,
            "used_users": used_users,
            "remaining_users": remaining_users,
            "over_quota": used_users > max_users,
            "tenants": tenants_usage,
        }

    async def sync_tenant_limits_from_plan(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True,
    ) -> Dict[str, Any]:
        """
        按组织当前套餐同步 max_users / max_storage。

        若同步后配额低于已启用用户数，不删除或停用已有用户，但后续新增/启用用户将被拒绝，
        直至有效用户数降至配额以下。
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            raise ValidationError("组织不存在")

        root_tenant = await self.resolve_root_tenant(tenant_id)
        package_config = await PackageService().get_effective_package_config_for_plan(
            root_tenant.plan
        )
        previous_max_users = int(root_tenant.max_users or 0)
        previous_max_storage = int(root_tenant.max_storage or 0)
        new_max_users = int(package_config["max_users"])
        new_max_storage = int(package_config["max_storage_mb"])

        root_tenant.max_users = new_max_users
        root_tenant.max_storage = new_max_storage
        await root_tenant.save(update_fields=["max_users", "max_storage"])

        summary = await self.get_shared_user_quota_summary(root_tenant.id)

        await self._log_activity(
            tenant_id=root_tenant.id,
            action="sync_limits_from_plan",
            description=(
                f"从套餐 {root_tenant.plan.value} 同步配额："
                f"用户数 {previous_max_users} → {new_max_users}，"
                f"存储 {previous_max_storage}MB → {new_max_storage}MB"
                + (
                    f"；当前已用 {summary['used_users']}，超配额"
                    if summary["over_quota"]
                    else ""
                )
            ),
            operator_id=None,
            operator_name=None,
        )

        return {
            "tenant_id": root_tenant.id,
            "plan": root_tenant.plan.value,
            "max_users": new_max_users,
            "max_storage": new_max_storage,
            "previous_max_users": previous_max_users,
            "previous_max_storage": previous_max_storage,
            "used_users": summary["used_users"],
            "remaining_users": summary["remaining_users"],
            "over_quota": summary["over_quota"],
        }

    async def assert_shared_user_quota_capacity(
        self,
        tenant_id: int,
        increment: int = 1,
        using_db: Optional[BaseDBAsyncClient] = None,
    ) -> None:
        """
        校验共享用户池容量是否足够新增/启用用户。

        Args:
            tenant_id: 目标组织 ID（可传主组织或子组织）
            increment: 本次新增占用数量
        """
        if increment <= 0:
            return
        tenant_query = Tenant.filter(id=tenant_id)
        if using_db is not None:
            tenant_query = tenant_query.using_db(using_db)
        tenant = await tenant_query.first()
        if not tenant:
            raise ValidationError("组织不存在")

        root_tenant_id = tenant.parent_tenant_id if tenant.is_subtenant else tenant.id
        if not root_tenant_id:
            raise ValidationError("子组织缺少父组织配置，请先修复组织关系")

        root_query = Tenant.filter(id=root_tenant_id)
        if using_db is not None:
            root_query = root_query.using_db(using_db)
        root_tenant = await root_query.select_for_update().first()
        if not root_tenant:
            raise ValidationError("父组织不存在，请先修复组织关系")

        subtenant_query = Tenant.filter(
            parent_tenant_id=root_tenant.id,
        )
        if using_db is not None:
            subtenant_query = subtenant_query.using_db(using_db)
        subtenants = await subtenant_query.all()
        tenant_ids = [root_tenant.id, *[item.id for item in subtenants]]

        user_query = User.filter(
            tenant_id__in=tenant_ids,
            deleted_at__isnull=True,
            is_active=True,
        )
        if using_db is not None:
            user_query = user_query.using_db(using_db)
        used_users = int(await user_query.count())
        max_users = int(root_tenant.max_users or 0)
        after_used = used_users + increment
        if after_used <= max_users:
            return
        overflow = after_used - max_users
        await self._log_activity(
            tenant_id=root_tenant.id,
            action="shared_quota_reject",
            description=(
                f"共享配额校验拒绝：已用 {used_users}/{max_users}，"
                f"请求新增 {increment}，超出 {overflow}"
            ),
            operator_id=None,
            operator_name=None,
        )
        raise ValidationError(
            "主组织共享用户配额不足："
            f"已用 {used_users}/{max_users}，"
            f"本次需新增 {increment}，"
            f"超出 {overflow}。"
        )
    
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

        # 若更新了组织名称，检查名称是否与其他组织重复
        if "name" in update_data:
            new_name = (update_data["name"] or "").strip()
            if not new_name:
                raise TenantError("组织名称不能为空")
            existing = await Tenant.filter(name__iexact=new_name).exclude(id=tenant_id).exists()
            if existing:
                raise tenant_name_already_exists(new_name)
            update_data["name"] = new_name

        if "domain" in update_data:
            from infra.domain.tenant.reserved_tenant_domain import normalize_tenant_domain

            update_data["domain"] = normalize_tenant_domain(str(update_data["domain"] or "").strip())

        # 记录变更信息（用于日志）
        changes = []
        old_plan = tenant.plan
        old_status = tenant.status
        
        # 如果更新了套餐，配额与存储上限跟随新套餐（唯一真源：tenant.max_users / tenant.max_storage）
        if "plan" in update_data and update_data["plan"] != tenant.plan:
            package_config = await PackageService().get_effective_package_config_for_plan(
                update_data["plan"]
            )
            update_data["max_users"] = package_config["max_users"]
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
        删除组织

        仅已暂停且无业务单据的组织允许删除；否则抛出 ValidationError。
        删除时将组织从系统中物理移除。

        Args:
            tenant_id: 组织 ID
            skip_tenant_filter: 是否跳过组织过滤（默认为 True）

        Returns:
            bool: 如果删除成功则返回 True，否则返回 False

        Raises:
            ValidationError: 组织仍存在业务单据时抛出
        """
        tenant = await self.get_tenant_by_id(tenant_id, skip_tenant_filter=skip_tenant_filter)
        if not tenant:
            return False

        if tenant.status != TenantStatus.SUSPENDED:
            raise ValidationError("仅已暂停状态的组织可删除，请先停用组织")

        from infra.services.tenant_business_document_service import (
            TenantBusinessDocumentService,
        )

        summary = await TenantBusinessDocumentService.summarize_business_documents(tenant_id)
        if summary["total"] > 0:
            raise ValidationError(
                TenantBusinessDocumentService.format_blocking_message(tenant.name, summary)
            )

        tenant_name = tenant.name
        tenant_domain = tenant.domain

        await self._log_activity(
            tenant_id=tenant_id,
            action="delete",
            description=f"组织删除：{tenant_name} (域名: {tenant_domain})",
            operator_id=None,
            operator_name=None,
        )

        await tenant.delete()
        
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
        
        tenant.status = TenantStatus.SUSPENDED
        await tenant.save()
        
        # 记录活动日志：组织停用（已暂停）
        await self._log_activity(
            tenant_id=tenant_id,
            action="deactivate",
            description=f"组织停用（已暂停）：{tenant.name} (域名: {tenant.domain})",
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
            # 使用嵌套事务（SAVEPOINT）：写日志失败时回滚子事务，
            # 避免 PostgreSQL「当前事务已中止」拖垮组织创建/更新主流程。
            from tortoise.transactions import in_transaction

            async with in_transaction():
                await TenantActivityLog.create(
                    tenant_id=tenant_id,
                    action=action,
                    description=description,
                    operator_id=operator_id,
                    operator_name=operator_name,
                )
        except Exception as e:
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
        tenant_id: int,
        init_data_options: Optional[List[str]] = None,
        current_user_id: Optional[int] = None,
        industry_preset: Optional[str] = None,
    ) -> None:
        """
        初始化组织数据

        在创建新组织后调用，初始化组织的默认数据。
        使用 TenantInitDataService 统一管理，支持必选/可选划分。

        Args:
            tenant_id: 组织 ID
            init_data_options: 可选初始化项 key 列表。None 或 [] 表示仅加载系统级必选数据
            current_user_id: 当前用户ID（部门/职位/角色等预设需要，可选）
        """
        from core.services.tenant.tenant_init_data_service import TenantInitDataService
        from infra.domain.tenant_context import set_current_tenant_id

        await TenantInitDataService.set_tenant_data_initializing(tenant_id, True)
        try:
            await self._initialize_tenant_data_body(
                tenant_id,
                init_data_options=init_data_options,
                current_user_id=current_user_id,
                industry_preset=industry_preset,
            )
        finally:
            await TenantInitDataService.set_tenant_data_initializing(tenant_id, False)

    async def _initialize_tenant_data_body(
        self,
        tenant_id: int,
        init_data_options: Optional[List[str]] = None,
        current_user_id: Optional[int] = None,
        industry_preset: Optional[str] = None,
    ) -> None:
        from core.services.tenant.tenant_init_data_service import TenantInitDataService
        from infra.domain.tenant_context import set_current_tenant_id

        # 设置组织上下文，确保初始化过程中的查询使用正确的 tenant_id
        set_current_tenant_id(tenant_id)

        # 站点名称与组织名称一致（创建时写入，非运行时兜底）
        tenant = await Tenant.get_or_none(id=tenant_id)
        if tenant:
            from core.schemas.site_setting import SiteSettingUpdate
            from core.services.system.site_setting_service import SiteSettingService
            await SiteSettingService.update_settings(
                tenant_id,
                SiteSettingUpdate(settings={"site_name": tenant.name}),
            )

        # 0. 应用注册与启用（平台新建组织流程；租户「初始项加载」不包含此项）
        try:
            count = await TenantInitDataService.run_single(tenant_id, "application")
            logger.info(f"组织 {tenant_id} 应用注册完成，处理 {count} 项")
        except Exception as e:
            logger.error(f"组织 {tenant_id} 应用注册失败: {e}")
            import traceback
            logger.error(traceback.format_exc())

        # 1. 执行必选初始化（含菜单同步，不含应用注册）
        try:
            await TenantInitDataService.run_required(tenant_id)
            logger.info(f"组织 {tenant_id} 必选数据初始化完成")
        except Exception as e:
            logger.error(f"组织 {tenant_id} 必选数据初始化失败: {e}")
            import traceback
            logger.error(traceback.format_exc())

        # 1.1 KU-AI 出厂默认 FAQ（幂等，新组织自动写入）
        try:
            from apps.kuaiai.services.faq_seed_service import FaqSeedService

            faq_count = await FaqSeedService.seed_default_faqs(
                tenant_id,
                user_id=current_user_id,
            )
            if faq_count:
                logger.info(f"组织 {tenant_id} KU-AI 默认 FAQ 已写入 {faq_count} 条")
        except Exception as e:
            logger.warning(f"组织 {tenant_id} KU-AI 默认 FAQ 写入跳过: {e}")

        # 2. 执行可选初始化或行业预设
        if industry_preset:
            try:
                await TenantInitDataService.run_industry_preset(
                    tenant_id=tenant_id,
                    industry_code=industry_preset,
                    current_user_id=current_user_id,
                )
                logger.info(f"组织 {tenant_id} 行业预设初始化完成: {industry_preset}")
            except Exception as e:
                logger.error(f"组织 {tenant_id} 行业预设初始化失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
        else:
            # 未指定或未勾选时仅加载系统级必选数据，业务预置须显式勾选或选择行业预设
            optional_keys = init_data_options or []

            if optional_keys:
                try:
                    await TenantInitDataService.run_optional(
                        tenant_id=tenant_id,
                        selected_keys=optional_keys,
                        current_user_id=current_user_id,
                    )
                    logger.info(f"组织 {tenant_id} 可选数据初始化完成: {optional_keys}")
                except Exception as e:
                    logger.error(f"组织 {tenant_id} 可选数据初始化失败: {e}")
                    import traceback
                    logger.error(traceback.format_exc())

        # 3. 写入默认站点/向导设置并标记引导完成
        try:
            from core.services.tenant.tenant_init_data_service import TenantInitDataService
            await TenantInitDataService.complete_bootstrap(tenant_id)
        except Exception as e:
            logger.warning(f"组织 {tenant_id} 自动完成引导初始化失败（不中断流程）: {e}")


async def initialize_tenant_data_background(
    tenant_id: int,
    init_data_options: Optional[List[str]] = None,
    current_user_id: Optional[int] = None,
    industry_preset: Optional[str] = None,
) -> None:
    """后台初始化组织数据，避免阻塞创建/注册接口响应。"""
    try:
        service = TenantService()
        await service.initialize_tenant_data(
            tenant_id,
            init_data_options=init_data_options,
            current_user_id=current_user_id,
            industry_preset=industry_preset,
        )
        logger.info(f"组织 {tenant_id} 后台初始化完成")
    except Exception as e:
        logger.error(f"组织 {tenant_id} 后台初始化失败: {e}", exc_info=True)


def schedule_initialize_tenant_data(
    tenant_id: int,
    init_data_options: Optional[List[str]] = None,
    current_user_id: Optional[int] = None,
    industry_preset: Optional[str] = None,
) -> None:
    """提交组织数据后台初始化任务。"""
    asyncio.create_task(
        initialize_tenant_data_background(
            tenant_id,
            init_data_options=init_data_options,
            current_user_id=current_user_id,
            industry_preset=industry_preset,
        )
    )

