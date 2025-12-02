"""
系统参数 Schema 模块

定义系统参数相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, Union, Any, Dict, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class SystemParameterBase(BaseModel):
    """
    系统参数基础 Schema
    
    包含系统参数的基本字段，用于创建和更新操作。
    """
    key: str = Field(..., min_length=1, max_length=100, description="参数键（唯一，用于程序识别）")
    value: Union[str, int, float, bool, dict, list] = Field(..., description="参数值")
    type: str = Field(..., description="参数类型：string、number、boolean、json")
    description: Optional[str] = Field(None, description="参数描述")
    is_system: bool = Field(default=False, description="是否系统参数（系统参数不可删除）")
    is_active: bool = Field(default=True, description="是否启用")
    
    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """
        验证参数类型
        
        Args:
            v: 参数类型值
            
        Returns:
            验证后的参数类型
            
        Raises:
            ValueError: 如果参数类型不合法
        """
        if v not in ("string", "number", "boolean", "json"):
            raise ValueError("参数类型必须是 string、number、boolean 或 json")
        return v


class SystemParameterCreate(SystemParameterBase):
    """
    系统参数创建 Schema
    
    用于创建新系统参数的请求数据。
    """
    pass


class SystemParameterUpdate(BaseModel):
    """
    系统参数更新 Schema
    
    用于更新系统参数的请求数据，所有字段可选。
    """
    value: Optional[Union[str, int, float, bool, dict, list]] = Field(None, description="参数值")
    description: Optional[str] = Field(None, description="参数描述")
    is_active: Optional[bool] = Field(None, description="是否启用")


class SystemParameterResponse(BaseModel):
    """
    系统参数响应 Schema
    
    用于返回系统参数信息。
    """
    uuid: str = Field(..., description="参数UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    key: str = Field(..., description="参数键")
    value: Union[str, int, float, bool, dict, list] = Field(..., description="参数值")
    type: str = Field(..., description="参数类型")
    description: Optional[str] = Field(None, description="参数描述")
    is_system: bool = Field(..., description="是否系统参数")
    is_active: bool = Field(..., description="是否启用")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

