"""
工程变更模型模块

定义工程变更数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class EngineeringChange(BaseModel):
    """
    工程变更模型
    
    用于管理工程变更申请、审批、执行等流程，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        change_no: 变更编号（组织内唯一）
        change_type: 变更类型（设计变更、工艺变更、材料变更等）
        change_reason: 变更原因
        change_content: 变更内容描述
        change_impact: 变更影响分析
        priority: 优先级（普通、紧急、加急）
        status: 变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）
        product_id: 关联产品ID（关联master-data）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态（pending、approved、rejected、cancelled）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipdm_engineering_changes"
        indexes = [
            ("tenant_id",),
            ("change_no",),
            ("uuid",),
            ("status",),
            ("change_type",),
            ("product_id",),
            ("approval_instance_id",),
            ("approval_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "change_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    change_no = fields.CharField(max_length=50, description="变更编号（组织内唯一）")
    change_type = fields.CharField(max_length=50, description="变更类型（设计变更、工艺变更、材料变更等）")
    change_reason = fields.TextField(description="变更原因")
    change_content = fields.TextField(description="变更内容描述")
    change_impact = fields.TextField(null=True, description="变更影响分析")
    priority = fields.CharField(max_length=20, default="普通", description="优先级（普通、紧急、加急）")
    
    # 变更状态
    status = fields.CharField(max_length=50, default="待审批", description="变更状态（待审批、审批中、已批准、执行中、已完成、已关闭）")
    
    # 关联信息
    product_id = fields.IntField(null=True, description="关联产品ID（关联master-data）")
    
    # 审批相关字段
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 执行信息
    executor_id = fields.IntField(null=True, description="执行人ID（用户ID）")
    execution_start_date = fields.DatetimeField(null=True, description="执行开始日期")
    execution_end_date = fields.DatetimeField(null=True, description="执行结束日期")
    execution_result = fields.TextField(null=True, description="执行结果")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.change_no} - {self.change_type}"
