"""
计划调整模型模块

定义计划调整数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class PlanAdjustment(BaseModel):
    """
    计划调整模型
    
    用于管理计划调整，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        adjustment_no: 调整单编号（组织内唯一）
        adjustment_name: 调整名称
        adjustment_type: 调整类型（计划变更、紧急插单、计划重排）
        plan_id: 计划ID（关联production_plan）
        plan_uuid: 计划UUID
        plan_no: 计划编号
        adjustment_reason: 调整原因
        impact_analysis: 影响分析（JSON格式）
        original_plan_data: 原计划数据（JSON格式）
        adjusted_plan_data: 调整后计划数据（JSON格式）
        approval_status: 审批状态（待审批、审批中、已批准、已拒绝）
        approval_person_id: 审批人ID
        approval_person_name: 审批人姓名
        approval_date: 审批日期
        adjustment_status: 调整状态（待调整、调整中、已完成、已取消）
        status: 状态（草稿、已提交、已审批、已执行、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiaps_plan_adjustments"
        indexes = [
            ("tenant_id",),
            ("adjustment_no",),
            ("adjustment_type",),
            ("plan_id",),
            ("approval_status",),
            ("adjustment_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "adjustment_no")]
    
    adjustment_no = fields.CharField(max_length=100, description="调整单编号")
    adjustment_name = fields.CharField(max_length=200, description="调整名称")
    adjustment_type = fields.CharField(max_length=50, description="调整类型")
    plan_id = fields.IntField(null=True, description="计划ID")
    plan_uuid = fields.CharField(max_length=36, null=True, description="计划UUID")
    plan_no = fields.CharField(max_length=100, null=True, description="计划编号")
    adjustment_reason = fields.TextField(null=True, description="调整原因")
    impact_analysis = fields.JSONField(null=True, description="影响分析")
    original_plan_data = fields.JSONField(null=True, description="原计划数据")
    adjusted_plan_data = fields.JSONField(null=True, description="调整后计划数据")
    approval_status = fields.CharField(max_length=50, default="待审批", description="审批状态")
    approval_person_id = fields.IntField(null=True, description="审批人ID")
    approval_person_name = fields.CharField(max_length=100, null=True, description="审批人姓名")
    approval_date = fields.DatetimeField(null=True, description="审批日期")
    adjustment_status = fields.CharField(max_length=50, default="待调整", description="调整状态")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

