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
    platform_name_en: Optional[str] = Field(None, max_length=200, description="平台名称（英文）")
    platform_logo: Optional[str] = Field(None, max_length=500, description="平台Logo URL")
    favicon: Optional[str] = Field(None, max_length=500, description="网站 Favicon URL（浏览器标签页图标）")
    platform_description: Optional[str] = Field(None, description="平台描述")
    platform_contact_email: Optional[str] = Field(None, max_length=255, description="平台联系邮箱")
    platform_contact_phone: Optional[str] = Field(None, max_length=50, description="平台联系电话")
    platform_website: Optional[str] = Field(None, max_length=500, description="平台网站")
    login_title: Optional[str] = Field(None, max_length=200, description="登录页标题")
    login_title_en: Optional[str] = Field(None, max_length=200, description="登录页标题（英文）")
    login_content: Optional[str] = Field(None, description="登录页内容描述")
    login_content_en: Optional[str] = Field(None, description="登录页内容描述（英文）")
    login_decoration_image: Optional[str] = Field(None, max_length=500, description="登录页装饰图（URL或文件UUID）")
    login_background_image: Optional[str] = Field(None, max_length=500, description="登录页左栏背景图（URL或文件UUID）")
    login_decoration_enabled: Optional[bool] = Field(True, description="是否启用登录页装饰图")
    login_background_enabled: Optional[bool] = Field(True, description="是否启用登录页背景图")
    icp_license: Optional[str] = Field(None, max_length=100, description="ICP备案信息")
    icp_license_en: Optional[str] = Field(None, max_length=100, description="ICP备案信息（英文）")
    theme_color: Optional[str] = Field("#1890ff", max_length=20, description="主题颜色")
    tenant_auto_approve: Optional[bool] = Field(False, description="是否自动审核：开启后，新注册的租户组织自动通过审核")
    float_button_enabled: Optional[bool] = Field(True, description="是否显示右下角悬浮按钮")
    login_guest_enabled: Optional[bool] = Field(True, description="登录页是否显示免注册体验登录")
    login_client_win_enabled: Optional[bool] = Field(True, description="登录页是否显示 Windows 工位机安装包下载")
    login_client_android_enabled: Optional[bool] = Field(True, description="登录页是否显示 Android PDA 安装包下载")
    login_quick_enabled: Optional[bool] = Field(True, description="登录页是否显示快捷登录（社交账号登录）")
    enable_register: Optional[bool] = Field(True, description="是否启用公开注册（登录页注册链接）")


class PlatformSettingsCreate(PlatformSettingsBase):
    """平台设置创建schema"""
    pass


class PlatformSettingsUpdate(BaseSchema):
    """平台设置更新schema"""
    platform_name: Optional[str] = Field(None, max_length=200, description="平台名称")
    platform_name_en: Optional[str] = Field(None, max_length=200, description="平台名称（英文）")
    platform_logo: Optional[str] = Field(None, max_length=500, description="平台Logo URL")
    favicon: Optional[str] = Field(None, max_length=500, description="网站 Favicon URL（浏览器标签页图标）")
    platform_description: Optional[str] = Field(None, description="平台描述")
    platform_contact_email: Optional[str] = Field(None, max_length=255, description="平台联系邮箱")
    platform_contact_phone: Optional[str] = Field(None, max_length=50, description="平台联系电话")
    platform_website: Optional[str] = Field(None, max_length=500, description="平台网站")
    login_title: Optional[str] = Field(None, max_length=200, description="登录页标题")
    login_title_en: Optional[str] = Field(None, max_length=200, description="登录页标题（英文）")
    login_content: Optional[str] = Field(None, description="登录页内容描述")
    login_content_en: Optional[str] = Field(None, description="登录页内容描述（英文）")
    login_decoration_image: Optional[str] = Field(None, max_length=500, description="登录页装饰图（URL或文件UUID）")
    login_background_image: Optional[str] = Field(None, max_length=500, description="登录页左栏背景图（URL或文件UUID）")
    login_decoration_enabled: Optional[bool] = Field(True, description="是否启用登录页装饰图")
    login_background_enabled: Optional[bool] = Field(True, description="是否启用登录页背景图")
    icp_license: Optional[str] = Field(None, max_length=100, description="ICP备案信息")
    icp_license_en: Optional[str] = Field(None, max_length=100, description="ICP备案信息（英文）")
    theme_color: Optional[str] = Field(None, max_length=20, description="主题颜色")
    tenant_auto_approve: Optional[bool] = Field(None, description="是否自动审核：开启后，新注册的租户组织自动通过审核")
    float_button_enabled: Optional[bool] = Field(None, description="是否显示右下角悬浮按钮")
    login_guest_enabled: Optional[bool] = Field(None, description="登录页是否显示免注册体验登录")
    login_client_win_enabled: Optional[bool] = Field(None, description="登录页是否显示 Windows 工位机安装包下载")
    login_client_android_enabled: Optional[bool] = Field(None, description="登录页是否显示 Android PDA 安装包下载")
    login_quick_enabled: Optional[bool] = Field(None, description="登录页是否显示快捷登录（社交账号登录）")
    enable_register: Optional[bool] = Field(None, description="是否启用公开注册（登录页注册链接）")


class PlatformSettingsResponse(PlatformSettingsBase):
    """平台设置响应schema"""
    id: int = Field(..., description="设置ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True

