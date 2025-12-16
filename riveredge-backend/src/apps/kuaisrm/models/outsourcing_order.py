"""
委外订单模型模块

定义委外订单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class OutsourcingOrder(BaseModel):
    """
    委外订单模型
    
    用于管理委外订单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        order_no: 订单编号（组织内唯一）
        order_date: 订单日期
        supplier_id: 委外供应商ID（关联master-data）
        status: 订单状态（草稿、待审批、已审批、执行中、部分完成、已完成、已关闭、已取消）
        total_amount: 订单总金额
        currency: 币种
        delivery_date: 交期要求
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态（pending、approved、rejected、cancelled）
        requirement_id: 关联需求ID（MaterialRequirement，可选）
        progress: 完成进度（百分比，0-100）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaisrm_outsourcing_orders"
        indexes = [
            ("tenant_id",),
            ("order_no",),
            ("uuid",),
            ("status",),
            ("supplier_id",),
            ("order_date",),
            ("approval_instance_id",),
            ("approval_status",),
            ("delivery_date",),
            ("progress",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "order_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    order_no = fields.CharField(max_length=50, description="订单编号（组织内唯一）")
    order_date = fields.DatetimeField(description="订单日期")
    supplier_id = fields.IntField(description="委外供应商ID（关联master-data）")
    
    # 订单状态
    status = fields.CharField(max_length=50, default="草稿", description="订单状态（草稿、待审批、已审批、执行中、部分完成、已完成、已关闭、已取消）")
    
    # 订单金额
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="订单总金额")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    
    # 交期和进度
    delivery_date = fields.DatetimeField(null=True, description="交期要求")
    progress = fields.IntField(default=0, description="完成进度（百分比，0-100）")
    
    # 审批相关字段
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 关联信息
    requirement_id = fields.IntField(null=True, description="关联需求ID（MaterialRequirement，可选）")
    
    # 订单明细（JSON格式存储）
    order_items = fields.JSONField(null=True, description="订单明细（JSON格式）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.order_no} - {self.supplier_id}"
