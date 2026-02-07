"""
职位服务模块

提供职位的 CRUD 操作。
"""

from typing import Optional
from tortoise.expressions import Q

from core.models.position import Position
from core.models.department import Department
from core.schemas.position import PositionCreate, PositionUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

# 向后兼容别名
PermissionDeniedError = AuthorizationError


class PositionService:
    """
    职位服务类
    
    提供职位的 CRUD 操作。
    """
    
    @staticmethod
    async def create_position(
        tenant_id: int,
        data: PositionCreate,
        current_user_id: int
    ) -> Position:
        """
        创建职位
        
        Args:
            tenant_id: 组织ID
            data: 职位创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Position: 创建的职位对象
            
        Raises:
            ValidationError: 当部门不存在或不属于当前组织时抛出
            AuthorizationError: 当用户无权限时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 验证部门（如果提供）
        department_id = None
        if data.department_uuid:
            department = await Department.filter(
                uuid=data.department_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not department:
                raise ValidationError("部门不存在或不属于当前组织")
            
            department_id = department.id  # 转换为ID用于数据库关联
        
        # 创建职位
        position = await Position.create(
            tenant_id=tenant_id,
            name=data.name,
            code=data.code,
            description=data.description,
            department_id=department_id,
            sort_order=data.sort_order if data.sort_order is not None else 0,
            is_active=data.is_active if data.is_active is not None else True,
        )
        
        return position
    
    @staticmethod
    async def get_position_list(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        department_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> dict:
        """
        获取职位列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            department_uuid: 部门UUID筛选
            is_active: 是否启用筛选
            
        Returns:
            dict: 包含职位列表和分页信息
        """
        from core.utils.search_utils import list_with_search
        
        # 构建查询条件
        exact_filters = {'deleted_at__isnull': True}
        if is_active is not None:
            exact_filters['is_active'] = is_active
        
        # 字段搜索（用于高级搜索）
        if name:
            exact_filters['name__icontains'] = name
        if code:
            exact_filters['code__icontains'] = code
        
        # 处理部门筛选
        if department_uuid:
            department = await Department.filter(
                uuid=department_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if department:
                exact_filters['department_id'] = department.id
        
        # 限制分页大小，避免过大查询
        if page_size > 100:
            page_size = 100
        
        # 使用通用搜索工具（自动支持拼音首字母搜索）
        search_result = await list_with_search(
            model=Position,
            page=page,
            page_size=page_size,
            keyword=keyword,
            search_fields=['name', 'code', 'description'],
            exact_filters=exact_filters if exact_filters else None,
            allowed_sort_fields=['name', 'code', 'is_active', 'created_at', 'updated_at'],
            default_sort='-created_at',
            tenant_id=tenant_id,
            skip_tenant_filter=False
        )
        
        # 获取搜索结果的职位对象
        positions = search_result["items"]
        
        # 获取关联的部门信息和用户数量
        result = []
        for position in positions:
            department_info = None
            department_uuid = None
            if position.department_id:
                department = await Department.filter(
                    id=position.department_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if department:
                    department_info = {
                        "uuid": department.uuid,
                        "name": department.name,
                        "code": department.code,
                    }
                    department_uuid = department.uuid
            
            # 获取关联的用户数量
            from infra.models.user import User
            user_count = await User.filter(
                tenant_id=tenant_id,
                position_id=position.id,
                deleted_at__isnull=True
            ).count()

            result.append({
                "uuid": position.uuid,
                "name": position.name,
                "code": position.code,
                "description": position.description,
                "department_uuid": department_uuid,
                "department": department_info,
                "sort_order": position.sort_order,
                "is_active": position.is_active,
                "user_count": user_count,
                "created_at": position.created_at,
            })
        
        return {
            "items": result,
            "total": search_result["total"],
            "page": search_result["page"],
            "page_size": search_result["page_size"],
        }
    
    @staticmethod
    async def get_position_by_uuid(
        tenant_id: int,
        position_uuid: str
    ) -> Position:
        """
        根据UUID获取职位详情
        
        Args:
            tenant_id: 组织ID
            position_uuid: 职位UUID
            
        Returns:
            Position: 职位对象
            
        Raises:
            NotFoundError: 当职位不存在时抛出
        """
        position = await Position.filter(
            uuid=position_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not position:
            raise NotFoundError("职位", position_uuid)
        
        return position
    
    @staticmethod
    async def update_position(
        tenant_id: int,
        position_uuid: str,
        data: PositionUpdate,
        current_user_id: int
    ) -> Position:
        """
        更新职位
        
        Args:
            tenant_id: 组织ID
            position_uuid: 职位UUID
            data: 职位更新数据
            current_user_id: 当前用户ID
            
        Returns:
            Position: 更新后的职位对象
            
        Raises:
            NotFoundError: 当职位不存在时抛出
            ValidationError: 当部门不存在时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取职位
        position = await Position.filter(
            uuid=position_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not position:
            raise NotFoundError("职位", position_uuid)
        
        # 验证部门（如果更新）
        if data.department_uuid is not None:
            if data.department_uuid:
                department = await Department.filter(
                    uuid=data.department_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not department:
                    raise ValidationError("部门不存在或不属于当前组织")
                
                position.department_id = department.id
            else:
                position.department_id = None
        
        # 更新其他字段
        update_data = data.model_dump(exclude_unset=True, exclude={"department_uuid"})
        for key, value in update_data.items():
            setattr(position, key, value)
        
        await position.save()
        
        return position
    
    @staticmethod
    async def delete_position(
        tenant_id: int,
        position_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除职位
        
        Args:
            tenant_id: 组织ID
            position_uuid: 职位UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当职位不存在时抛出
            ValidationError: 当职位有关联用户时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取职位
        position = await Position.filter(
            uuid=position_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not position:
            raise NotFoundError("职位", position_uuid)
        
        # 检查是否有关联用户
        from infra.models.user import User
        user_count = await User.filter(
            tenant_id=tenant_id,
            position_id=position.id,
            deleted_at__isnull=True
        ).count()
        
        if user_count > 0:
            # 自动清理关联用户的职位字段（设置为NULL）
            await User.filter(
                tenant_id=tenant_id,
                position_id=position.id,
                deleted_at__isnull=True
            ).update(position_id=None)
        
        # 软删除
        from datetime import datetime
        position.deleted_at = datetime.now()
        await position.save()

