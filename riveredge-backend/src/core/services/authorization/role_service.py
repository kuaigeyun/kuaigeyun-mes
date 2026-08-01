"""
角色服务模块

提供角色的 CRUD 操作和权限分配功能。
"""

from typing import Optional, List
from tortoise.expressions import Q
from loguru import logger

from core.models.role import Role
from core.utils.timezone_utils import now_utc
from core.models.permission import Permission
from core.models.user_role import UserRole
from core.models.position import Position
from core.schemas.position import PositionCreate
from core.schemas.role import RoleCreate, RoleUpdate
from infra.models.user import User
from core.services.authorization.position_service import PositionService
from tortoise.transactions import in_transaction
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.authorization.permission_registry_service import PermissionRegistryService
from core.config.functional_domain_spec import (
    FUNCTIONAL_DOMAINS,
    normalize_functional_domain,
    resolve_functional_domain_from_role_code,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

# 向后兼容别名
PermissionDeniedError = AuthorizationError


class RoleService:
    """
    角色服务类
    
    提供角色的 CRUD 操作和权限分配功能。
    """
    
    ALLOWED_ROLE_TYPES = {"internal", "external", "station"}
    ALLOWED_EXTERNAL_PARTNER_TYPES = {"customer", "supplier"}

    @staticmethod
    def _normalize_home_path(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if not text.startswith("/"):
            raise ValidationError("角色首页路径须以 / 开头")
        if len(text) > 500:
            raise ValidationError("角色首页路径不能超过 500 个字符")
        return text

    @staticmethod
    def _normalize_role_type_pair(
        role_type: Optional[str],
        external_partner_type: Optional[str],
    ) -> tuple[str, Optional[str]]:
        rt = (role_type or "internal").strip().lower()
        pt = (external_partner_type or "").strip().lower() or None
        if rt not in RoleService.ALLOWED_ROLE_TYPES:
            raise ValidationError("角色类型仅支持 internal / external / station")
        # 内部、触屏专用：均不绑定外协合作方
        if rt in {"internal", "station"}:
            return rt, None
        if pt not in RoleService.ALLOWED_EXTERNAL_PARTNER_TYPES:
            raise ValidationError("外部角色必须指定合作方类型：customer / supplier")
        return "external", pt

    @staticmethod
    def _normalize_functional_domain(
        role_type: str,
        functional_domain: Optional[str],
    ) -> Optional[str]:
        if role_type == "external":
            if functional_domain not in (None, ""):
                raise ValidationError("外部角色不可设置职能域")
            return None
        if functional_domain in (None, ""):
            return None
        try:
            return normalize_functional_domain(functional_domain)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    @staticmethod
    def resolve_preset_functional_domain(code: str) -> Optional[str]:
        return resolve_functional_domain_from_role_code(code)

    @staticmethod
    def _is_admin_system_role(role: Role) -> bool:
        """
        判断是否为“系统管理员”角色（允许管理权限）。

        仅对该角色放开系统角色的权限编辑限制，避免影响其他系统内置角色。
        """
        role_code = (role.code or "").strip().upper()
        role_name = (role.name or "").strip()
        return role_code in {"ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"} or role_name == "系统管理员"

    @staticmethod
    async def create_role(
        tenant_id: int,
        data: RoleCreate,
        current_user_id: int
    ) -> Role:
        """
        创建角色
        
        Args:
            tenant_id: 组织ID
            data: 角色创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Role: 创建的角色对象
            
        Raises:
            ValidationError: 当角色代码已存在时抛出
            AuthorizationError: 当用户无权限时抛出
        """
        # 验证权限（需要组织管理员或超级用户）
        # TODO: 实现权限验证逻辑
        
        # 检查角色代码是否已存在
        existing_role = await Role.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_role:
            raise ValidationError(f"角色代码 {data.code} 已存在")
        
        role_type, external_partner_type = RoleService._normalize_role_type_pair(
            getattr(data, "role_type", None),
            getattr(data, "external_partner_type", None),
        )
        functional_domain = RoleService._normalize_functional_domain(
            role_type,
            getattr(data, "functional_domain", None),
        )
        home_path = RoleService._normalize_home_path(getattr(data, "home_path", None))
        create_position = bool(getattr(data, "create_position", False))

        if create_position:
            existing_position = await Position.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True,
            ).first()
            if existing_position:
                raise ValidationError(f"职位代码 {data.code} 已存在，无法同步创建职位")

        async with in_transaction():
            role = await Role.create(
                tenant_id=tenant_id,
                name=data.name,
                code=data.code,
                description=data.description,
                role_type=role_type,
                external_partner_type=external_partner_type,
                functional_domain=functional_domain,
                home_path=home_path,
                is_active=data.is_active if data.is_active is not None else True,
                is_system=False,  # 系统角色只能由系统创建
            )
            if create_position:
                await PositionService.create_position(
                    tenant_id=tenant_id,
                    data=PositionCreate(
                        name=data.name,
                        code=data.code,
                        description=data.description,
                        is_active=data.is_active if data.is_active is not None else True,
                    ),
                    current_user_id=current_user_id,
                )

        return role
    
    @staticmethod
    async def get_role_list(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_system: Optional[bool] = None,
    ) -> dict:
        """
        获取角色列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            is_active: 是否启用筛选
            is_system: 是否系统角色筛选
            
        Returns:
            dict: 包含角色列表和分页信息
        """
        from core.utils.search_utils import list_with_search
        
        # 构建精确匹配条件
        exact_filters = {'deleted_at__isnull': True}
        if is_active is not None:
            exact_filters['is_active'] = is_active
        if is_system is not None:
            exact_filters['is_system'] = is_system
        
        # 字段搜索（用于高级搜索）
        if name:
            exact_filters['name__icontains'] = name
        if code:
            exact_filters['code__icontains'] = code
        
        # 使用通用搜索工具（自动支持拼音首字母搜索）
        search_result = await list_with_search(
            model=Role,
            page=page,
            page_size=page_size,
            keyword=keyword,
            search_fields=['name', 'code', 'description'],
            exact_filters=exact_filters if exact_filters else None,
            allowed_sort_fields=['name', 'code', 'is_active', 'is_system', 'created_at', 'updated_at'],
            default_sort='-created_at',
            tenant_id=tenant_id,
            skip_tenant_filter=False
        )
        
        # 获取搜索结果的角色对象
        roles = search_result["items"]
        
        # 获取关联的权限数量和用户数量
        result = []
        for role in roles:
            # 暂时注释掉权限预加载，避免多对多关系查询问题
            # await role.fetch_related('permissions')
            permission_count = 0  # 暂时设为0
            
            # 获取用户数量
            user_count = await UserRole.filter(role_id=role.id).count()
            
            result.append({
                "uuid": role.uuid,
                "name": role.name,
                "code": role.code,
                "description": role.description,
                "role_type": role.role_type,
                "external_partner_type": role.external_partner_type,
                "is_system": role.is_system,
                "is_active": role.is_active,
                "permission_count": permission_count,
                "user_count": user_count,
                "created_at": role.created_at,
            })
        
        return {
            "items": result,
            "total": search_result["total"],
            "page": search_result["page"],
            "page_size": search_result["page_size"],
        }
    
    @staticmethod
    async def get_role_by_uuid(
        tenant_id: int,
        role_uuid: str
    ) -> Role:
        """
        根据UUID获取角色详情
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            
        Returns:
            Role: 角色对象
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 不再使用 prefetch_related('permissions')，避免多对多关系查询问题
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        return role

    @staticmethod
    async def list_role_users(tenant_id: int, role_uuid: str) -> dict:
        """列出拥有指定角色的用户（未软删除）。"""
        role = await RoleService.get_role_by_uuid(tenant_id, role_uuid)
        user_ids = await UserRole.filter(role_id=role.id).values_list("user_id", flat=True)
        if not user_ids:
            return {"items": [], "total": 0}

        users = (
            await User.filter(
                id__in=list(user_ids),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            .prefetch_related("department")
            .order_by("full_name", "username")
        )
        items = [
            {
                "uuid": user.uuid,
                "username": user.username,
                "full_name": user.full_name,
                "department_name": user.department.name if user.department else None,
                "is_active": user.is_active,
            }
            for user in users
        ]
        return {"items": items, "total": len(items)}
    
    @staticmethod
    async def update_role(
        tenant_id: int,
        role_uuid: str,
        data: RoleUpdate,
        current_user_id: int
    ) -> Role:
        """
        更新角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            data: 角色更新数据
            current_user_id: 当前用户ID
            
        Returns:
            Role: 更新后的角色对象
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当角色代码已存在时抛出
            AuthorizationError: 当系统角色不可修改时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色
        if role.is_system:
            raise AuthorizationError("系统角色不可修改")
        
        # 如果更新代码，检查是否已存在
        if data.code and data.code != role.code:
            existing_role = await Role.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).exclude(id=role.id).first()
            
            if existing_role:
                raise ValidationError(f"角色代码 {data.code} 已存在")
        
        # 更新角色
        update_data = data.model_dump(exclude_unset=True)
        if "home_path" in update_data:
            update_data["home_path"] = RoleService._normalize_home_path(update_data.get("home_path"))
        if "role_type" in update_data or "external_partner_type" in update_data:
            next_role_type = update_data.get("role_type", role.role_type)
            next_partner_type = update_data.get("external_partner_type", role.external_partner_type)
            rt, pt = RoleService._normalize_role_type_pair(next_role_type, next_partner_type)
            update_data["role_type"] = rt
            update_data["external_partner_type"] = pt
        next_role_type = update_data.get("role_type", role.role_type)
        if "functional_domain" in update_data or "role_type" in update_data:
            raw_domain = update_data.get("functional_domain", role.functional_domain)
            if "functional_domain" in update_data and raw_domain == "":
                raw_domain = None
            update_data["functional_domain"] = RoleService._normalize_functional_domain(
                next_role_type,
                raw_domain,
            )
        for key, value in update_data.items():
            setattr(role, key, value)
        
        await role.save()
        
        return role
    
    @staticmethod
    async def delete_role(
        tenant_id: int,
        role_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当角色有关联用户时抛出
            AuthorizationError: 当系统角色不可删除时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色
        if role.is_system:
            raise AuthorizationError("系统角色不可删除")
        
        # 检查是否有关联用户
        user_count = await UserRole.filter(role_id=role.id).count()
        if user_count > 0:
            raise ValidationError(f"角色下有关联用户（{user_count}人），无法删除")
        
        # 软删除
        from datetime import datetime
        role.deleted_at = now_utc()
        await role.save()
    
    @staticmethod
    async def assign_permissions(
        tenant_id: int,
        role_uuid: str,
        permission_uuids: List[str],
        current_user_id: int
    ) -> dict:
        """
        分配权限给角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            permission_uuids: 权限UUID列表
            current_user_id: 当前用户ID
            
        Returns:
            dict: 操作结果
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当权限不属于当前组织时抛出
            AuthorizationError: 当系统角色不可修改权限时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色：仅“系统管理员”允许调整权限
        if role.is_system and not RoleService._is_admin_system_role(role):
            raise AuthorizationError("系统角色不可修改权限")
        
        # 验证权限属于当前组织并转换为ID
        if permission_uuids:
            permissions = await Permission.filter(
                uuid__in=permission_uuids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            if len(permissions) != len(permission_uuids):
                raise ValidationError("部分权限不存在或不属于当前组织")
            
            permission_ids = [p.id for p in permissions]
        else:
            permission_ids = []
        
        # 通过 RolePermission 关联表获取当前角色的权限
        from core.models.role_permission import RolePermission
        current_role_permissions = await RolePermission.filter(role_id=role.id).all()
        current_permission_ids = {rp.permission_id for rp in current_role_permissions}
        new_permission_ids = set(permission_ids)
        
        # 计算需要添加和移除的权限
        to_add = new_permission_ids - current_permission_ids
        to_remove = current_permission_ids - new_permission_ids
        
        # 添加权限（通过 RolePermission 关联表）
        if to_add:
            from datetime import datetime
            role_permissions_to_add = [
                RolePermission(
                    role_id=role.id,
                    permission_id=permission_id,
                    created_at=now_utc()
                )
                for permission_id in to_add
            ]
            await RolePermission.bulk_create(role_permissions_to_add, ignore_conflicts=True)
        
        # 移除权限（通过 RolePermission 关联表）
        if to_remove:
            await RolePermission.filter(
                role_id=role.id,
                permission_id__in=list(to_remove)
            ).delete()
        
        # 角色权限变更后，自动更新关联菜单的可见性
        # 获取变更的权限代码
        changed_permission_codes = []
        if to_add and permission_uuids:
            # 获取添加的权限对象
            added_permissions = [p for p in permissions if p.id in to_add]
            changed_permission_codes.extend([p.code for p in added_permissions])
        if to_remove:
            # 获取移除的权限对象（从数据库中查询）
            removed_permissions = await Permission.filter(
                id__in=list(to_remove),
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            changed_permission_codes.extend([p.code for p in removed_permissions])
        
        # 更新关联菜单可见性
        import asyncio
        from core.services.system.menu_service import MenuService

        if permission_ids:
            assigned_codes = [
                p.code
                for p in await Permission.filter(
                    id__in=list(permission_ids),
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).all()
                if p.code
            ]
            if assigned_codes:
                await MenuService.activate_menus_for_permission_codes(
                    tenant_id=tenant_id,
                    permission_codes=assigned_codes,
                )

        if changed_permission_codes:
            for permission_code in changed_permission_codes:
                asyncio.create_task(
                    MenuService.update_menus_by_permission_code(
                        tenant_id=tenant_id,
                        permission_code=permission_code,
                    )
                )
        # 权限变更后 bump：
        #   1) 租户级版本（user_id=None）：供全局聚合场景使用
        #   2) 持有该角色的每个用户的用户级版本：驱动 UserPermissionService 缓存失效
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)
        await RoleService._bump_role_users_permission_version(
            role_id=role.id, tenant_id=tenant_id
        )

        return {
            "success": True,
            "message": "权限分配成功",
            "added_count": len(to_add),
            "removed_count": len(to_remove),
        }
    
    @staticmethod
    async def get_role_permissions(
        tenant_id: int,
        role_uuid: str
    ) -> List[Permission]:
        """
        获取角色关联的权限列表
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            
        Returns:
            List[Permission]: 权限列表（仅包含未删除的权限）
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 通过 RolePermission 关联表查询权限
        from core.models.role_permission import RolePermission
        role_permissions = await RolePermission.filter(role_id=role.id).all()
        permission_ids = [rp.permission_id for rp in role_permissions]

        # 查询权限（仅未删除的）
        if permission_ids:
            permissions = await Permission.filter(
                id__in=permission_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
        else:
            # “系统管理员”默认拥有全量权限：当未显式绑定时回显全量权限用于前端默认全选。
            if RoleService._is_admin_system_role(role):
                permissions = await Permission.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).all()
            else:
                permissions = []
        
        return list(permissions)

    # 预设角色默认权限模板（按权限 code 前缀匹配）
    PRESET_ROLE_PERMISSION_PREFIXES = {
        # kuaizhizao:pricing 匹配 kuaizhizao:pricing:view，控制快制造内价格/金额是否可见
        "SALES_MANAGER": [
            "sales_",
            "customer",
            "quotation",
            "receivable",
            "kuaizhizao:pricing",
            "kuaizhizao:sales",
            "kuaizhizao:shipment",
        ],
        "SALES_PERSON": [
            "sales_",
            "customer",
            "quotation",
            "kuaizhizao:pricing",
            "kuaizhizao:sales",
            "kuaizhizao:shipment",
        ],
        "SALES_OPERATOR": [
            "sales_",
            "customer",
            "quotation",
            "kuaizhizao:pricing",
            "kuaizhizao:sales",
            "kuaizhizao:shipment",
        ],
        "PURCHASE_MANAGER": [
            "purchase_",
            "supplier",
            "payable",
            "kuaizhizao:pricing",
            "kuaizhizao:purchase",
            "kuaizhizao:receipt-notice",
            "kuaizhizao:purchase-return",
            "kuaizhizao:logistics",
        ],
        "PURCHASE_PERSON": [
            "purchase_",
            "supplier",
            "kuaizhizao:pricing",
            "kuaizhizao:purchase",
            "kuaizhizao:receipt-notice",
            "kuaizhizao:purchase-return",
            "kuaizhizao:logistics",
        ],
        "PURCHASE_OPERATOR": [
            "purchase_",
            "supplier",
            "kuaizhizao:pricing",
            "kuaizhizao:purchase",
            "kuaizhizao:receipt-notice",
            "kuaizhizao:purchase-return",
            "kuaizhizao:logistics",
        ],
        "PRODUCTION_MANAGER": [
            "work_order",
            "mrp",
            "lrp",
            "routing",
            "process",
            "kuaizhizao:pricing",
            "kuaizhizao:work-order",
            "kuaizhizao:reporting",
            "kuaizhizao:reporting:proxy",
            "kuaizhizao:rework",
            "kuaizhizao:outsource",
            "kuaizhizao:production-execution",
        ],
        "PRODUCTION_TEAM_LEADER": [
            "work_order",
            "process_inspection",
            "kuaizhizao:pricing",
            "kuaizhizao:work-order",
            "kuaizhizao:reporting",
            "kuaizhizao:reporting:proxy",
            "kuaizhizao:rework",
            "kuaizhizao:outsource",
            "kuaizhizao:production-execution",
        ],
        "PRODUCTION_CLERK": [
            "work_order",
            "routing",
            "process",
            "kuaizhizao:pricing",
            "kuaizhizao:work-order",
            "kuaizhizao:reporting",
            "kuaizhizao:reporting:proxy",
            "kuaizhizao:rework",
            "kuaizhizao:outsource",
            "kuaizhizao:production-execution",
        ],
        "PRODUCTION_STAFF": [
            "work_order",
            "process_inspection",
            "kuaizhizao:work-order",
            "kuaizhizao:production-execution",
        ],
        "WAREHOUSE_MANAGER": [
            "warehouse",
            "inventory",
            "location",
            "inbound",
            "outbound",
            "kuaizhizao:pricing",
            "kuaizhizao:warehouse",
            "kuaizhizao:inbound",
            "kuaizhizao:outbound",
        ],
        "WAREHOUSE_OPERATOR": [
            "warehouse",
            "inventory",
            "location",
            "inbound",
            "outbound",
            "kuaizhizao:pricing",
            "kuaizhizao:warehouse",
            "kuaizhizao:inbound",
            "kuaizhizao:outbound",
        ],
        "FINANCE_MANAGER": ["receivable", "payable", "receipt", "payment", "invoice", "cost_", "kuaizhizao:pricing"],
        "FINANCE_OPERATOR": ["receivable", "payable", "receipt", "payment", "invoice", "kuaizhizao:pricing"],
        "QUALITY_MANAGER": [
            "quality",
            "inspection",
            "defect",
            "kuaizhizao:quality",
            "kuaizhizao:incoming-inspection",
            "kuaizhizao:process-inspection",
            "kuaizhizao:finished-goods-inspection",
            "kuaizhizao:traceability",
        ],
        "QUALITY_OPERATOR": [
            "quality",
            "inspection",
            "defect",
            "kuaizhizao:quality",
            "kuaizhizao:incoming-inspection",
            "kuaizhizao:process-inspection",
            "kuaizhizao:finished-goods-inspection",
            "kuaizhizao:traceability",
        ],
        "ADMIN_OFFICE": ["system:user:read", "system:role:read", "system:menu:read"],
        "EMPLOYEE": [],
    }
    LEGACY_ROLE_CODE_MAPPINGS = {
        # 旧生产角色编码迁移到新编码
        "PRODUCTION_OPERATOR": "PRODUCTION_STAFF",
    }
    LEGACY_ROLE_NAME_MAPPINGS = {
        # 销售
        "销售员": "SALES_PERSON",
        "销售助理": "SALES_OPERATOR",
        # 采购
        "采购员": "PURCHASE_PERSON",
        "采购助理": "PURCHASE_OPERATOR",
        # 生产
        "生产部经理": "PRODUCTION_MANAGER",
        "生产执行员": "PRODUCTION_STAFF",
        # 质量
        "质检员": "QUALITY_OPERATOR",
        # 仓储
        "仓库员": "WAREHOUSE_OPERATOR",
        # 财务
        "会计专员": "FINANCE_OPERATOR",
    }

    # 中国中小制造业极简角色预设（不含系统管理员，避免与已有系统角色冲突）
    PRESET_ROLES = [
        # 销售部
        {"name": "销售经理", "code": "SALES_MANAGER", "description": "销售部门负责人，负责订单终审、销售计划与价格策略"},
        {"name": "销售人员", "code": "SALES_PERSON", "description": "标准业务人员，负责客户维护、报价与订单跟进"},
        {"name": "销售文员", "code": "SALES_OPERATOR", "description": "文员辅助角色，负责订单录入、单据归档与流程跟催"},
        
        # 采购部
        {"name": "采购经理", "code": "PURCHASE_MANAGER", "description": "采购部门负责人，负责采购寻源、成本管控与结算审核"},
        {"name": "采购人员", "code": "PURCHASE_PERSON", "description": "标准采购人员，负责寻比价、下达采购计划与供应商跟进"},
        {"name": "采购文员", "code": "PURCHASE_OPERATOR", "description": "文员辅助角色，负责采购单录入、到货跟催与资料整理"},
        
        # 生产部
        {"name": "车间主任", "code": "PRODUCTION_MANAGER", "description": "车间负责人，负责排产组织、质量与交付协同"},
        {"name": "班组长", "code": "PRODUCTION_TEAM_LEADER", "description": "班组负责人，负责班组任务分配、进度跟踪与异常反馈"},
        {"name": "生产文员", "code": "PRODUCTION_CLERK", "description": "生产文员，负责工单资料维护、单据录入与报表汇总"},
        {"name": "生产人员", "code": "PRODUCTION_STAFF", "description": "一线生产人员，负责按工艺执行生产和过程反馈"},
        
        # 仓库部
        {"name": "仓库主管", "code": "WAREHOUSE_MANAGER", "description": "仓库部门负责人，负责库存策略与实物安全"},
        {"name": "仓库员", "code": "WAREHOUSE_OPERATOR", "description": "仓储执行人员，负责出入库盘点与收发货"},
        
        # 财务部
        {"name": "财务主管", "code": "FINANCE_MANAGER", "description": "财务部门负责人，负责资金统筹与成本核算"},
        {"name": "会计专员", "code": "FINANCE_OPERATOR", "description": "财务执行人员，负责核销、开票及凭证录入"},
        
        # 质量部
        {"name": "质量主管", "code": "QUALITY_MANAGER", "description": "质量部门负责人，负责质量标准与仲裁决策"},
        {"name": "质检员", "code": "QUALITY_OPERATOR", "description": "质检执行人员，负责进料、制程、成品检验"},
        
        # 通用
        {"name": "行政办公", "code": "ADMIN_OFFICE", "description": "负责行政文秘及通用办公功能"},
        {"name": "普通员工", "code": "EMPLOYEE", "description": "职能通用权限，仅包含基础查询"},
    ]

    GUEST_ROLE_CODE = "GUEST"

    @staticmethod
    def _resource_from_permission_code(code: str) -> str | None:
        parts = [x for x in (code or "").strip().lower().split(":") if x]
        if len(parts) < 3:
            return None
        return f"{parts[0]}:{':'.join(parts[1:-1])}"

    @staticmethod
    async def _assign_preset_permissions(tenant_id: int, role: Role) -> None:
        """为预设角色分配默认权限（按 code 前缀匹配，幂等）。"""
        from core.models.role_permission import RolePermission

        desired_codes = set((await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)).keys())
        if not desired_codes:
            return

        prefixes = RoleService.PRESET_ROLE_PERMISSION_PREFIXES.get(role.code, [])
        selected_permissions: list[Permission] = []
        if prefixes:
            permissions = await Permission.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__in=desired_codes,
            ).all()
            selected_permissions = [
                p for p in permissions if any(p.code == prefix or p.code.startswith(prefix) for prefix in prefixes)
            ]
            selected_ids = {
                p.id
                for p in selected_permissions
            }
        else:
            # 无前缀配置时至少授予只读权限，避免空角色不可用
            read_perms = await Permission.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__in=desired_codes,
            ).filter(
                Q(code__endswith=":read") | Q(code__endswith=":view")
            ).all()
            selected_permissions = read_perms
            selected_ids = {p.id for p in read_perms}

        if not selected_ids:
            return

        existing = await RolePermission.filter(role_id=role.id).all()
        existing_ids = {rp.permission_id for rp in existing}
        to_add = selected_ids - existing_ids
        if not to_add:
            return

        await RolePermission.bulk_create(
            [RolePermission(role_id=role.id, permission_id=pid, created_at=now_utc()) for pid in to_add],
            ignore_conflicts=True,
        )

        # 默认数据/字段权限均为开放（全部/明文），仅在显式收敛时落库策略。

    @staticmethod
    async def _merge_role_relations(source_role_id: int, target_role_id: int) -> None:
        """迁移 source 角色的用户/权限关系到 target 角色。"""
        from core.models.role_permission import RolePermission

        user_roles = await UserRole.filter(role_id=source_role_id).all()
        target_user_ids = {
            ur.user_id for ur in await UserRole.filter(role_id=target_role_id).all()
        }
        to_add_user_roles = [
            UserRole(user_id=ur.user_id, role_id=target_role_id, created_at=now_utc())
            for ur in user_roles
            if ur.user_id not in target_user_ids
        ]
        if to_add_user_roles:
            await UserRole.bulk_create(to_add_user_roles, ignore_conflicts=True)
        await UserRole.filter(role_id=source_role_id).delete()

        role_permissions = await RolePermission.filter(role_id=source_role_id).all()
        target_permission_ids = {
            rp.permission_id for rp in await RolePermission.filter(role_id=target_role_id).all()
        }
        to_add_role_permissions = [
            RolePermission(role_id=target_role_id, permission_id=rp.permission_id, created_at=now_utc())
            for rp in role_permissions
            if rp.permission_id not in target_permission_ids
        ]
        if to_add_role_permissions:
            await RolePermission.bulk_create(to_add_role_permissions, ignore_conflicts=True)
        await RolePermission.filter(role_id=source_role_id).delete()

    @staticmethod
    async def cleanup_legacy_preset_roles(tenant_id: int) -> dict:
        """
        对齐旧预设角色数据：
        1) 旧编码迁移到新编码；
        2) 已存在预设角色名称/描述自动更新为最新文案；
        3) 迁移后删除旧角色数据（软删除）。
        """
        preset_by_code = {item["code"]: item for item in RoleService.PRESET_ROLES}
        renamed_count = 0
        merged_count = 0
        soft_deleted_count = 0
        permission_synced_count = 0

        for old_code, new_code in RoleService.LEGACY_ROLE_CODE_MAPPINGS.items():
            old_role = await Role.filter(
                tenant_id=tenant_id,
                code=old_code,
                deleted_at__isnull=True,
            ).first()
            if not old_role:
                continue

            target_role = await Role.filter(
                tenant_id=tenant_id,
                code=new_code,
                deleted_at__isnull=True,
            ).first()
            target_preset = preset_by_code.get(new_code)

            if target_role:
                await RoleService._merge_role_relations(old_role.id, target_role.id)
                old_role.deleted_at = now_utc()
                await old_role.save()
                merged_count += 1
                soft_deleted_count += 1
            else:
                old_role.code = new_code
                if target_preset:
                    old_role.name = target_preset["name"]
                    old_role.description = target_preset.get("description")
                await old_role.save()
                renamed_count += 1

        # 按旧名称迁移（兼容历史上 code 不规范但名称一致的数据）
        for old_name, new_code in RoleService.LEGACY_ROLE_NAME_MAPPINGS.items():
            legacy_roles = await Role.filter(
                tenant_id=tenant_id,
                name=old_name,
                deleted_at__isnull=True,
            ).all()
            if not legacy_roles:
                continue

            target_preset = preset_by_code.get(new_code)
            for legacy_role in legacy_roles:
                target_role = await Role.filter(
                    tenant_id=tenant_id,
                    code=new_code,
                    deleted_at__isnull=True,
                ).exclude(id=legacy_role.id).first()

                if target_role:
                    await RoleService._merge_role_relations(legacy_role.id, target_role.id)
                    legacy_role.deleted_at = now_utc()
                    await legacy_role.save()
                    merged_count += 1
                    soft_deleted_count += 1
                else:
                    legacy_role.code = new_code
                    if target_preset:
                        legacy_role.name = target_preset["name"]
                        legacy_role.description = target_preset.get("description")
                    await legacy_role.save()
                    renamed_count += 1

        # 对预设角色按 code 去重（保留最早一条，其余并入后软删除）
        for code in preset_by_code.keys():
            dup_roles = await Role.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).order_by("created_at", "id").all()
            if len(dup_roles) <= 1:
                continue

            keeper = dup_roles[0]
            for duplicate in dup_roles[1:]:
                await RoleService._merge_role_relations(duplicate.id, keeper.id)
                duplicate.deleted_at = now_utc()
                await duplicate.save()
                merged_count += 1
                soft_deleted_count += 1

        # 同步已存在预设角色的文案，确保历史数据与当前预设一致
        for item in RoleService.PRESET_ROLES:
            role = await Role.filter(
                tenant_id=tenant_id,
                code=item["code"],
                deleted_at__isnull=True,
            ).first()
            if role and (role.name != item["name"] or role.description != item.get("description")):
                role.name = item["name"]
                role.description = item.get("description")
                await role.save()
                renamed_count += 1
            if role:
                if not (role.functional_domain or "").strip():
                    preset_domain = RoleService.resolve_preset_functional_domain(role.code)
                    if preset_domain:
                        role.functional_domain = preset_domain
                        await role.save()
                await RoleService._assign_preset_permissions(tenant_id=tenant_id, role=role)
                permission_synced_count += 1

        return {
            "renamed": renamed_count,
            "merged": merged_count,
            "soft_deleted": soft_deleted_count,
            "permission_synced": permission_synced_count,
        }

    @staticmethod
    async def get_guest_role(tenant_id: int) -> Optional[Role]:
        """查找默认组织的体验用户 (GUEST) 角色（不自动创建）。"""
        return await Role.filter(
            tenant_id=tenant_id,
            code__iexact=RoleService.GUEST_ROLE_CODE,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def load_preset_sme(
        tenant_id: int,
        current_user_id: int,
        codes: Optional[List[str]] = None,
    ) -> int:
        """
        加载中国中小制造业极简角色预设数据。
        仅创建不存在的角色（按 code 去重）。
        codes 非空时仅创建指定编码（预览勾选）。
        """
        items = RoleService.PRESET_ROLES
        if codes:
            allow = {str(c).strip() for c in codes if str(c).strip()}
            items = [x for x in items if x.get("code") in allow]
        created = 0
        for item in items:
            exists = await Role.filter(
                tenant_id=tenant_id,
                code=item["code"],
                deleted_at__isnull=True,
            ).exists()
            if not exists:
                now = now_utc()
                preset_domain = RoleService.resolve_preset_functional_domain(item["code"])
                role = await Role.create(
                    tenant_id=tenant_id,
                    name=item["name"],
                    code=item["code"],
                    description=item.get("description"),
                    role_type="internal",
                    external_partner_type=None,
                    functional_domain=preset_domain,
                    is_active=True,
                    is_system=False,
                    created_at=now,
                    updated_at=now,
                )
                await RoleService._assign_preset_permissions(tenant_id=tenant_id, role=role)
                created += 1
        return created

    @staticmethod
    async def _bump_role_users_permission_version(role_id: int, tenant_id: int) -> None:
        """为持有指定角色的所有用户 bump 用户级权限版本，驱动 UserPermissionService 缓存失效。"""
        try:
            from core.models.user_role import UserRole
            user_roles = await UserRole.filter(role_id=role_id).all()
            for ur in user_roles:
                await PermissionVersionService.bump(
                    tenant_id=tenant_id, user_id=ur.user_id
                )
        except Exception as exc:
            logger.warning(
                "bump_role_users_permission_version 失败 role_id={} tenant_id={} err={}",
                role_id,
                tenant_id,
                exc,
            )
