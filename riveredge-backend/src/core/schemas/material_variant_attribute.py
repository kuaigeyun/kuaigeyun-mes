"""
变体属性定义 Schema 模块

定义变体属性定义相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2026-01-08
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class MaterialVariantAttributeDefinitionBase(BaseModel):
    """
    变体属性定义基础 Schema
    
    包含变体属性定义的基本字段，用于创建和更新操作。
    """
    attribute_name: str = Field(..., min_length=1, max_length=50, description="属性名称（唯一标识，如：颜色、尺寸）")
    attribute_type: str = Field(..., description="属性类型（enum/text/number/date/boolean）")
    display_name: str = Field(..., min_length=1, max_length=100, description="显示名称（如：产品颜色）")
    description: Optional[str] = Field(None, description="属性描述")
    is_required: bool = Field(default=False, description="是否必填")
    display_order: int = Field(default=0, description="显示顺序")
    enum_values: Optional[List[str]] = Field(None, description="枚举值列表（如果type=enum）")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="验证规则（JSON格式）")
    default_value: Optional[str] = Field(None, max_length=200, description="默认值")
    dependencies: Optional[Dict[str, Any]] = Field(None, description="依赖关系（JSON格式）")
    is_active: bool = Field(default=True, description="是否启用")
    
    @field_validator("attribute_type")
    @classmethod
    def validate_attribute_type(cls, v: str) -> str:
        """
        验证属性类型
        
        Args:
            v: 属性类型值
            
        Returns:
            str: 验证后的属性类型
            
        Raises:
            ValueError: 如果属性类型不合法
        """
        valid_types = ["enum", "text", "number", "date", "boolean"]
        if v not in valid_types:
            raise ValueError(f"属性类型必须是以下之一: {', '.join(valid_types)}")
        return v
    
    @field_validator("enum_values")
    @classmethod
    def validate_enum_values(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        """
        验证枚举值列表
        
        如果属性类型为 enum，则枚举值列表不能为空。
        
        Args:
            v: 枚举值列表
            info: 验证上下文信息
            
        Returns:
            Optional[List[str]]: 验证后的枚举值列表
            
        Raises:
            ValueError: 如果属性类型为 enum 但枚举值列表为空
        """
        if info.data.get("attribute_type") == "enum":
            if not v or len(v) == 0:
                raise ValueError("属性类型为 enum 时，枚举值列表不能为空")
        return v


class MaterialVariantAttributeDefinitionCreate(MaterialVariantAttributeDefinitionBase):
    """
    创建变体属性定义 Schema
    
    用于创建新的变体属性定义。
    """
    pass


class MaterialVariantAttributeDefinitionUpdate(BaseModel):
    """
    更新变体属性定义 Schema
    
    用于更新变体属性定义，所有字段都是可选的。
    """
    attribute_name: Optional[str] = Field(None, min_length=1, max_length=50, description="属性名称")
    attribute_type: Optional[str] = Field(None, description="属性类型")
    display_name: Optional[str] = Field(None, min_length=1, max_length=100, description="显示名称")
    description: Optional[str] = Field(None, description="属性描述")
    is_required: Optional[bool] = Field(None, description="是否必填")
    display_order: Optional[int] = Field(None, description="显示顺序")
    enum_values: Optional[List[str]] = Field(None, description="枚举值列表")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="验证规则")
    default_value: Optional[str] = Field(None, max_length=200, description="默认值")
    dependencies: Optional[Dict[str, Any]] = Field(None, description="依赖关系")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @field_validator("attribute_type")
    @classmethod
    def validate_attribute_type(cls, v: Optional[str]) -> Optional[str]:
        """验证属性类型"""
        if v is not None:
            valid_types = ["enum", "text", "number", "date", "boolean"]
            if v not in valid_types:
                raise ValueError(f"属性类型必须是以下之一: {', '.join(valid_types)}")
        return v


class MaterialVariantAttributeDefinitionResponse(MaterialVariantAttributeDefinitionBase):
    """
    变体属性定义响应 Schema
    
    用于返回变体属性定义信息，包含所有字段和系统字段。
    """
    uuid: UUID = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="组织ID")
    version: int = Field(..., description="版本号")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialVariantAttributeHistoryResponse(BaseModel):
    """
    变体属性定义版本历史响应 Schema
    
    用于返回变体属性定义的版本历史信息。
    """
    uuid: UUID = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="组织ID")
    attribute_definition_id: int = Field(..., description="关联的属性定义ID")
    version: int = Field(..., description="版本号")
    attribute_config: Dict[str, Any] = Field(..., description="完整的属性配置（JSON格式）")
    change_description: Optional[str] = Field(None, description="变更说明")
    changed_by: Optional[int] = Field(None, description="变更人ID")
    changed_at: Optional[datetime] = Field(None, description="变更时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class VariantAttributeValidationRequest(BaseModel):
    """
    变体属性验证请求 Schema
    
    用于验证变体属性值是否符合定义。
    """
    attribute_name: str = Field(..., description="属性名称")
    attribute_value: Any = Field(..., description="属性值")


class VariantAttributeValidationResponse(BaseModel):
    """
    变体属性验证响应 Schema
    
    用于返回变体属性验证结果。
    """
    is_valid: bool = Field(..., description="是否有效")
    error_message: Optional[str] = Field(None, description="错误信息（如果无效）")
