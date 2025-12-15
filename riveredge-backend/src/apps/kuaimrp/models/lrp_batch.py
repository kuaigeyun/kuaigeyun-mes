"""
LRP批次需求模型模块

定义LRP批次需求数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class LRPBatch(BaseModel):
    """
    LRP批次需求模型
    
    用于管理LRP批次需求，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        batch_no: 批次编号（组织内唯一）
        batch_name: 批次名称
        order_ids: 关联订单ID列表（JSON格式）
        status: 批次状态（草稿、计算中、已完成、已关闭）
        planned_date: 计划日期
        delivery_date: 交期要求
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaimrp_lrp_batches"
        indexes = [
            ("tenant_id",),
            ("batch_no",),
            ("uuid",),
            ("status",),
            ("planned_date",),
            ("delivery_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "batch_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    batch_no = fields.CharField(max_length=50, description="批次编号（组织内唯一）")
    batch_name = fields.CharField(max_length=200, description="批次名称")
    order_ids = fields.JSONField(null=True, description="关联订单ID列表（JSON格式）")
    
    # 批次状态
    status = fields.CharField(max_length=50, default="草稿", description="批次状态（草稿、计算中、已完成、已关闭）")
    
    # 计划时间
    planned_date = fields.DatetimeField(null=True, description="计划日期")
    delivery_date = fields.DatetimeField(null=True, description="交期要求")
    
    # 批次参数（JSON格式）
    batch_params = fields.JSONField(null=True, description="批次参数（JSON格式）")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.batch_no} - {self.batch_name}"
