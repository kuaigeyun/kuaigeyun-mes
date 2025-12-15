"""
服务工单模型模块

定义服务工单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ServiceWorkOrder(BaseModel):
    """
    服务工单模型
    
    用于管理客户服务工单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        workorder_no: 工单编号（组织内唯一）
        workorder_type: 工单类型（安装、维修、保养、咨询等）
        customer_id: 客户ID（关联master-data）
        status: 工单状态
        priority: 优先级
        service_content: 服务内容
        assigned_to: 分配给（用户ID）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicrm_service_workorders"
        indexes = [
            ("tenant_id",),
            ("workorder_no",),
            ("uuid",),
            ("status",),
            ("workorder_type",),
            ("customer_id",),
            ("assigned_to",),
        ]
        unique_together = [("tenant_id", "workorder_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    workorder_no = fields.CharField(max_length=50, description="工单编号（组织内唯一）")
    workorder_type = fields.CharField(max_length=50, description="工单类型（安装、维修、保养、咨询等）")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    
    # 工单状态和优先级
    status = fields.CharField(max_length=50, default="待分配", description="工单状态（待分配、已分配、执行中、已完成、已关闭）")
    priority = fields.CharField(max_length=20, default="普通", description="优先级（普通、紧急、加急）")
    service_content = fields.TextField(description="服务内容")
    
    # 分配信息
    assigned_to = fields.IntField(null=True, description="分配给（用户ID）")
    
    # 执行信息
    start_time = fields.DatetimeField(null=True, description="开始时间")
    end_time = fields.DatetimeField(null=True, description="结束时间")
    execution_result = fields.TextField(null=True, description="执行结果")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.workorder_no} - {self.workorder_type}"
