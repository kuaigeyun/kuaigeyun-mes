"""
工单综合打分快照模型

按场景（排程 / 备料）持久化 composite_score 与 breakdown，供列表排序与 UI 展示。
"""

from tortoise import fields

from core.models.base import BaseModel


class WorkOrderScore(BaseModel):
    """
    工单综合打分快照

    scenario:
        - scheduling: 生产排程排序
        - picking: 备料/发料队列排序
    """

    work_order_id = fields.IntField(description="工单ID")
    scenario = fields.CharField(max_length=32, description="评分场景 scheduling/picking")
    composite_score = fields.DecimalField(max_digits=6, decimal_places=2, description="综合分 0-100")
    rank_band = fields.CharField(max_length=4, null=True, description="等级带 A/B/C")
    breakdown = fields.JSONField(description="维度分解明细")
    config_version = fields.CharField(max_length=64, default="default-v1", description="权重配置版本")
    computed_at = fields.DatetimeField(description="计算时间")

    class Meta:
        table = "apps_kuaizhizao_work_order_scores"
        table_description = "快格轻制造 - 工单综合打分快照"
        indexes = [
            ("tenant_id", "work_order_id", "scenario"),
            ("tenant_id", "scenario", "composite_score"),
            ("computed_at",),
        ]
        unique_together = [
            ("tenant_id", "work_order_id", "scenario"),
        ]
