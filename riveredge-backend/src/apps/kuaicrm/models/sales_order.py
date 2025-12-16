"""
销售订单模型模块

定义销售订单数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class SalesOrder(BaseModel):
    """
    销售订单模型
    
    用于管理销售订单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        order_no: 订单编号（组织内唯一）
        order_date: 订单日期
        customer_id: 客户ID（关联master-data）
        opportunity_id: 关联商机ID（可选，从商机转化）
        status: 订单状态
        total_amount: 订单金额
        delivery_date: 交期要求
        priority: 优先级
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_sales_orders"
        indexes = [
            ("tenant_id",),
            ("order_no",),
            ("uuid",),
            ("status",),
            ("customer_id",),
            ("opportunity_id",),
            ("order_date",),
            ("approval_instance_id",),
            ("approval_status",),
        ]
        unique_together = [("tenant_id", "order_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    order_no = fields.CharField(max_length=50, description="订单编号（组织内唯一）")
    order_date = fields.DatetimeField(description="订单日期")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    opportunity_id = fields.IntField(null=True, description="关联商机ID（可选，从商机转化）")
    
    # 订单状态和金额
    status = fields.CharField(max_length=50, default="待审批", description="订单状态（待审批、已审批、生产中、已交付、已关闭）")
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="订单金额")
    delivery_date = fields.DatetimeField(null=True, description="交期要求")
    priority = fields.CharField(max_length=20, default="普通", description="优先级（普通、紧急、加急）")
    
    # 审批相关字段
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.order_no} - {self.total_amount}"
