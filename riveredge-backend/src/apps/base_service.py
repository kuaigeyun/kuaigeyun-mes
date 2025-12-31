"""
应用级服务基类模块

提供应用级服务的通用功能，统一代码实现模式。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import Type, TypeVar, Generic, Optional, List, Any, Dict
from datetime import datetime
from tortoise.models import Model
from tortoise.transactions import in_transaction
from loguru import logger

from core.services.base import BaseService
from core.services.business.code_generation_service import CodeGenerationService
from infra.services.user_service import UserService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

T = TypeVar('T', bound=Model)


class AppBaseService(BaseService[T]):
    """
    应用级服务基类

    提供应用级服务的通用功能：
    - 统一的代码生成
    - 统一的用户信息获取
    - 统一的事务管理
    - 统一的CRUD操作（带租户隔离）
    """

    def __init__(self, model: Optional[Type[T]] = None):
        """
        初始化服务

        Args:
            model: 关联的模型类
        """
        super().__init__(model)

    # ==================== 代码生成 ====================

    async def generate_code(
        self,
        tenant_id: int,
        code_type: str,
        prefix: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        生成业务单据编码

        Args:
            tenant_id: 租户ID
            code_type: 代码类型（如：WORK_ORDER_CODE, PURCHASE_ORDER_CODE等）
            prefix: 编码前缀（可选，如果不提供则使用默认前缀）
            **kwargs: 其他参数

        Returns:
            str: 生成的编码
        """
        if prefix is None:
            # 如果没有提供前缀，使用日期作为默认前缀
            today = datetime.now().strftime("%Y%m%d")
            prefix = today

        # 构建上下文变量
        context = {"prefix": prefix, **kwargs}
        
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=code_type,
            context=context
        )

    # ==================== 用户信息获取 ====================

    async def get_user_info(self, user_id: int) -> Dict[str, Any]:
        """
        获取用户信息

        Args:
            user_id: 用户ID

        Returns:
            Dict: 用户信息（包含id, username, name等）
        """
        user = await UserService.get_user_by_id(user_id)
        user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
        
        return {
            "id": user.id,
            "username": user.username,
            "name": user_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        }

    async def get_user_name(self, user_id: int) -> str:
        """
        获取用户名称（格式化后的）

        Args:
            user_id: 用户ID

        Returns:
            str: 用户名称
        """
        user_info = await self.get_user_info(user_id)
        return user_info["name"]

    # ==================== 租户隔离的CRUD操作 ====================

    async def get_by_id(
        self,
        tenant_id: int,
        record_id: int,
        raise_if_not_found: bool = True
    ) -> Optional[T]:
        """
        根据ID获取记录（带租户隔离）

        Args:
            tenant_id: 租户ID
            record_id: 记录ID
            raise_if_not_found: 如果记录不存在是否抛出异常

        Returns:
            记录对象或None

        Raises:
            NotFoundError: 当记录不存在且raise_if_not_found=True时抛出
        """
        if not self.model:
            if raise_if_not_found:
                raise ValueError("Model not set")
            return None

        record = await self.model.get_or_none(
            tenant_id=tenant_id,
            id=record_id
        )

        if not record and raise_if_not_found:
            raise NotFoundError(f"记录不存在: {record_id}")

        return record

    async def list_all(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        **filters
    ) -> List[T]:
        """
        获取所有记录（带租户隔离和分页）

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            **filters: 其他筛选条件

        Returns:
            记录列表
        """
        if not self.model:
            return []

        query = self.model.filter(tenant_id=tenant_id, **filters)
        return await query.offset(skip).limit(limit).all()

    async def create_with_user(
        self,
        tenant_id: int,
        created_by: int,
        **data
    ) -> T:
        """
        创建记录（自动添加用户信息）

        Args:
            tenant_id: 租户ID
            created_by: 创建人ID
            **data: 记录数据

        Returns:
            创建的记录对象
        """
        if not self.model:
            raise ValueError("Model not set")

        # 获取用户信息
        user_info = await self.get_user_info(created_by)

        # 添加租户和用户信息
        data.update({
            'tenant_id': tenant_id,
            'created_by': created_by,
            'created_by_name': user_info['name']
        })

        return await self.model.create(**data)

    async def update_with_user(
        self,
        tenant_id: int,
        record_id: int,
        updated_by: int,
        **data
    ) -> Optional[T]:
        """
        更新记录（自动添加用户信息）

        Args:
            tenant_id: 租户ID
            record_id: 记录ID
            updated_by: 更新人ID
            **data: 更新数据

        Returns:
            更新后的记录对象或None

        Raises:
            NotFoundError: 当记录不存在时抛出
        """
        if not self.model:
            raise ValueError("Model not set")

        record = await self.get_by_id(tenant_id, record_id, raise_if_not_found=True)

        # 获取用户信息
        user_info = await self.get_user_info(updated_by)

        # 添加更新人信息
        data.update({
            'updated_by': updated_by,
            'updated_by_name': user_info['name']
        })

        await record.update_from_dict(data).save()
        return record

    async def delete_with_validation(
        self,
        tenant_id: int,
        record_id: int,
        validate_func: Optional[callable] = None,
        soft_delete: bool = True
    ) -> bool:
        """
        删除记录（带验证和软删除支持）

        Args:
            tenant_id: 租户ID
            record_id: 记录ID
            validate_func: 验证函数（可选，用于检查是否可以删除）
            soft_delete: 是否软删除（默认：True）

        Returns:
            是否删除成功

        Raises:
            NotFoundError: 当记录不存在时抛出
            BusinessLogicError: 当验证失败时抛出
        """
        if not self.model:
            raise ValueError("Model not set")

        record = await self.get_by_id(tenant_id, record_id, raise_if_not_found=True)

        # 验证是否可以删除
        if validate_func:
            validate_func(record)

        # 删除记录
        if soft_delete and hasattr(record, 'deleted_at'):
            # 软删除
            await self.model.filter(
                tenant_id=tenant_id,
                id=record_id
            ).update(deleted_at=datetime.now())
        else:
            # 硬删除
            await record.delete()

        return True

    # ==================== 事务管理装饰器 ====================

    @staticmethod
    def with_transaction(func):
        """
        事务管理装饰器

        自动为方法添加事务管理

        Usage:
            @AppBaseService.with_transaction
            async def my_method(self, ...):
                ...
        """
        async def wrapper(*args, **kwargs):
            async with in_transaction():
                return await func(*args, **kwargs)
        return wrapper

