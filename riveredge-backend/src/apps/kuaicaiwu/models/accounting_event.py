"""
会计事件链路记录模型
"""

from tortoise import fields

from core.models.base import BaseModel


class AccountingEvent(BaseModel):
    """
    业务事件 -> 会计事件 的链路记录。
    用于补齐凭证链路追踪的最小闭环能力。
    """

    class Meta:
        table = "apps_kuaicaiwu_accounting_events"
        table_description = "管理会计 - 会计事件链路记录"
        indexes = [
            ("tenant_id", "event_type"),
            ("tenant_id", "source_doc_type", "source_doc_id"),
            ("tenant_id", "target_doc_type", "target_doc_id"),
            ("event_date",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    event_code = fields.CharField(max_length=50, db_index=True, description="事件编号")  # 租户内未删除唯一，见迁移 463
    event_type = fields.CharField(max_length=50, description="事件类型")
    business_type = fields.CharField(max_length=50, description="业务类型")

    source_doc_type = fields.CharField(max_length=50, null=True, description="源单据类型")
    source_doc_id = fields.IntField(null=True, description="源单据ID")
    source_doc_code = fields.CharField(max_length=50, null=True, description="源单据编号")

    target_doc_type = fields.CharField(max_length=50, null=True, description="目标单据类型")
    target_doc_id = fields.IntField(null=True, description="目标单据ID")
    target_doc_code = fields.CharField(max_length=50, null=True, description="目标单据编号")

    amount = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="业务金额")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    event_date = fields.DateField(description="事件日期")

    operator_id = fields.IntField(null=True, description="操作人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人姓名")

    payload = fields.JSONField(null=True, description="扩展快照")
    notes = fields.TextField(null=True, description="备注")

    def __str__(self):
        return f"AccountingEvent: {self.event_code} ({self.event_type})"
