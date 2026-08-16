"""订单评审部门意见（每轮评审一套槽位）"""

from tortoise import fields
from core.models.base import BaseModel


class SalesReviewDeptOpinion(BaseModel):
    """部门评审意见"""

    tenant_id = fields.IntField(description="租户ID")
    sales_review_id = fields.IntField(description="订单评审单ID")
    review_round = fields.IntField(description="评审轮次")
    # tech / process / purchase / production / quality
    dept_code = fields.CharField(max_length=32, description="部门槽位编码")
    # pending / pass / fail
    result = fields.CharField(max_length=20, default="pending", description="评审结果")
    opinion = fields.TextField(null=True, description="评审意见")
    reviewed_by = fields.IntField(null=True, description="评审人ID")
    reviewed_by_name = fields.CharField(max_length=100, null=True, description="评审人姓名")
    reviewed_at = fields.DatetimeField(null=True, description="评审时间")

    class Meta:
        table = "apps_kuaizhizao_sales_review_dept_opinions"
        table_description = "快格轻制造 - 订单评审部门意见"
        unique_together = (("tenant_id", "sales_review_id", "dept_code", "review_round"),)
        indexes = [
            ("tenant_id", "sales_review_id", "review_round"),
        ]
