"""
生产订单模型模块

定义生产订单数据模型。
"""

from tortoise import fields
from tortoise import fields
# 注意：插件模型应继承自 core.models.base.BaseModel
# 但由于插件路径问题，这里暂时直接定义基础字段
# 实际使用时，应确保插件路径在 Python 路径中，然后使用：
# from core.models.base import BaseModel


class Order:
    """
    生产订单模型
    
    用于管理生产订单，支持多组织隔离。
    
    Attributes:
        id: 订单ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        order_no: 订单编号
        product_name: 产品名称
        quantity: 数量
        status: 订单状态
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="订单ID（主键，自增ID，内部使用）")
    
    # 基础字段（应继承自 BaseModel，但插件路径问题暂时直接定义）
    uuid = fields.UUIDField(unique=True, description="业务ID（UUID，对外暴露，安全且唯一）")
    tenant_id = fields.IntField(description="组织ID（用于多组织数据隔离）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")
    
    order_no = fields.CharField(max_length=100, description="订单编号")
    product_name = fields.CharField(max_length=200, description="产品名称")
    quantity = fields.IntField(description="数量")
    status = fields.CharField(max_length=50, default="pending", description="订单状态")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaimes_orders"
        unique_together = [("tenant_id", "order_no")]
        indexes = [
            ("tenant_id",),
            ("order_no",),
            ("uuid",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.order_no} - {self.product_name}"

