"""
系统级基础服务模块

提供所有服务的基类和通用功能。
"""

from typing import Type, TypeVar, Generic, Optional, List, Any
from tortoise.models import Model

T = TypeVar('T', bound=Model)


class BaseService(Generic[T]):
    """
    服务基类

    提供基本的CRUD操作和通用功能
    """

    def __init__(self, model: Optional[Type[T]] = None):
        """
        初始化服务

        Args:
            model: 关联的模型类
        """
        self.model = model

    async def get_by_id(self, id: int) -> Optional[T]:
        """
        根据ID获取记录

        Args:
            id: 记录ID

        Returns:
            记录对象或None
        """
        if not self.model:
            return None
        return await self.model.get_or_none(id=id)

    async def list_all(self, **filters) -> List[T]:
        """
        获取所有记录（支持筛选）

        Args:
            **filters: 筛选条件

        Returns:
            记录列表
        """
        if not self.model:
            return []
        return await self.model.filter(**filters)

    async def create(self, **data) -> T:
        """
        创建新记录

        Args:
            **data: 记录数据

        Returns:
            创建的记录对象
        """
        if not self.model:
            raise ValueError("Model not set")
        return await self.model.create(**data)

    async def update(self, id: int, **data) -> Optional[T]:
        """
        更新记录

        Args:
            id: 记录ID
            **data: 更新数据

        Returns:
            更新后的记录对象或None
        """
        if not self.model:
            return None

        record = await self.model.get_or_none(id=id)
        if record:
            await record.update_from_dict(data).save()
            return record
        return None

    async def delete(self, id: int) -> bool:
        """
        删除记录

        Args:
            id: 记录ID

        Returns:
            是否删除成功
        """
        if not self.model:
            return False

        record = await self.model.get_or_none(id=id)
        if record:
            await record.delete()
            return True
        return False


