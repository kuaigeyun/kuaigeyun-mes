"""
8D 质量问题解决报告模型
"""

from tortoise import fields

from core.models.base import BaseModel


class Quality8DReport(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_quality_8d_reports"
        table_description = "快格轻制造 - 8D 质量报告"
        indexes = [
            ("tenant_id",),
            ("report_code",),
            ("quality_exception_id",),
            ("defect_record_id",),
            ("status",),
            ("owner_id",),
            ("due_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "report_code")]

    id = fields.IntField(pk=True, description="主键ID")
    report_code = fields.CharField(max_length=50, description="8D 报告编码")
    quality_exception_id = fields.IntField(null=True, description="关联质量异常ID")
    defect_record_id = fields.IntField(null=True, description="关联不合格品台账ID")
    title = fields.CharField(max_length=200, description="报告标题")
    status = fields.CharField(max_length=30, default="d1_team", description="8D 阶段")
    severity = fields.CharField(max_length=20, default="major", description="严重程度")

    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    due_date = fields.DatetimeField(null=True, description="计划完成日期")
    closed_at = fields.DatetimeField(null=True, description="关闭时间")

    d1_team = fields.TextField(null=True, description="D1 团队组建")
    d2_problem = fields.TextField(null=True, description="D2 问题描述")
    d3_containment = fields.TextField(null=True, description="D3 临时遏制措施")
    d4_root_cause = fields.TextField(null=True, description="D4 根因分析")
    d5_corrective_action = fields.TextField(null=True, description="D5 纠正措施")
    d6_implement_result = fields.TextField(null=True, description="D6 实施验证")
    d7_prevent_recurrence = fields.TextField(null=True, description="D7 防再发措施")
    d8_team_congratulation = fields.TextField(null=True, description="D8 团队总结")
    verification_result = fields.TextField(null=True, description="验证结果")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
