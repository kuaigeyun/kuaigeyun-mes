"""
销售合同条款项
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesContractTermItem(BaseModel):
    """销售合同条款项（可复用）"""

    tenant_id = fields.IntField(description="租户ID")
    term_code = fields.CharField(max_length=50, null=True, description="条款编码")
    term_name = fields.CharField(max_length=200, description="条款名称")
    content = fields.TextField(description="条款内容")
    sort_order = fields.IntField(default=0, description="排序")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_contract_term_items"
        table_description = "快格轻制造 - 销售合同条款项"
        indexes = [
            ("tenant_id", "is_active"),
            ("tenant_id", "term_code"),
        ]
