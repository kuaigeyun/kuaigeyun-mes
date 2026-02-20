"""
平台设置数据验证Schema模块

提供平台设置相关的数据验证和序列化。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from typing import Optional
from datetime import datetime
from pydantic import Field
from core.schemas.base import BaseSchema


class PlatformSettingsBase(BaseSchema):
    """平台设置基础schema"""
    platform_name: str = Field(..., max_length=200, description="平台名称")
    platform_logo: Optional[str] = Field(None, max_length=500, description="平台Logo URL")
    favicon: Optional[str] = Field(None, max_length=500, description="网站 Favicon URL（浏览器标签页图标）")
    platform_description: Optional[str] = Field(None, description="平台描述")
    platform_contact_email: Optional[str] = Field(None, max_length=255, description="平台联系邮箱")
    platform_contact_phone: Optional[str] = Field(None, max_length=50, description="平台联系电话")
    platform_website: Optional[str] = Field(None, max_length=500, description="平台网站")
    login_title: Optional[str] = Field(None, max_length=200, description="登录页标题")
    login_content: Optional[str] = Field(None, description="登录页内容描述")
    icp_license: Optional[str] = Field(None, max_length=100, description="ICP备案信息")
    theme_color: Optional[str] = Field("#1890ff", max_length=20, description="主题颜色")


class PlatformSettingsCreate(PlatformSettingsBase):
    """平台设置创建schema"""
    pass


class PlatformSettingsUpdate(BaseSchema):
    """平台设置更新schema"""
    platform_name: Optional[str] = Field(None, max_length=200, description="平台名称")
    platform_logo: Optional[str] = Field(None, max_length=500, description="平台Logo URL")
    favicon: Optional[str] = Field(None, max_length=500, description="网站 Favicon URL（浏览器标签页图标）")
    platform_description: Optional[str] = Field(None, description="平台描述")
    platform_contact_email: Optional[str] = Field(None, max_length=255, description="平台联系邮箱")
    platform_contact_phone: Optional[str] = Field(None, max_length=50, description="平台联系电话")
    platform_website: Optional[str] = Field(None, max_length=500, description="平台网站")
    login_title: Optional[str] = Field(None, max_length=200, description="登录页标题")
    login_content: Optional[str] = Field(None, description="登录页内容描述")
    icp_license: Optional[str] = Field(None, max_length=100, description="ICP备案信息")
    theme_color: Optional[str] = Field(None, max_length=20, description="主题颜色")


class PlatformSettingsResponse(PlatformSettingsBase):
    """平台设置响应schema"""
    id: int = Field(..., description="设置ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True

