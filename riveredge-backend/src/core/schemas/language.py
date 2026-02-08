"""
语言管理 Schema 模块

定义语言管理相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, ConfigDict


class LanguageBase(BaseModel):
    """
    语言基础 Schema
    
    包含语言的基本字段，用于创建和更新操作。
    """
    code: str = Field(..., min_length=2, max_length=10, description="语言代码（ISO 639-1，如：zh、en、ja）")
    name: str = Field(..., min_length=1, max_length=50, description="语言名称（如：中文、English、日本語）")
    native_name: Optional[str] = Field(None, max_length=50, description="本地名称（如：中文、English、日本語）")
    is_default: bool = Field(default=False, description="是否默认语言")
    is_active: bool = Field(default=True, description="是否启用")
    sort_order: int = Field(default=0, description="排序顺序")


class LanguageCreate(LanguageBase):
    """
    语言创建 Schema
    
    用于创建新语言的请求数据。
    """
    translations: Optional[Dict[str, str]] = Field(None, description="翻译内容（可选，创建时可初始化）")


class LanguageUpdate(BaseModel):
    """
    语言更新 Schema
    
    用于更新语言的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="语言名称")
    native_name: Optional[str] = Field(None, max_length=50, description="本地名称")
    is_default: Optional[bool] = Field(None, description="是否默认语言")
    is_active: Optional[bool] = Field(None, description="是否启用")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class LanguageResponse(LanguageBase):
    """
    语言响应 Schema
    
    用于返回语言信息。
    """
    uuid: str = Field(..., description="语言UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    translations: Dict[str, str] = Field(..., description="翻译内容（JSON 字典）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class LanguageListResponse(BaseModel):
    """
    语言列表响应 Schema

    用于返回语言列表（分页）。
    """
    items: List[LanguageResponse] = Field(..., description="语言列表")
    total: int = Field(..., ge=0, description="总数")


class TranslationUpdateRequest(BaseModel):
    """
    翻译更新请求 Schema
    
    用于更新翻译内容的请求数据。
    """
    translations: Dict[str, str] = Field(..., description="翻译内容（key-value 映射）")


class TranslationGetResponse(BaseModel):
    """
    翻译获取响应 Schema
    
    用于返回翻译内容。
    """
    translations: Dict[str, str] = Field(..., description="翻译内容（key-value 映射）")
    language_code: str = Field(..., description="语言代码")
    language_name: str = Field(..., description="语言名称")

