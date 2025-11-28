"""
自定义字段模块

定义自定义的 Tortoise ORM 字段，解决时区兼容性问题
"""

from typing import Optional, Any
from datetime import datetime

from tortoise import fields
from tortoise.models import Model


class NaiveDatetimeField(fields.DatetimeField):
    """
    时区无关的 Datetime 字段
    
    重写 Tortoise ORM 的 DatetimeField，确保所有 datetime 值都是时区无关的（naive）。
    解决 PostgreSQL TIMESTAMPTZ 与 Python datetime 的时区兼容性问题。
    
    使用场景：
    - 当数据库使用 TIMESTAMPTZ 类型，但希望 Python 代码中始终使用 naive datetime
    - 避免在查询、排序、比较时出现 "can't subtract offset-naive and offset-aware datetimes" 错误
    """
    
    def to_python_value(self, value: Any) -> Optional[datetime]:
        """
        将数据库值转换为 Python 值，确保始终返回 naive datetime
        
        Args:
            value: 数据库返回的值（可能是 aware 或 naive datetime）
            
        Returns:
            Optional[datetime]: naive datetime 对象
        """
        if value is None:
            return None
        
        # 先调用父类方法进行基本转换（处理字符串、整数等）
        dt = super().to_python_value(value)
        
        # 确保返回的是 naive datetime（移除时区信息）
        if dt is not None and dt.tzinfo is not None:
            # 如果是 aware datetime，转换为 naive（移除时区信息）
            dt = dt.replace(tzinfo=None)
        
        return dt
    
    def to_db_value(
        self, value: Optional[Any], instance: "Union[Type[Model], Model]"
    ) -> Optional[Any]:
        """
        将 Python 值转换为数据库值，确保始终使用 naive datetime
        
        Args:
            value: Python datetime 值
            instance: 模型实例或模型类
            
        Returns:
            Optional[Any]: 数据库值
        """
        # 处理 auto_now 和 auto_now_add
        if hasattr(instance, "_saved_in_db") and (
            self.auto_now
            or (self.auto_now_add and getattr(instance, self.model_field_name, None) is None)
        ):
            # 使用 naive datetime
            now = datetime.now()
            setattr(instance, self.model_field_name, now)
            return now
        
        # 处理传入的 datetime 值
        if value is not None:
            if isinstance(value, datetime):
                # 确保是 naive datetime
                if value.tzinfo is not None:
                    value = value.replace(tzinfo=None)
        
        self.validate(value)
        return value

