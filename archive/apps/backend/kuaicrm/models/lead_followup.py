"""
线索跟进记录模型模块

定义线索跟进记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class LeadFollowUp(BaseModel):
    """
    线索跟进记录模型
    
    用于记录线索的跟进历史，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        lead_id: 线索ID（关联Lead）
        followup_type: 跟进类型（电话、邮件、拜访、会议等）
        followup_content: 跟进内容
        followup_result: 跟进结果
        next_followup_date: 下次跟进日期
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_lead_followups"
        indexes = [
            ("tenant_id",),
            ("lead_id",),
            ("uuid",),
            ("followup_type",),
            ("next_followup_date",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联线索
    lead_id = fields.IntField(description="线索ID（关联Lead）")
    
    # 跟进信息
    followup_type = fields.CharField(max_length=50, description="跟进类型（电话、邮件、拜访、会议等）")
    followup_content = fields.TextField(description="跟进内容")
    followup_result = fields.CharField(max_length=200, null=True, description="跟进结果")
    next_followup_date = fields.DatetimeField(null=True, description="下次跟进日期")
    
    # 跟进人
    followup_by = fields.IntField(description="跟进人（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"LeadFollowUp {self.id} - {self.followup_type}"
