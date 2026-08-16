"""
凭证摘要库
"""

from tortoise import fields

from core.models.base import BaseModel


class VoucherSummaryEntry(BaseModel):
    """常用摘要。"""

    class Meta:
        table = "apps_kuaicaiwu_voucher_summaries"
        table_description = "总账 - 摘要库"
        indexes = [("tenant_id", "is_active")]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    content = fields.CharField(max_length=500, description="摘要内容")
    is_active = fields.BooleanField(default=True, description="是否启用")
    sort_order = fields.IntField(default=0, description="排序")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
