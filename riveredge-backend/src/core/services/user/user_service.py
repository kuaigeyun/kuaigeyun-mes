"""
用户服务模块

提供用户的 CRUD 操作、导入导出和批量操作功能。
"""

import os
import tempfile
from typing import Optional, List, Dict, Any
from datetime import datetime
from tortoise.expressions import Q
from tortoise.transactions import in_transaction
from passlib.context import CryptContext
from loguru import logger

from infra.models.user import User
from core.models.department import Department
from core.models.position import Position
from core.models.role import Role
from core.models.user_role import UserRole
from core.schemas.user import UserCreate, UserUpdate
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.user.user_import_reference_service import UserImportReferenceService
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

# 向后兼容别名
PermissionDeniedError = AuthorizationError

# 密码加密上下文（使用 pbkdf2_sha256，更好的跨平台兼容性）
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=30000
)


class UserService:
    """
    用户服务类
    
    提供用户的 CRUD 操作、导入导出和批量操作。
    """
    
    @staticmethod
    async def create_user(
        tenant_id: int,
        data: UserCreate,
        current_user_id: int
    ) -> User:
        """
        创建用户
        
        Args:
            tenant_id: 组织ID
            data: 用户创建数据
            current_user_id: 当前用户ID
            
        Returns:
            User: 创建的用户对象
            
        Raises:
            ValidationError: 当用户名已存在或关联数据无效时抛出
            PermissionDeniedError: 当用户无权限时抛出
        """
        # 验证权限（需要组织管理员或超级用户）
        # TODO: 实现权限验证逻辑
        
        # 检查用户名是否已存在
        existing_user = await User.filter(
            tenant_id=tenant_id,
            username=data.username,
            deleted_at__isnull=True
        ).first()
        
        if existing_user:
            raise ValidationError(f"用户名 '{data.username}' 已被使用，请选择其他用户名")

        # 验证部门（如果提供）
        department_id = None
        if data.department_uuid:
            department = await Department.filter(
                uuid=data.department_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()

            if not department:
                raise ValidationError("所选部门不存在或不属于当前组织，请重新选择部门")

            department_id = department.id

        # 验证职位（如果提供）
        position_id = None
        if data.position_uuid:
            position = await Position.filter(
                uuid=data.position_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()

            if not position:
                raise ValidationError("所选职位不存在或不属于当前组织，请重新选择职位")
            
            position_id = position.id
        
        # 验证角色（如果提供）
        role_ids = []
        if data.role_uuids:
            roles = await Role.filter(
                uuid__in=data.role_uuids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            if len(roles) != len(data.role_uuids):
                raise ValidationError("所选角色中存在无效或不属于当前组织的角色，请重新选择")
            
            role_ids = [role.id for role in roles]
        
        # 加密密码
        password_hash = User.hash_password(data.password)

        # 创建用户与角色分配放在同一事务中，并显式使用同一连接
        async with in_transaction() as conn:
            user = await User.create(
                tenant_id=tenant_id,
                username=data.username,
                email=data.email,
                password_hash=password_hash,
                full_name=data.full_name,
                phone=getattr(data, 'phone', None),
                department_id=department_id,
                position_id=position_id,
                is_active=data.is_active if data.is_active is not None else True,
                is_tenant_admin=data.is_tenant_admin if data.is_tenant_admin is not None else False,
                remark=getattr(data, 'remark', None),
                using_db=conn,
            )
            if role_ids:
                roles = await Role.filter(id__in=role_ids).all()
                await UserRole.bulk_create(
                    [UserRole(user_id=user.id, role_id=r.id) for r in roles],
                    using_db=conn,
                )
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=user.id)

        return user
    
    @staticmethod
    async def get_user_list(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        username: Optional[str] = None,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        phone: Optional[str] = None,
        department_uuid: Optional[str] = None,
        position_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_tenant_admin: Optional[bool] = None,
        current_user_id: int = None
    ) -> Dict[str, Any]:
        """
        获取用户列表
        
        Args:
            tenant_id: 组织ID
            page: 页码（默认 1）
            page_size: 每页数量（默认 20）
            keyword: 关键词搜索（用户名、邮箱、姓名）
            department_uuid: 部门UUID筛选
            position_uuid: 职位UUID筛选
            is_active: 是否激活筛选
            is_tenant_admin: 是否组织管理员筛选
            current_user_id: 当前用户ID
            
        Returns:
            dict: 用户列表响应数据
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        
        # 关键词搜索
        if keyword:
            query &= (Q(username__icontains=keyword) | 
                     Q(email__icontains=keyword) | 
                     Q(full_name__icontains=keyword))
        
        # 精确/模糊字段搜索（用于高级搜索）
        if username:
            query &= Q(username__icontains=username)
        if email:
            query &= Q(email__icontains=email)
        if full_name:
            query &= Q(full_name__icontains=full_name)
        if phone:
            query &= Q(phone__icontains=phone)
        
        # 部门筛选
        if department_uuid:
            department = await Department.filter(
                uuid=department_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if department:
                query &= Q(department_id=department.id)
        
        # 职位筛选
        if position_uuid:
            position = await Position.filter(
                uuid=position_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if position:
                query &= Q(position_id=position.id)
        
        # 状态筛选
        if is_active is not None:
            query &= Q(is_active=is_active)
        
        if is_tenant_admin is not None:
            query &= Q(is_tenant_admin=is_tenant_admin)
        
        # 优化分页查询：先查询总数，再查询数据
        total = await User.filter(query).count()
        
        # 限制分页大小，避免过大查询
        if page_size > 1000:
            page_size = 1000
        
        # 分页查询（预加载 roles、department、position，与详情接口一致，确保列表和编辑能正确带出）
        offset = (page - 1) * page_size
        users = await User.filter(query).order_by("-created_at").offset(offset).limit(page_size).prefetch_related("roles", "department", "position").all()

        # 构建响应数据（遵循自增ID+UUID混合方案，只对外暴露UUID）
        items = []
        for user in users:
            try:
                user_dict = {
                    "id": user.id,
                    "uuid": user.uuid,
                    "username": user.username,
                    "email": user.email,
                    "full_name": user.full_name,
                    "phone": user.phone,
                    "is_active": user.is_active,
                    "is_tenant_admin": user.is_tenant_admin,
                    "last_login": user.last_login,
                    "created_at": user.created_at,
                }

                # 部门信息（已通过 prefetch_related 加载）
                department_data = None
                if user.department:
                    department_data = {
                        "uuid": user.department.uuid,
                        "name": user.department.name,
                        "code": user.department.code,
                    }
                    user_dict["department_uuid"] = user.department.uuid
                user_dict["department"] = department_data

                # 职位信息（已通过 prefetch_related 加载）
                position_data = None
                if user.position:
                    position_data = {
                        "uuid": user.position.uuid,
                        "name": user.position.name,
                        "code": user.position.code,
                    }
                    user_dict["position_uuid"] = user.position.uuid
                user_dict["position"] = position_data

                # 角色信息（已通过 prefetch_related 加载，直接迭代可避免 N+1 查询）
                roles_data = []
                for r in user.roles:
                    roles_data.append({"uuid": str(r.uuid), "name": r.name, "code": r.code})
                user_dict["roles"] = roles_data

                items.append(user_dict)

            except Exception as e:
                # 如果单个用户处理失败，跳过该用户
                continue
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    
    @staticmethod
    async def get_user_detail(
        tenant_id: int,
        user_uuid: str,
        current_user_id: int = None
    ) -> User:
        """
        获取用户详情
        
        Args:
            tenant_id: 组织ID
            user_uuid: 用户UUID
            current_user_id: 当前用户ID
            
        Returns:
            User: 用户对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
        """
        user = await User.filter(
            uuid=user_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not user:
            raise NotFoundError(f"用户不存在: {user_uuid}")
        
        return user
    
    @staticmethod
    async def update_user(
        tenant_id: int,
        user_uuid: str,
        data: UserUpdate,
        current_user_id: int
    ) -> User:
        """
        更新用户
        
        Args:
            tenant_id: 组织ID
            user_uuid: 用户UUID
            data: 用户更新数据
            current_user_id: 当前用户ID
            
        Returns:
            User: 更新后的用户对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
            ValidationError: 当关联数据无效时抛出
        """
        # 获取用户
        user = await User.filter(
            uuid=user_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not user:
            raise NotFoundError(f"用户不存在: {user_uuid}")
        
        if data.username is not None and data.username != user.username:
            existing_user = await User.filter(
                tenant_id=tenant_id,
                username=data.username,
                deleted_at__isnull=True,
            ).exclude(id=user.id).first()
            if existing_user:
                raise ValidationError(f"用户名 '{data.username}' 已被使用，请选择其他用户名")
        
        # 记录变更前的状态（用于检测变更）
        old_department_id = user.department_id
        old_position_id = user.position_id
        old_is_active = user.is_active
        
        # 验证部门（如果提供）
        if data.department_uuid is not None:
            if data.department_uuid:
                department = await Department.filter(
                    uuid=data.department_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not department:
                    raise ValidationError("所选部门不存在或不属于当前组织，请重新选择部门")

                user.department_id = department.id
            else:
                user.department_id = None
        
        # 验证职位（如果提供）
        if data.position_uuid is not None:
            if data.position_uuid:
                position = await Position.filter(
                    uuid=data.position_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not position:
                    raise ValidationError("所选职位不存在或不属于当前组织，请重新选择职位")

                user.position_id = position.id
            else:
                user.position_id = None
        
        # 更新其他字段
        update_data = data.model_dump(exclude_unset=True, exclude={'department_uuid', 'position_uuid', 'role_uuids'})
        if "password" in update_data:
            password = update_data.pop("password")
            if password:
                update_data["password_hash"] = User.hash_password(password)
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        # 用户保存与角色更新放在同一事务中，并显式使用同一连接
        async with in_transaction() as conn:
            await user.save(using_db=conn)
            db_user = await User.filter(
                uuid=user_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).using_db(conn).first()
            if not db_user:
                logger.error(
                    "用户角色更新前用户不存在: tenant_id={}, user_uuid={}, request_user_id={}",
                    tenant_id,
                    user_uuid,
                    current_user_id,
                )
                raise ValidationError("用户不存在或已被删除，无法更新角色")
            if data.role_uuids is not None:
                # 先清空当前角色关系
                await UserRole.filter(user_id=db_user.id).using_db(conn).delete()
                if data.role_uuids:
                    roles = await Role.filter(
                        uuid__in=data.role_uuids,
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).all()
                    if len(roles) != len(data.role_uuids):
                        logger.warning(
                            "用户角色更新校验失败: tenant_id={}, user_uuid={}, role_uuids={}",
                            tenant_id,
                            user_uuid,
                            data.role_uuids,
                        )
                        raise ValidationError("所选角色中存在无效或不属于当前组织的角色，请重新选择")
                    await UserRole.bulk_create(
                        [UserRole(user_id=db_user.id, role_id=r.id) for r in roles],
                        using_db=conn,
                    )
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=user.id)
        
        # 重新加载关联数据
        await user.fetch_related('roles', 'department', 'position')
        
        # 如果部门或职位变更，触发权限更新（异步，不阻塞主流程）
        # 注意：目前系统中部门/职位没有权限模板，这里只是预留接口
        # 如果将来需要根据部门/职位自动分配权限，可以在这里实现
        department_changed = old_department_id != user.department_id
        position_changed = old_position_id != user.position_id
        
        if department_changed or position_changed:
            import asyncio
            # 异步处理权限更新（如果将来有权限模板功能）
            # 目前只是记录变更，不执行具体操作
            asyncio.create_task(
                UserService._handle_department_position_change(
                    tenant_id=tenant_id,
                    user_id=user.id,
                    old_department_id=old_department_id,
                    new_department_id=user.department_id,
                    old_position_id=old_position_id,
                    new_position_id=user.position_id
                )
            )
        
        # 如果用户被禁用，清除在线用户信息（异步，不阻塞主流程）
        if old_is_active and not user.is_active:
            import asyncio
            asyncio.create_task(
                UserService._clear_online_user(
                    tenant_id=tenant_id,
                    user_id=user.id
                )
            )
        
        return user
    
    @staticmethod
    async def _handle_department_position_change(
        tenant_id: int,
        user_id: int,
        old_department_id: Optional[int],
        new_department_id: Optional[int],
        old_position_id: Optional[int],
        new_position_id: Optional[int]
    ) -> None:
        """
        处理部门/职位变更后的权限更新
        
        这是一个预留方法，用于将来实现根据部门/职位权限模板自动分配权限的功能。
        目前只是记录变更，不执行具体操作。
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            old_department_id: 旧部门ID
            new_department_id: 新部门ID
            old_position_id: 旧职位ID
            new_position_id: 新职位ID
        """
        # TODO: 如果将来需要根据部门/职位权限模板自动分配权限，可以在这里实现
        # 例如：
        # 1. 获取新部门/职位的权限模板
        # 2. 自动为用户分配相应的角色或权限
        # 3. 移除旧部门/职位相关的权限
        pass
    
    @staticmethod
    async def _clear_online_user(
        tenant_id: int,
        user_id: int
    ) -> None:
        """
        清除在线用户信息
        
        当用户被禁用或删除时，清除 Redis 中的在线用户信息。
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
        """
        try:
            from core.services.logging.online_user_service import OnlineUserService
            await OnlineUserService.force_logout(
                tenant_id=tenant_id,
                user_id=user_id
            )
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"用户 {user_id} 的在线状态已清除（组织ID: {tenant_id}）")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"清除在线用户信息失败: {e}")
    
    @staticmethod
    async def delete_user(
        tenant_id: int,
        user_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除用户（软删除）
        
        Args:
            tenant_id: 组织ID
            user_uuid: 用户UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当用户不存在时抛出
            ValidationError: 当用户是平台管理员或当前登录用户时抛出
        """
        # 获取用户
        user = await User.filter(
            uuid=user_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not user:
            raise NotFoundError(f"用户不存在: {user_uuid}")
        
        # 验证：平台管理员不可删除
        if user.is_infra_admin:
            raise ValidationError("平台管理员不可删除")
        
        # 验证：当前登录用户不可删除自己
        if user.id == current_user_id:
            raise ValidationError("不能删除当前登录用户")
        
        # 软删除
        user.deleted_at = datetime.now()
        await user.save()
        
        # 清除在线用户信息（异步，不阻塞主流程）
        import asyncio
        asyncio.create_task(
            UserService._clear_online_user(
                tenant_id=tenant_id,
                user_id=user.id
            )
        )

    @staticmethod
    async def batch_delete_users(
        tenant_id: int,
        user_uuids: List[str],
        current_user_id: int,
    ) -> Dict[str, Any]:
        """
        批量删除用户（软删除）

        逐条调用 delete_user，单条失败不影响其余条目。
        """
        success_count = 0
        failure_count = 0
        errors: List[Dict[str, str]] = []
        seen: set[str] = set()
        for user_uuid in user_uuids:
            if not user_uuid or user_uuid in seen:
                continue
            seen.add(user_uuid)
            try:
                await UserService.delete_user(
                    tenant_id=tenant_id,
                    user_uuid=user_uuid,
                    current_user_id=current_user_id,
                )
                success_count += 1
            except (NotFoundError, ValidationError) as e:
                failure_count += 1
                errors.append({"uuid": user_uuid, "message": str(e)})
            except Exception as e:
                failure_count += 1
                errors.append({"uuid": user_uuid, "message": str(e)})
                logger.exception("batch_delete_users failed for %s", user_uuid)
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }

    @staticmethod
    async def reset_password(
        tenant_id: int,
        user_uuid: str,
        new_password: Optional[str] = None,
        current_user_id: int = None
    ) -> User:
        """
        重置用户密码
        
        Args:
            tenant_id: 组织ID
            user_uuid: 用户UUID
            new_password: 新密码（可选，不提供则使用默认密码 '123456'）
            current_user_id: 当前用户ID
            
        Returns:
            User: 更新后的用户对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
        """
        # 获取用户
        user = await User.filter(
            uuid=user_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not user:
            raise NotFoundError(f"用户不存在: {user_uuid}")
        
        # 设置新密码
        password = new_password if new_password else "123456"
        user.password_hash = User.hash_password(password)
        
        # 保存用户
        await user.save()
        
        # 清除在线用户信息（强制重新登录）
        import asyncio
        asyncio.create_task(
            UserService._clear_online_user(
                tenant_id=tenant_id,
                user_id=user.id
            )
        )
        
        return user
    
    _USER_IMPORT_HEADER_MAP = {
        '用户名': 'username',
        '*用户名': 'username',
        'username': 'username',
        '*username': 'username',
        'Username': 'username',
        '*Username': 'username',
        '邮箱': 'email',
        'email': 'email',
        'Email': 'email',
        '密码': 'password',
        '*密码': 'password',
        'password': 'password',
        '*password': 'password',
        'Password': 'password',
        '*Password': 'password',
        '姓名': 'full_name',
        'full_name': 'full_name',
        'Full Name': 'full_name',
        '手机号': 'phone',
        'phone': 'phone',
        'Phone': 'phone',
        '部门': 'department',
        'department': 'department',
        'Department': 'department',
        '职位': 'position',
        'position': 'position',
        'Position': 'position',
        '角色': 'roles',
        'roles': 'roles',
        'Roles': 'roles',
    }

    @staticmethod
    def _parse_user_import_rows(
        data: List[List[Any]],
    ) -> tuple[Dict[str, int], List[tuple[List[Any], int]]]:
        """解析导入表头与数据行，返回 (header_index_map, [(row, excel_row_index), ...])。"""
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")

        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        header_index_map: Dict[str, int] = {}
        for idx, header in enumerate(headers):
            if header and header in UserService._USER_IMPORT_HEADER_MAP:
                header_index_map[UserService._USER_IMPORT_HEADER_MAP[header]] = idx

        required_fields = ['username', 'password']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")

        rows = data[2:] if len(data) > 2 else []
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        return header_index_map, non_empty_rows

    @staticmethod
    def _row_to_user_data(row: List[Any], header_index_map: Dict[str, int]) -> Dict[str, str]:
        user_data: Dict[str, str] = {}
        for field, col_idx in header_index_map.items():
            if col_idx < len(row):
                value = row[col_idx]
                if value is not None:
                    user_data[field] = str(value).strip()
        return user_data

    @staticmethod
    async def preview_import_references(
        tenant_id: int,
        data: List[List[Any]],
    ) -> Dict[str, Any]:
        """扫描导入数据，返回系统中不存在的部门/职位/角色（去重、排序）。"""
        header_index_map, non_empty_rows = UserService._parse_user_import_rows(data)

        dept_values: set[str] = set()
        pos_values: set[str] = set()
        role_values: set[str] = set()

        for row, _row_idx in non_empty_rows:
            user_data = UserService._row_to_user_data(row, header_index_map)
            if user_data.get('department'):
                dept_values.add(user_data['department'])
            if user_data.get('position'):
                pos_values.add(user_data['position'])
            if user_data.get('roles'):
                for r in user_data['roles'].split(','):
                    r = r.strip()
                    if r:
                        role_values.add(r)

        missing_departments: List[str] = []
        for v in sorted(dept_values):
            if not await UserImportReferenceService.lookup_department(tenant_id, v):
                missing_departments.append(v)

        missing_positions: List[str] = []
        for v in sorted(pos_values):
            if not await UserImportReferenceService.lookup_position(tenant_id, v):
                missing_positions.append(v)

        missing_roles: List[str] = []
        for v in sorted(role_values):
            if not await UserImportReferenceService.lookup_role(tenant_id, v):
                missing_roles.append(v)

        return {
            "missing_departments": missing_departments,
            "missing_positions": missing_positions,
            "missing_roles": missing_roles,
            "has_missing": bool(missing_departments or missing_positions or missing_roles),
        }

    @staticmethod
    async def import_users_from_data(
        tenant_id: int,
        data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
        current_user_id: int,
        *,
        auto_create_references: bool = False,
    ) -> Dict[str, Any]:
        """
        从二维数组数据导入用户
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建用户。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 组织ID
            data: 二维数组数据（从 uni_import 组件传递）
            current_user_id: 当前用户ID
            
        Returns:
            dict: 导入结果（成功数、失败数、错误列表）
        """
        header_index_map, non_empty_rows = UserService._parse_user_import_rows(data)

        success_count = 0
        failure_count = 0
        errors = []
        department_cache: Dict[str, Department] = {}
        position_cache: Dict[str, Position] = {}
        role_cache: Dict[str, Role] = {}
        
        for row, row_idx in non_empty_rows:
            try:
                user_data = UserService._row_to_user_data(row, header_index_map)

                # 验证必填字段
                if not user_data.get('username') or not user_data.get('password'):
                    errors.append({
                        "row": row_idx,
                        "error": "用户名或密码为空"
                    })
                    failure_count += 1
                    continue
                
                # 检查用户名是否已存在
                existing_user = await User.filter(
                    tenant_id=tenant_id,
                    username=user_data['username'],
                    deleted_at__isnull=True
                ).first()
                
                if existing_user:
                    errors.append({
                        "row": row_idx,
                        "error": f"用户名 {user_data['username']} 已存在"
                    })
                    failure_count += 1
                    continue
                
                department_id = None
                if user_data.get('department'):
                    dept_val = user_data['department']
                    if auto_create_references:
                        try:
                            dept = await UserImportReferenceService.ensure_department(
                                tenant_id,
                                dept_val,
                                current_user_id,
                                department_cache,
                            )
                            department_id = dept.id
                        except ValidationError as e:
                            errors.append({"row": row_idx, "error": str(e)})
                            failure_count += 1
                            continue
                    else:
                        dept = await UserImportReferenceService.lookup_department(tenant_id, dept_val)
                        if dept:
                            department_id = dept.id
                        else:
                            errors.append({
                                "row": row_idx,
                                "error": f"部门 {dept_val} 不存在",
                            })
                            failure_count += 1
                            continue

                position_id = None
                if user_data.get('position'):
                    pos_val = user_data['position']
                    if auto_create_references:
                        try:
                            pos = await UserImportReferenceService.ensure_position(
                                tenant_id,
                                pos_val,
                                current_user_id,
                                position_cache,
                                department_id=department_id,
                            )
                            position_id = pos.id
                        except ValidationError as e:
                            errors.append({"row": row_idx, "error": str(e)})
                            failure_count += 1
                            continue
                    else:
                        pos = await UserImportReferenceService.lookup_position(tenant_id, pos_val)
                        if pos:
                            position_id = pos.id
                        else:
                            errors.append({
                                "row": row_idx,
                                "error": f"职位 {pos_val} 不存在",
                            })
                            failure_count += 1
                            continue

                role_ids = []
                if user_data.get('roles'):
                    role_names = [r.strip() for r in user_data['roles'].split(',') if r.strip()]
                    if auto_create_references:
                        try:
                            for role_name in role_names:
                                role = await UserImportReferenceService.ensure_role(
                                    tenant_id,
                                    role_name,
                                    current_user_id,
                                    role_cache,
                                )
                                role_ids.append(role.id)
                        except ValidationError as e:
                            errors.append({"row": row_idx, "error": str(e)})
                            failure_count += 1
                            continue
                    else:
                        missing_role_name = None
                        for role_name in role_names:
                            role = await UserImportReferenceService.lookup_role(tenant_id, role_name)
                            if role:
                                role_ids.append(role.id)
                            else:
                                missing_role_name = role_name
                                break
                        if missing_role_name:
                            errors.append({
                                "row": row_idx,
                                "error": f"角色 {missing_role_name} 不存在",
                            })
                            failure_count += 1
                            continue
                
                # 创建用户
                password_hash = User.hash_password(user_data['password'])
                
                user = await User.create(
                    tenant_id=tenant_id,
                    username=user_data['username'],
                    email=user_data.get('email'),
                    password_hash=password_hash,
                    full_name=user_data.get('full_name'),
                    phone=user_data.get('phone'),
                    department_id=department_id,
                    position_id=position_id,
                    is_active=True,
                )
                
                # 分配角色
                if role_ids:
                    roles = await Role.filter(id__in=role_ids).all()
                    await user.roles.add(*roles)
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": str(e)
                })
                failure_count += 1
        
        return {
            "success": True,
            "message": "导入完成",
            "total": success_count + failure_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }
    
    @staticmethod
    async def export_users_to_excel(
        tenant_id: int,
        keyword: Optional[str] = None,
        department_uuid: Optional[str] = None,
        position_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_tenant_admin: Optional[bool] = None,
        current_user_id: int = None
    ) -> str:
        """
        导出用户到 Excel 文件
        
        Args:
            tenant_id: 组织ID
            keyword: 关键词搜索
            department_uuid: 部门UUID筛选
            position_uuid: 职位UUID筛选
            is_active: 是否激活筛选
            is_tenant_admin: 是否组织管理员筛选
            current_user_id: 当前用户ID
            
        Returns:
            str: Excel 文件路径
        """
        # 验证权限（需要组织管理员或超级用户）
        # TODO: 实现权限验证逻辑
        
        # 查询用户列表（导出所有数据，不分页）
        result = await UserService.get_user_list(
            tenant_id=tenant_id,
            page=1,
            page_size=10000,  # 导出所有数据
            keyword=keyword,
            department_uuid=department_uuid,
            position_uuid=position_uuid,
            is_active=is_active,
            is_tenant_admin=is_tenant_admin,
            current_user_id=current_user_id
        )
        
        import csv
        
        # 创建 CSV 文件
        file_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(file_dir, exist_ok=True)
        
        filename = f"users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = os.path.join(file_dir, filename)
        
        # 写入 CSV 文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.writer(csvfile)
            
            # 写入表头
            headers = ['用户名', '邮箱', '姓名', '手机号', '部门', '职位', '角色', '状态', '组织管理员', '最后登录', '创建时间']
            writer.writerow(headers)
            
            # 写入数据
            for user_dict in result['items']:
                # 格式化角色（多个角色用逗号分隔）
                role_names = ', '.join([role.get('name', '') for role in user_dict.get('roles', [])])
                
                # 格式化部门
                department_name = user_dict.get('department', {}).get('name', '') if user_dict.get('department') else ''
                
                # 格式化职位
                position_name = user_dict.get('position', {}).get('name', '') if user_dict.get('position') else ''
                
                # 格式化最后登录时间
                last_login_str = ''
                if user_dict.get('last_login'):
                    if isinstance(user_dict['last_login'], datetime):
                        last_login_str = user_dict['last_login'].strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        last_login_str = str(user_dict['last_login'])
                
                # 格式化创建时间
                created_at_str = ''
                if user_dict.get('created_at'):
                    if isinstance(user_dict['created_at'], datetime):
                        created_at_str = user_dict['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        created_at_str = str(user_dict['created_at'])
                
                row = [
                    user_dict.get('username', ''),
                    user_dict.get('email', ''),
                    user_dict.get('full_name', ''),
                    user_dict.get('phone', ''),
                    department_name,
                    position_name,
                    role_names,
                    '启用' if user_dict.get('is_active') else '禁用',
                    '是' if user_dict.get('is_tenant_admin') else '否',
                    last_login_str,
                    created_at_str,
                ]
                writer.writerow(row)
        
        return file_path
