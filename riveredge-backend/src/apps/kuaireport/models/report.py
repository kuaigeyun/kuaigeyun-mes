from tortoise import fields
from core.models.base import BaseModel
from apps.kuaireport.constants import ReportStatus

class Report(BaseModel):
    """
    报表模型
    
    支持多种报表引擎：Univer (spreadsheet) 或 Jimu (professional report)
    """
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="报表编码")
    name = fields.CharField(max_length=100, description="报表名称")
    
    # 报表引擎类型: 'univer' 或 'jimu'
    report_type = fields.CharField(max_length=20, default="univer", description="报表引擎类型")
    
    # 报表内容
    content = fields.JSONField(null=True, description="报表内容(Univer Snapshot)")
    template_config = fields.JSONField(null=True, description="积木报表模板配置")
    
    status = fields.CharField(max_length=20, default="DRAFT", description="状态")
    description = fields.TextField(null=True, description="描述")
    
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    class Meta:
        table = "apps_kuaireport_reports"
        table_description = "快格报表 - 报表定义"
        unique_together = (("tenant_id", "code"),)
        indexes = [
            ("tenant_id", "code"),
            ("tenant_id", "status"),
        ]
