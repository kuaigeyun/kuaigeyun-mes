from tortoise import fields
from core.models.base import BaseModel
from apps.kuaireport.constants import ReportStatus

class Dashboard(BaseModel):
    """
    大屏/看板模型
    
    用于存储大屏布局与组件配置
    """
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, unique=True, description="看板编码")
    name = fields.CharField(max_length=100, description="看板名称")
    
    # 核心配置
    layout_config = fields.JSONField(null=True, description="布局配置(RGL Layout)")
    widgets_config = fields.JSONField(null=True, description="组件配置(Widgets Data)")
    theme_config = fields.JSONField(null=True, description="主题/全局配置")
    
    status = fields.CharField(max_length=20, default="DRAFT", description="状态")
    description = fields.TextField(null=True, description="描述")
    thumbnail = fields.CharField(max_length=500, null=True, description="缩略图URL")

    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    class Meta:
        table = "apps_kuaireport_dashboards"
        table_description = "快格报表 - 大屏定义"
        indexes = [
            ("tenant_id", "code"),
            ("tenant_id", "status"),
        ]
