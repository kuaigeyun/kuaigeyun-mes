"""
返修工单模型模块

定义返修工单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ReworkOrder(BaseModel):
    """
    返修工单模型
    
    用于管理返修工单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        rework_order_no: 返修工单编号（组织内唯一）
        original_work_order_id: 原工单ID（关联WorkOrder）
        original_work_order_uuid: 原工单UUID
        product_id: 产品ID（关联master-data）
        product_name: 产品名称
        quantity: 返修数量
        rework_reason: 返修原因
        rework_type: 返修类型（返工、返修、报废）
        route_id: 返修工艺路线ID（关联master-data）
        route_name: 返修工艺路线名称
        status: 返修状态（草稿、执行中、已完成、已关闭）
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        work_center_id: 工作中心ID（关联master-data）
        work_center_name: 工作中心名称
        operator_id: 操作员ID（用户ID）
        operator_name: 操作员姓名
        cost: 返修成本
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimes_rework_orders"
        indexes = [
            ("tenant_id",),
            ("rework_order_no",),
            ("uuid",),
            ("original_work_order_id",),
            ("original_work_order_uuid",),
            ("status",),
            ("product_id",),
            ("work_center_id",),
            ("planned_start_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "rework_order_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    rework_order_no = fields.CharField(max_length=50, description="返修工单编号（组织内唯一）")
    original_work_order_id = fields.IntField(null=True, description="原工单ID（关联WorkOrder）")
    original_work_order_uuid = fields.CharField(max_length=36, null=True, description="原工单UUID")
    product_id = fields.IntField(description="产品ID（关联master-data）")
    product_name = fields.CharField(max_length=200, description="产品名称")
    
    # 返修数量
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="返修数量")
    
    # 返修原因和类型
    rework_reason = fields.TextField(description="返修原因")
    rework_type = fields.CharField(max_length=50, description="返修类型（返工、返修、报废）")
    
    # 返修工艺
    route_id = fields.IntField(null=True, description="返修工艺路线ID（关联master-data）")
    route_name = fields.CharField(max_length=200, null=True, description="返修工艺路线名称")
    
    # 返修状态
    status = fields.CharField(max_length=50, default="草稿", description="返修状态（草稿、执行中、已完成、已关闭）")
    
    # 计划时间
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    
    # 实际时间
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    
    # 工作中心
    work_center_id = fields.IntField(null=True, description="工作中心ID（关联master-data）")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")
    
    # 操作员
    operator_id = fields.IntField(null=True, description="操作员ID（用户ID）")
    operator_name = fields.CharField(max_length=100, null=True, description="操作员姓名")
    
    # 返修成本
    cost = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="返修成本")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.rework_order_no} - {self.product_name}"
