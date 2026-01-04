"""
行业模板 Schema 模块

定义行业模板相关的 Pydantic Schema，用于 API 请求和响应的数据验证。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


class IndustryTemplateBase(BaseModel):
    """
    行业模板基础 Schema
    
    包含行业模板的通用字段定义
    
    Attributes:
        name: 模板名称
        code: 模板代码（唯一）
        industry: 行业类型（manufacturing、retail、service等）
        description: 模板描述
        config: 模板配置（JSON格式）
        is_active: 是否启用
        is_default: 是否默认模板
        sort_order: 排序顺序
    """
    
    name: str = Field(..., min_length=1, max_length=100, description="模板名称")
    code: str = Field(..., min_length=1, max_length=50, description="模板代码（唯一）")
    industry: str = Field(..., min_length=1, max_length=50, description="行业类型（manufacturing、retail、service等）")
    description: Optional[str] = Field(None, description="模板描述")
    config: Dict[str, Any] = Field(..., description="模板配置（JSON格式）")
    is_active: bool = Field(default=True, description="是否启用")
    is_default: bool = Field(default=False, description="是否默认模板")
    sort_order: int = Field(default=0, description="排序顺序")


class IndustryTemplateCreate(IndustryTemplateBase):
    """
    行业模板创建 Schema
    
    用于创建新行业模板时的数据验证
    """
    pass


class IndustryTemplateUpdate(BaseModel):
    """
    行业模板更新 Schema
    
    用于更新行业模板信息时的数据验证。
    所有字段都是可选的，只更新提供的字段。
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="模板名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="模板代码")
    industry: Optional[str] = Field(None, min_length=1, max_length=50, description="行业类型")
    description: Optional[str] = Field(None, description="模板描述")
    config: Optional[Dict[str, Any]] = Field(None, description="模板配置（JSON格式）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_default: Optional[bool] = Field(None, description="是否默认模板")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class IndustryTemplateResponse(IndustryTemplateBase):
    """
    行业模板响应 Schema
    
    用于返回行业模板信息
    """
    
    id: int = Field(..., description="模板ID")
    uuid: str = Field(..., description="模板UUID")
    usage_count: int = Field(..., description="使用次数")
    last_used_at: Optional[datetime] = Field(None, description="最后使用时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class IndustryTemplateListResponse(BaseModel):
    """
    行业模板列表响应 Schema
    
    用于返回行业模板列表
    """
    
    items: list[IndustryTemplateResponse] = Field(..., description="模板列表")
    total: int = Field(..., description="总数")


class ApplyTemplateRequest(BaseModel):
    """
    应用行业模板请求 Schema
    
    用于应用行业模板到指定组织
    """
    
    tenant_id: int = Field(..., description="组织ID")
    template_id: int = Field(..., description="模板ID")

