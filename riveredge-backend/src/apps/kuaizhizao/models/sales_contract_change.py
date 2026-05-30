"""
销售合同变更单（补充协议）
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesContractChange(BaseModel):
    """销售合同变更单"""

    tenant_id = fields.IntField(description="租户ID")
    change_code = fields.CharField(max_length=50, db_index=True, description="变更单编码")
    contract_id = fields.IntField(description="原合同ID")
    contract_code = fields.CharField(max_length=50, description="原合同编码")

    change_type = fields.CharField(
        max_length=30,
        default="amendment",
        description="变更类型：amendment 补充 / extend 延期 / amount_adjust 金额调整",
    )
    status = fields.CharField(max_length=20, default="草稿", description="状态")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")

    delta_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="金额变更量")
    new_valid_to = fields.DateField(null=True, description="新失效日期")
    new_total_amount = fields.DecimalField(max_digits=14, decimal_places=2, null=True, description="变更后合同总额")

    reason = fields.TextField(null=True, description="变更原因")
    new_contract_id = fields.IntField(null=True, description="变更生效后新版本合同ID")

    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_contract_changes"
        table_description = "快格轻制造 - 销售合同变更单"
        indexes = [
            ("tenant_id", "contract_id"),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
