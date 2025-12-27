"""
生产订单模型模块

定义生产订单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Order(BaseModel):
    """
    生产订单模型
    
    用于管理生产订单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        order_no: 订单编号（组织内唯一）
        order_type: 订单类型（计划订单、紧急订单、返工订单）
        product_id: 产品ID（关联master-data）
        product_name: 产品名称
        quantity: 计划数量
        completed_quantity: 完成数量
        status: 订单状态（草稿、已确认、已下发、执行中、已完成、已关闭、已取消）
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        source_order_id: 来源订单ID（销售订单、计划订单等）
        source_order_no: 来源订单编号
        route_id: 工艺路线ID（关联master-data）
        route_name: 工艺路线名称
        priority: 优先级（高、中、低）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimes_orders"
        indexes = [
            ("tenant_id",),
            ("order_no",),
            ("uuid",),
            ("status",),
            ("order_type",),
            ("product_id",),
            ("planned_start_date",),
            ("planned_end_date",),
            ("source_order_id",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "order_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    order_no = fields.CharField(max_length=50, description="订单编号（组织内唯一）")
    order_type = fields.CharField(max_length=50, default="计划订单", description="订单类型（计划订单、紧急订单、返工订单）")
    product_id = fields.IntField(description="产品ID（关联master-data）")
    product_name = fields.CharField(max_length=200, description="产品名称")
    
    # 数量信息
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="计划数量")
    completed_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="完成数量")
    
    # 订单状态
    status = fields.CharField(max_length=50, default="草稿", description="订单状态（草稿、已确认、已下发、执行中、已完成、已关闭、已取消）")
    
    # 计划时间
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    
    # 实际时间
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    
    # 来源订单
    source_order_id = fields.IntField(null=True, description="来源订单ID（销售订单、计划订单等）")
    source_order_no = fields.CharField(max_length=50, null=True, description="来源订单编号")
    
    # 工艺路线
    route_id = fields.IntField(null=True, description="工艺路线ID（关联master-data）")
    route_name = fields.CharField(max_length=200, null=True, description="工艺路线名称")
    
    # 优先级
    priority = fields.CharField(max_length=20, default="中", description="优先级（高、中、低）")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.order_no} - {self.product_name}"

