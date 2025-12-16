"""
库存调整模型模块

定义库存调整数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class InventoryAdjustment(BaseModel):
    """
    库存调整模型
    
    用于管理库存调整，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        adjustment_no: 调整单编号（组织内唯一）
        adjustment_date: 调整日期
        warehouse_id: 仓库ID（关联master-data）
        adjustment_type: 调整类型（盘盈、盘亏、其他调整）
        adjustment_reason: 调整原因
        status: 调整状态（草稿、待审批、已审批、已执行、已关闭）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态（pending、approved、rejected、cancelled）
        adjustment_items: 调整明细（JSON格式）
        total_amount: 调整总金额
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiwms_inventory_adjustments"
        indexes = [
            ("tenant_id",),
            ("adjustment_no",),
            ("uuid",),
            ("status",),
            ("warehouse_id",),
            ("adjustment_date",),
            ("approval_instance_id",),
            ("approval_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "adjustment_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    adjustment_no = fields.CharField(max_length=50, description="调整单编号（组织内唯一）")
    adjustment_date = fields.DatetimeField(description="调整日期")
    warehouse_id = fields.IntField(description="仓库ID（关联master-data）")
    adjustment_type = fields.CharField(max_length=50, description="调整类型（盘盈、盘亏、其他调整）")
    adjustment_reason = fields.TextField(description="调整原因")
    
    # 调整状态
    status = fields.CharField(max_length=50, default="草稿", description="调整状态（草稿、待审批、已审批、已执行、已关闭）")
    
    # 审批相关字段
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 调整明细（JSON格式存储）
    adjustment_items = fields.JSONField(null=True, description="调整明细（JSON格式）")
    
    # 调整金额
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="调整总金额")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.adjustment_no} - {self.adjustment_type}"
