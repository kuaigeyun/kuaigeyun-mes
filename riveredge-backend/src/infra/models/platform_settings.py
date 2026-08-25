"""
平台设置模型模块

定义平台设置数据模型，用于存储平台级配置信息。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from core.utils.timezone_utils import now_utc
from tortoise import fields
from tortoise.models import Model


class PlatformSettings(Model):
    """
    平台设置模型
    
    存储平台级配置信息，如平台名称、Logo等。
    平台设置是全局唯一的，整个系统只有一条记录。
    
    Attributes:
        id: 主键ID
        platform_name: 平台名称
        platform_logo: 平台Logo URL（可选）
        platform_description: 平台描述（可选）
        platform_contact_email: 平台联系邮箱（可选）
        platform_contact_phone: 平台联系电话（可选）
        platform_website: 平台网站（可选）
        login_title: 登录页标题（中文）
        login_title_en: 登录页标题（英文）
        login_content: 登录页内容描述（中文）
        login_content_en: 登录页内容描述（英文）
        icp_license: ICP备案信息（中文）
        icp_license_en: ICP备案信息（英文）
        theme_color: 主题颜色
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "infra_platform_settings"
        indexes = [
            ("platform_name",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 平台基本信息
    platform_name = fields.CharField(
        max_length=200,
        default="RiverEdge SaaS Framework",
        description="平台名称"
    )
    platform_name_en = fields.CharField(
        max_length=200,
        null=True,
        description="平台名称（英文）"
    )
    platform_logo = fields.CharField(
        max_length=500,
        null=True,
        description="平台Logo URL"
    )
    favicon = fields.CharField(
        max_length=500,
        null=True,
        description="网站 Favicon URL（浏览器标签页图标）"
    )
    platform_description = fields.TextField(
        null=True,
        description="平台描述"
    )
    
    # 平台联系信息
    platform_contact_email = fields.CharField(
        max_length=255,
        null=True,
        description="平台联系邮箱"
    )
    platform_contact_phone = fields.CharField(
        max_length=50,
        null=True,
        description="平台联系电话"
    )
    platform_website = fields.CharField(
        max_length=500,
        null=True,
        description="平台网站"
    )
    
    # 登录页配置
    login_title = fields.CharField(
        max_length=200,
        null=True,
        description="登录页标题（中文）"
    )
    login_title_en = fields.CharField(
        max_length=200,
        null=True,
        description="登录页标题（英文）"
    )
    login_content = fields.TextField(
        null=True,
        description="登录页内容描述（中文）"
    )
    login_content_en = fields.TextField(
        null=True,
        description="登录页内容描述（英文）"
    )
    login_decoration_image = fields.CharField(
        max_length=500,
        null=True,
        description="登录页装饰图（URL或文件UUID）"
    )
    login_background_image = fields.CharField(
        max_length=500,
        null=True,
        description="登录页左栏背景图（URL或文件UUID）"
    )
    login_decoration_enabled = fields.BooleanField(
        default=True,
        description="是否启用登录页装饰图"
    )
    login_background_enabled = fields.BooleanField(
        default=True,
        description="是否启用登录页背景图"
    )
    icp_license = fields.CharField(
        max_length=100,
        null=True,
        description="ICP备案信息（中文）"
    )
    icp_license_en = fields.CharField(
        max_length=100,
        null=True,
        description="ICP备案信息（英文）"
    )
    theme_color = fields.CharField(
        max_length=20,
        null=True,
        default="#1890ff",
        description="主题颜色"
    )

    # 组织注册审核
    tenant_auto_approve = fields.BooleanField(
        default=False,
        description="是否自动审核：开启后，新注册的租户组织自动通过审核"
    )

    # 私有单体部署：登录（含企微扫码）在未指定组织时使用的默认租户
    default_tenant_id = fields.IntField(
        null=True,
        description="平台默认登录租户 ID（私有单体部署可跳过选组织）",
    )

    # 右下角悬浮按钮（迭代提示、意见反馈）
    float_button_enabled = fields.BooleanField(
        default=True,
        description="是否显示右下角悬浮按钮：包含系统迭代提示与意见反馈入口"
    )

    # 顶栏用户菜单「版权声明」
    copyright_menu_enabled = fields.BooleanField(
        default=True,
        description="是否显示顶栏用户菜单中的版权声明入口"
    )

    # 应用中心「定制应用」空态商务咨询二维码
    custom_apps_contact_qr_enabled = fields.BooleanField(
        default=False,
        description="是否显示应用中心定制应用空态的商务咨询二维码",
    )

    login_guest_enabled = fields.BooleanField(
        default=True,
        description="登录页是否显示免注册体验登录"
    )
    login_client_win_enabled = fields.BooleanField(
        default=True,
        description="登录页是否显示 Windows 工位机安装包下载"
    )
    login_client_android_enabled = fields.BooleanField(
        default=True,
        description="登录页是否显示 Android PDA 安装包下载"
    )
    header_miniprogram_qr_enabled = fields.BooleanField(
        default=False,
        description="是否在主界面顶栏展示小程序码入口",
    )
    header_miniprogram_qr_uuid = fields.CharField(
        max_length=64,
        null=True,
        description="小程序码图片文件 UUID（category=miniprogram-qr）",
    )
    login_quick_enabled = fields.BooleanField(
        default=True,
        description="登录页是否显示快捷登录（社交账号登录）"
    )
    enable_register = fields.BooleanField(
        default=True,
        description="是否启用公开注册（登录页注册链接）"
    )

    # 时间字段
    created_at = fields.DatetimeField(
        default=now_utc,
        description="创建时间"
    )
    updated_at = fields.DatetimeField(
        default=now_utc,
        description="更新时间"
    )
    
    def __str__(self):
        """字符串表示"""
        return f"PlatformSettings: {self.platform_name}"

