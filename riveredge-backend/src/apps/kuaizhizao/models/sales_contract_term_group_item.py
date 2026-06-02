"""
销售合同条款组与条款项关联
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesContractTermGroupItem(BaseModel):
    """条款组内条款项（含排序）"""

    tenant_id = fields.IntField(description="租户ID")
    group_id = fields.IntField(description="条款组ID")
    term_item_id = fields.IntField(description="条款项ID")
    sort_order = fields.IntField(default=0, description="组内排序")

    class Meta:
        table = "apps_kuaizhizao_sales_contract_term_group_items"
        table_description = "快格轻制造 - 销售合同条款组明细"
        indexes = [
            ("tenant_id", "group_id"),
            ("group_id", "term_item_id"),
        ]
        unique_together = (("tenant_id", "group_id", "term_item_id"),)
