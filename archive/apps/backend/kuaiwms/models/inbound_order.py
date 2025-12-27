"""
入库单模型模块

定义入库单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class InboundOrder(BaseModel):
    """
    入库单模型
    
    用于管理入库单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        order_no: 入库单编号（组织内唯一）
        order_date: 入库日期
        order_type: 入库类型（采购入库、生产入库、退货入库、委外入库、调拨入库）
        warehouse_id: 仓库ID（关联master-data）
        status: 入库状态（草稿、待质检、质检中、已质检、执行中、部分入库、已完成、已关闭、已取消）
        total_amount: 入库总金额
        source_order_id: 来源订单ID（采购订单、生产订单等）
        source_order_no: 来源订单编号
        order_items: 入库明细（JSON格式）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiwms_inbound_orders"
        indexes = [
            ("tenant_id",),
            ("order_no",),
            ("uuid",),
            ("status",),
            ("order_type",),
            ("warehouse_id",),
            ("order_date",),
            ("source_order_id",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "order_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    order_no = fields.CharField(max_length=50, description="入库单编号（组织内唯一）")
    order_date = fields.DatetimeField(description="入库日期")
    order_type = fields.CharField(max_length=50, description="入库类型（采购入库、生产入库、退货入库、委外入库、调拨入库）")
    warehouse_id = fields.IntField(description="仓库ID（关联master-data）")
    
    # 入库状态
    status = fields.CharField(max_length=50, default="草稿", description="入库状态（草稿、待质检、质检中、已质检、执行中、部分入库、已完成、已关闭、已取消）")
    
    # 入库金额
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="入库总金额")
    
    # 来源订单
    source_order_id = fields.IntField(null=True, description="来源订单ID（采购订单、生产订单等）")
    source_order_no = fields.CharField(max_length=50, null=True, description="来源订单编号")
    
    # 入库明细（JSON格式存储）
    order_items = fields.JSONField(null=True, description="入库明细（JSON格式）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.order_no} - {self.order_type}"
