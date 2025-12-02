"""
部门服务模块

提供部门的 CRUD 操作和树形结构管理。
"""

from typing import List, Optional, Dict, Any
from tortoise.exceptions import IntegrityError

from tree_root.models.department import Department
from tree_root.models.user_role import UserRole
from tree_root.schemas.department import DepartmentCreate, DepartmentUpdate
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

# 向后兼容别名
PermissionDeniedError = AuthorizationError


class DepartmentService:
    """
    部门服务类
    
    提供部门的 CRUD 操作和树形结构管理。
    """
    
    @staticmethod
    async def create_department(
        tenant_id: int,
        data: DepartmentCreate,
        current_user_id: int
    ) -> Department:
        """
        创建部门
        
        Args:
            tenant_id: 组织ID
            data: 部门创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Department: 创建的部门对象
            
        Raises:
            ValidationError: 当父部门不存在或不属于当前组织时抛出
            AuthorizationError: 当用户无权限时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 验证父部门（如果提供）
        parent_id = None
        if data.parent_uuid:
            parent = await Department.filter(
                uuid=data.parent_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError("父部门不存在或不属于当前组织")
            
            # 检查循环引用（防止父部门是自己或子部门）
            # TODO: 实现循环引用检查逻辑
            
            parent_id = parent.id  # 转换为ID用于数据库关联
        
        # 验证部门负责人（如果提供）
        manager_id = None
        if data.manager_uuid:
            manager = await User.filter(
                uuid=data.manager_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not manager:
                raise ValidationError("部门负责人不存在或不属于当前组织")
            
            manager_id = manager.id  # 转换为ID用于数据库关联
        
        # 创建部门
        department = await Department.create(
            tenant_id=tenant_id,
            name=data.name,
            code=data.code,
            description=data.description,
            parent_id=parent_id,
            manager_id=manager_id,
            sort_order=data.sort_order if data.sort_order is not None else 0,
            is_active=data.is_active if data.is_active is not None else True,
        )
        
        return department
    
    @staticmethod
    async def get_department_tree(
        tenant_id: int,
        parent_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取部门树（递归）
        
        Args:
            tenant_id: 组织ID
            parent_id: 父部门ID（None 表示根部门）
            
        Returns:
            List[Dict]: 部门树列表
        """
        # 获取直接子部门
        departments = await Department.filter(
            tenant_id=tenant_id,
            parent_id=parent_id,  # 使用parent_id字段（ForeignKeyField的数据库字段名）
            # deleted_at__isnull=True  # 暂时移除，数据库表结构不一致
        ).order_by("sort_order", "id").all()
        
        result = []
        for dept in departments:
            # 获取子部门数量
            children_count = await Department.filter(
                tenant_id=tenant_id,
                parent_id=dept.id,  # 使用parent_id字段
                # deleted_at__isnull=True  # 暂时移除，数据库表结构不一致
            ).count()
            
            # 获取用户数量（假设 User 模型有 department_id 字段）
            user_count = await User.filter(
                tenant_id=tenant_id,
                department_id=dept.id,
                # deleted_at__isnull=True  # 暂时移除，数据库表结构不一致
            ).count()
            
            # 递归获取子部门
            children = await DepartmentService.get_department_tree(
                tenant_id=tenant_id,
                parent_id=dept.id
            )
            
            # 获取父部门的UUID（如果有的话）
            parent_uuid = None
            if dept.parent_id:
                parent_dept = await Department.get_or_none(id=dept.parent_id)
                parent_uuid = parent_dept.uuid if parent_dept else None

            result.append({
                "id": dept.id,  # ⚠️ 修复：添加 id 字段，供 API 层使用
                "uuid": dept.uuid,
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
                "parent_id": dept.parent_id,  # ⚠️ 修复：添加 parent_id 字段
                "parent_uuid": parent_uuid,
                "manager_id": dept.manager_id,  # ⚠️ 修复：添加 manager_id 字段
                # 获取管理者UUID（如果有的话）
                "manager_uuid": None,  # 暂时设为None，避免复杂查询
                # manager_uuid = None
                # if dept.manager_id:
                #     from soil.models.user import User
                #     manager_user = await User.get_or_none(id=dept.manager_id)
                #     manager_uuid = manager_user.uuid if manager_user else None
                "sort_order": dept.sort_order,
                "is_active": dept.is_active,
                "children_count": children_count,
                "user_count": user_count,
                "children": children,
            })
        
        return result
    
    @staticmethod
    async def get_department_by_uuid(
        tenant_id: int,
        department_uuid: str
    ) -> Department:
        """
        根据UUID获取部门详情
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            
        Returns:
            Department: 部门对象
            
        Raises:
            NotFoundError: 当部门不存在时抛出
        """
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        return department
    
    @staticmethod
    async def update_department(
        tenant_id: int,
        department_uuid: str,
        data: DepartmentUpdate,
        current_user_id: int
    ) -> Department:
        """
        更新部门
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            data: 部门更新数据
            current_user_id: 当前用户ID
            
        Returns:
            Department: 更新后的部门对象
            
        Raises:
            NotFoundError: 当部门不存在时抛出
            ValidationError: 当父部门无效或循环引用时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取部门
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        # 验证父部门（如果更新）
        if data.parent_uuid is not None:
            if data.parent_uuid == department_uuid:
                raise ValidationError("部门不能将自己设为父部门")
            
            if data.parent_uuid:
                parent = await Department.filter(
                    uuid=data.parent_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not parent:
                    raise ValidationError("父部门不存在或不属于当前组织")
                
                # 检查循环引用（防止父部门是子部门）
                # TODO: 实现循环引用检查逻辑
                
                department.parent_id = parent.id
            else:
                department.parent_id = None
        
        # 验证部门负责人（如果更新）
        if data.manager_uuid is not None:
            if data.manager_uuid:
                manager = await User.filter(
                    uuid=data.manager_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not manager:
                    raise ValidationError("部门负责人不存在或不属于当前组织")
                
                department.manager_id = manager.id
            else:
                department.manager_id = None
        
        # 更新其他字段
        update_data = data.model_dump(exclude_unset=True, exclude={"parent_uuid", "manager_uuid"})
        for key, value in update_data.items():
            setattr(department, key, value)
        
        await department.save()
        
        return department
    
    @staticmethod
    async def delete_department(
        tenant_id: int,
        department_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除部门
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当部门不存在时抛出
            ValidationError: 当部门有子部门或关联用户时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取部门
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        # 检查是否有子部门
        children_count = await Department.filter(
            tenant_id=tenant_id,
            parent_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        if children_count > 0:
            raise ValidationError(f"部门下存在子部门（{children_count}个），无法删除")
        
        # 检查是否有关联用户
        user_count = await User.filter(
            tenant_id=tenant_id,
            department_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        if user_count > 0:
            raise ValidationError(f"部门下存在用户（{user_count}人），无法删除")
        
        # 软删除
        from datetime import datetime
        department.deleted_at = datetime.now()
        await department.save()

