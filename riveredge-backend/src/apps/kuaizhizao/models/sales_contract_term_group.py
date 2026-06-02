"""
销售合同条款组
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesContractTermGroup(BaseModel):
    """销售合同条款组"""

    tenant_id = fields.IntField(description="租户ID")
    group_code = fields.CharField(max_length=50, null=True, description="条款组编码")
    group_name = fields.CharField(max_length=200, description="条款组名称")
    description = fields.TextField(null=True, description="描述")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_contract_term_groups"
        table_description = "快格轻制造 - 销售合同条款组"
        indexes = [
            ("tenant_id", "is_active"),
            ("tenant_id", "group_code"),
        ]
