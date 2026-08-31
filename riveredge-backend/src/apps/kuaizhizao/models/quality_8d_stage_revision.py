"""
8D 报告阶段修订历史
"""

from tortoise import fields

from core.models.base import BaseModel


class Quality8DStageRevision(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_quality_8d_stage_revisions"
        table_description = "快格轻制造 - 8D 阶段修订历史"
        indexes = [
            ("tenant_id",),
            ("report_id",),
            ("stage_key",),
            ("changed_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    report_id = fields.IntField(description="8D 报告ID")
    stage_key = fields.CharField(max_length=30, description="阶段键")
    revision_no = fields.IntField(description="阶段内修订序号")
    action = fields.CharField(max_length=30, description="save/unlock_request/transition_snapshot")
    content = fields.TextField(null=True, description="阶段正文快照")
    change_reason = fields.TextField(null=True, description="修改/解锁原因")
    changed_by = fields.IntField(null=True, description="操作人ID")
    changed_by_name = fields.CharField(max_length=100, null=True, description="操作人姓名")
    changed_at = fields.DatetimeField(description="操作时间")
