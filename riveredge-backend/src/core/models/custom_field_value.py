"""
自定义字段值模型模块

定义自定义字段值数据模型，用于存储自定义字段的值。
"""

from typing import Optional, Any
from datetime import date
from decimal import Decimal
from tortoise import fields
from .base import BaseModel


class CustomFieldValue(BaseModel):
    """
    自定义字段值模型
    
    用于存储自定义字段的值，支持多种数据类型。
    支持多组织隔离，每个组织有独立的字段值。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    但这里主要使用 custom_field_id（内部ID）关联，不使用 uuid。
    
    Attributes:
        id: 值ID（主键，自增ID，内部使用）
        custom_field_id: 关联自定义字段ID（内部使用自增ID）
        tenant_id: 组织ID（用于多组织数据隔离）
        record_id: 关联记录ID（内部使用自增ID）
        record_table: 关联表名
        value_text: 文本值
        value_number: 数值
        value_date: 日期值
        value_json: JSON值（用于复杂类型）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="值ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，但这里主要使用 custom_field_id
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    custom_field_id = fields.IntField(description="关联自定义字段ID（内部使用自增ID）")
    record_id = fields.IntField(description="关联记录ID（内部使用自增ID）")
    record_table = fields.CharField(max_length=50, description="关联表名")
    
    value_text = fields.TextField(null=True, description="文本值")
    value_number = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="数值")
    value_date = fields.DateField(null=True, description="日期值")
    value_json = fields.JSONField(null=True, description="JSON值（用于复杂类型）")

    # 软删除字段（虽然字段值表通常不删除，但保持一致性）
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_custom_field_values"
        indexes = [
            ("custom_field_id",),
            ("tenant_id",),
            ("record_table", "record_id"),
            ("created_at",),
        ]
    
    def get_value(self) -> Any:
        """
        根据字段类型获取值
        
        Returns:
            Any: 字段值
        """
        if self.value_text is not None:
            return self.value_text
        elif self.value_number is not None:
            return float(self.value_number)
        elif self.value_date is not None:
            return self.value_date
        elif self.value_json is not None:
            return self.value_json
        return None
    
    def get_stored_value(self, field_type: str) -> Any:
        """按字段类型解析存储值（multiselect/json 等不走 value_text 优先逻辑）。"""
        if field_type == "multiselect":
            if self.value_json is not None:
                return self.value_json if isinstance(self.value_json, list) else [self.value_json]
            return []
        if field_type == "json":
            return self.value_json
        return self.get_value()
    
    def set_value(self, value: Any, field_type: str, field_config: Optional[dict] = None) -> None:
        """
        根据字段类型设置值
        
        Args:
            value: 字段值
            field_type: 字段类型
            field_config: 字段配置（含 displayMode 等）
        """
        # 清空所有值字段
        self.value_text = None
        self.value_number = None
        self.value_date = None
        self.value_json = None
        
        if value is None:
            return

        config = field_config or {}
        display_mode = config.get("displayMode")

        if (
            field_type in ("associated_object", "associated_attribute")
            and display_mode == "multiselect"
        ):
            if isinstance(value, list):
                self.value_json = [item for item in value if item is not None and str(item).strip() != ""]
            else:
                self.value_json = [value]
            return
        
        if field_type in ("text", "textarea", "select"):
            self.value_text = str(value)
        elif field_type == "multiselect":
            if isinstance(value, list):
                self.value_json = [item for item in value if item is not None and str(item).strip() != ""]
            else:
                self.value_json = [value]
        elif field_type in ("number", "associated_object", "formula"):
            # associated_object 存储 VLOOKUP 结果（多为 id）；formula 存储计算结果
            self.value_number = Decimal(str(value))
        elif field_type == "associated_attribute":
            if value is None:
                return
            if isinstance(value, (int, float, Decimal)):
                self.value_number = Decimal(str(value))
            else:
                self.value_text = str(value)
        elif field_type == "date":
            if isinstance(value, date):
                self.value_date = value
            elif isinstance(value, str):
                # 尝试解析日期字符串
                from datetime import datetime
                try:
                    self.value_date = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
                except Exception:
                    pass
        elif field_type in ("time", "datetime"):
            self.value_text = str(value)
        elif field_type == "json":
            self.value_json = value
        elif field_type == "image":
            if isinstance(value, dict) and value.get("uuids"):
                uuids = value["uuids"]
                self.value_text = str(uuids[0]) if uuids else None
            elif isinstance(value, list) and value:
                self.value_text = str(value[0])
            elif value:
                self.value_text = str(value)
        elif field_type == "file":
            if isinstance(value, str):
                self.value_json = {"uuids": [value]}
            elif isinstance(value, list):
                self.value_json = {"uuids": [str(item) for item in value if item]}
            elif isinstance(value, dict) and "uuids" in value:
                self.value_json = {
                    "uuids": [str(item) for item in (value.get("uuids") or []) if item]
                }
    
    def __str__(self):
        """字符串表示"""
        return f"CustomFieldValue(field_id={self.custom_field_id}, record={self.record_table}:{self.record_id})"

