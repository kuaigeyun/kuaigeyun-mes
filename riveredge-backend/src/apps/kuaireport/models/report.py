from tortoise import fields
from core.models.base import BaseModel
from apps.kuaireport.constants import ReportStatus, ReportCategory


class Report(BaseModel):
    """
    报表模型

    支持系统预置报表和用户自定义报表两种模式。
    """
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="报表编码")
    name = fields.CharField(max_length=100, description="报表名称")
    description = fields.TextField(null=True, description="描述")

    # 分类：system（系统报表）/ custom（用户自定义）
    category = fields.CharField(
        max_length=20, default="custom", description="报表分类"
    )
    # 是否为系统预置报表（系统报表不允许普通用户修改/删除）
    is_system = fields.BooleanField(default=False, description="是否系统报表")
    # 自定义报表所有者（系统报表为 null）
    owner_id = fields.IntField(null=True, description="所有者用户ID")

    # 自研报表配置（图表类型、数据集引用、字段映射、过滤器等）
    report_config = fields.JSONField(null=True, description="报表配置")

    status = fields.CharField(max_length=20, default="DRAFT", description="状态")

    # 分享相关
    is_shared = fields.BooleanField(default=False, description="是否已分享")
    share_token = fields.CharField(max_length=64, null=True, description="分享令牌（用于公开链接）")
    share_expires_at = fields.DatetimeField(null=True, description="分享链接过期时间")

    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    class Meta:
        table = "apps_kuaireport_reports"
        table_description = "报表中心 - 报表定义"
        unique_together = (("tenant_id", "code"),)
        indexes = [
            ("tenant_id", "code"),
            ("tenant_id", "status"),
            ("tenant_id", "category"),
            ("tenant_id", "owner_id"),
        ]
