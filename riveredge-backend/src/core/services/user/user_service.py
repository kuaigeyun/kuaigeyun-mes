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

from infra.models.user import User
from core.models.department import Department
from core.models.position import Position
from core.models.role import Role
from core.models.user_role import UserRole
from core.schemas.user import UserCreate, UserUpdate
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
        
        # 创建用户
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
        )
        
        # 分配角色
        if role_ids:
            roles = await Role.filter(id__in=role_ids).all()
            await user.roles.add(*roles)
        
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
        if page_size > 100:
            page_size = 100
        
        # 分页查询（使用索引字段排序）
        offset = (page - 1) * page_size
        # ⚠️ 修复：不预加载 roles，避免表不存在时出错，改为在循环中单独查询
        users = await User.filter(query).order_by("-created_at").offset(offset).limit(page_size).all()
        
        # 构建响应数据（遵循自增ID+UUID混合方案，只对外暴露UUID）
        items = []
        for user in users:
            try:
                user_dict = {
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

                # 添加部门信息（手动查询）
                department_data = None
                if user.department_id:
                    try:
                        from core.models.department import Department
                        department = await Department.filter(
                            id=user.department_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        ).first()
                        if department:
                            department_data = {
                                "uuid": department.uuid,
                                "name": department.name,
                                "code": department.code
                            }
                            user_dict["department_uuid"] = department.uuid
                    except Exception as e:
                        # 忽略部门查询错误，继续处理
                        pass

                user_dict["department"] = department_data

                # 添加职位信息（手动查询）
                position_data = None
                if user.position_id:
                    try:
                        from core.models.position import Position
                        position = await Position.filter(
                            id=user.position_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        ).first()
                        if position:
                            position_data = {
                                "uuid": position.uuid,
                                "name": position.name,
                                "code": position.code
                            }
                            user_dict["position_uuid"] = position.uuid
                    except Exception as e:
                        # 忽略职位查询错误，继续处理
                        pass

                user_dict["position"] = position_data

                # 添加角色信息
                roles_data = []
                try:
                    # ⚠️ 修复：使用 try-except 捕获所有可能的错误（包括表不存在）
                    from tortoise.exceptions import OperationalError, DoesNotExist
                    try:
                        roles = await user.roles.all()
                        roles_data = [
                            {
                                "uuid": role.uuid,
                                "name": role.name,
                                "code": role.code
                            }
                            for role in roles
                        ]
                    except (OperationalError, DoesNotExist, AttributeError) as e:
                        # 忽略角色查询错误（表不存在、关系不存在等），继续处理
                        from loguru import logger
                        logger.warning(f"⚠️ 查询用户角色失败（用户ID: {user.id}）: {e}")
                        roles_data = []
                    except Exception as e:
                        # 捕获其他所有异常
                        from loguru import logger
                        logger.warning(f"⚠️ 查询用户角色时发生未知错误（用户ID: {user.id}）: {e}")
                        roles_data = []
                except Exception as e:
                    # 外层异常捕获，确保不会影响整个流程
                    from loguru import logger
                    logger.warning(f"⚠️ 处理用户角色时发生错误（用户ID: {user.id}）: {e}")
                    roles_data = []

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
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        # 用户保存与角色更新放在同一事务中，避免 core_user_roles 外键校验时看不到已保存的用户
        async with in_transaction():
            await user.save()
            if data.role_uuids is not None:
                await UserRole.filter(user_id=user.id).delete()
                if data.role_uuids:
                    roles = await Role.filter(
                        uuid__in=data.role_uuids,
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).all()
                    if len(roles) != len(data.role_uuids):
                        raise ValidationError("所选角色中存在无效或不属于当前组织的角色，请重新选择")
                    await UserRole.bulk_create([
                        UserRole(user_id=user.id, role_id=r.id) for r in roles
                    ])
        
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
    async def import_users_from_data(
        tenant_id: int,
        data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
        current_user_id: int
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
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '用户名': 'username',
            '*用户名': 'username',
            'username': 'username',
            '*username': 'username',
            '邮箱': 'email',
            'email': 'email',
            '密码': 'password',
            '*密码': 'password',
            'password': 'password',
            '*password': 'password',
            '姓名': 'full_name',
            'full_name': 'full_name',
            '手机号': 'phone',
            'phone': 'phone',
            '部门': 'department',
            'department': 'department',
            '职位': 'position',
            'position': 'position',
            '角色': 'roles',
            'roles': 'roles',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['username', 'password']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                user_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            user_data[field] = str(value).strip()
                
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
                
                # 处理部门（通过名称或代码查找）
                department_id = None
                if user_data.get('department'):
                    department = await Department.filter(
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).filter(
                        Q(name=user_data['department']) | Q(code=user_data['department'])
                    ).first()
                    
                    if department:
                        department_id = department.id
                    else:
                        errors.append({
                            "row": row_idx,
                            "error": f"部门 {user_data['department']} 不存在"
                        })
                        failure_count += 1
                        continue
                
                # 处理职位（通过名称或代码查找）
                position_id = None
                if user_data.get('position'):
                    position = await Position.filter(
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).filter(
                        Q(name=user_data['position']) | Q(code=user_data['position'])
                    ).first()
                    
                    if position:
                        position_id = position.id
                    else:
                        errors.append({
                            "row": row_idx,
                            "error": f"职位 {user_data['position']} 不存在"
                        })
                        failure_count += 1
                        continue
                
                # 处理角色（通过名称或代码查找，支持多个，用逗号分隔）
                role_ids = []
                if user_data.get('roles'):
                    role_names = [r.strip() for r in user_data['roles'].split(',')]
                    roles = await Role.filter(
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).filter(
                        Q(name__in=role_names) | Q(code__in=role_names)
                    ).all()
                    
                    if len(roles) != len(role_names):
                        errors.append({
                            "row": row_idx,
                            "error": f"部分角色不存在: {', '.join(role_names)}"
                        })
                        failure_count += 1
                        continue
                    
                    role_ids = [role.id for role in roles]
                
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

