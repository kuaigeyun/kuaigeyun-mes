"""
操作员工序上岗资质
"""

from tortoise import fields

from core.models.base import BaseModel


class OperatorSkillQualification(BaseModel):
    """员工对主数据工序的上岗资质"""

    class Meta:
        table = "apps_kuaizhizao_operator_skill_qualifications"
        table_description = "快格轻制造 - 操作员工序技能资质"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("user_id",),
            ("operation_id",),
            ("tenant_id", "user_id", "operation_id"),
        ]

    tenant_id = fields.IntField(description="租户ID")
    user_id = fields.IntField(description="用户ID")
    user_name = fields.CharField(max_length=100, null=True, description="用户姓名快照")
    operation_id = fields.IntField(description="主数据工序ID")
    operation_code = fields.CharField(max_length=50, null=True, description="工序编码")
    operation_name = fields.CharField(max_length=100, null=True, description="工序名称")
    skill_level = fields.CharField(max_length=32, default="qualified", description="资质等级")
    valid_from = fields.DatetimeField(null=True, description="生效时间")
    valid_until = fields.DatetimeField(null=True, description="失效时间")
    is_active = fields.BooleanField(default=True, description="是否有效")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
