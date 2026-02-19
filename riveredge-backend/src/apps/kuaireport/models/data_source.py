from tortoise import fields
from core.models.base import BaseModel
from apps.kuaireport.constants import DataSourceType

class DataSource(BaseModel):
    """
    数据源模型
    
    用于存储外部数据源连接信息
    """
    tenant_id = fields.IntField(description="租户ID")
    name = fields.CharField(max_length=100, description="数据源名称")
    type = fields.CharField(max_length=20, default=DataSourceType.STATIC, description="类型")
    
    # 连接配置，例如数据库连接串或API URL
    # 敏感信息应当加密存储，此处简化处理，实际生产建议结合 Vault 或加密字段
    config = fields.JSONField(null=True, description="连接配置")
    
    description = fields.TextField(null=True, description="描述")
    
    is_default = fields.BooleanField(default=False, description="是否为默认数据源")
    is_system = fields.BooleanField(default=False, description="是否为系统预置")
    
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")

    class Meta:
        table = "apps_kuaireport_data_sources"
        table_description = "快格报表 - 数据源"
        indexes = [
            ("tenant_id", "type"),
        ]
