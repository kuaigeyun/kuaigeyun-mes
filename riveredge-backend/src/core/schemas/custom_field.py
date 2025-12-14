"""
自定义字段 Schema 模块

定义自定义字段相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class CustomFieldBase(BaseModel):
    """
    自定义字段基础 Schema
    
    包含自定义字段的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="字段名称")
    code: str = Field(..., min_length=1, max_length=50, description="字段代码（唯一，用于程序识别）")
    table_name: str = Field(..., min_length=1, max_length=50, description="关联表名")
    field_type: str = Field(..., description="字段类型：text、number、date、select、textarea、json")
    config: Optional[Dict[str, Any]] = Field(None, description="字段配置（JSON，存储默认值、验证规则、选项等）")
    label: Optional[str] = Field(None, max_length=100, description="字段标签（显示名称）")
    placeholder: Optional[str] = Field(None, max_length=200, description="占位符")
    is_required: bool = Field(default=False, description="是否必填")
    is_searchable: bool = Field(default=True, description="是否可搜索")
    is_sortable: bool = Field(default=True, description="是否可排序")
    sort_order: int = Field(default=0, description="排序顺序")
    is_active: bool = Field(default=True, description="是否启用")
    
    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str) -> str:
        """
        验证字段类型
        
        Args:
            v: 字段类型值
            
        Returns:
            验证后的字段类型值
            
        Raises:
            ValueError: 如果字段类型不合法
        """
        valid_types = ("text", "number", "date", "select", "textarea", "json")
        if v not in valid_types:
            raise ValueError(f"字段类型必须是 {valid_types} 之一")
        return v


class CustomFieldCreate(CustomFieldBase):
    """
    自定义字段创建 Schema
    
    用于创建新自定义字段的请求数据。
    """
    pass


class CustomFieldUpdate(BaseModel):
    """
    自定义字段更新 Schema
    
    用于更新自定义字段的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="字段名称")
    field_type: Optional[str] = Field(None, description="字段类型")
    config: Optional[Dict[str, Any]] = Field(None, description="字段配置")
    label: Optional[str] = Field(None, max_length=100, description="字段标签")
    placeholder: Optional[str] = Field(None, max_length=200, description="占位符")
    is_required: Optional[bool] = Field(None, description="是否必填")
    is_searchable: Optional[bool] = Field(None, description="是否可搜索")
    is_sortable: Optional[bool] = Field(None, description="是否可排序")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: Optional[str]) -> Optional[str]:
        """
        验证字段类型
        
        Args:
            v: 字段类型值
            
        Returns:
            验证后的字段类型值
            
        Raises:
            ValueError: 如果字段类型不合法
        """
        if v is not None:
            valid_types = ("text", "number", "date", "select", "textarea", "json")
            if v not in valid_types:
                raise ValueError(f"字段类型必须是 {valid_types} 之一")
        return v


class CustomFieldResponse(CustomFieldBase):
    """
    自定义字段响应 Schema
    
    用于返回自定义字段信息。
    """
    uuid: str = Field(..., description="字段UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class CustomFieldValueRequest(BaseModel):
    """
    自定义字段值请求 Schema
    
    用于设置自定义字段值的请求数据。
    """
    field_uuid: str = Field(..., description="字段UUID")
    value: Any = Field(..., description="字段值")


class CustomFieldValueResponse(BaseModel):
    """
    自定义字段值响应 Schema
    
    用于返回自定义字段值信息。
    """
    field_uuid: str = Field(..., description="字段UUID")
    field_code: str = Field(..., description="字段代码")
    field_name: str = Field(..., description="字段名称")
    value: Any = Field(..., description="字段值")
    
    model_config = ConfigDict(from_attributes=True)


class CustomFieldListResponse(BaseModel):
    """
    自定义字段列表响应 Schema
    
    用于返回自定义字段列表，包含分页信息。
    """
    items: List[CustomFieldResponse] = Field(..., description="自定义字段列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class BatchSetFieldValuesRequest(BaseModel):
    """
    批量设置字段值请求 Schema
    
    用于批量设置多个自定义字段值的请求数据。
    """
    record_id: int = Field(..., description="关联记录ID")
    record_table: str = Field(..., min_length=1, max_length=50, description="关联表名")
    values: List[CustomFieldValueRequest] = Field(..., description="字段值列表")

