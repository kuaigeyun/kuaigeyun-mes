"""
生产追溯模型模块

定义生产追溯数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Traceability(BaseModel):
    """
    生产追溯模型
    
    用于管理生产追溯关系，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        trace_no: 追溯编号（组织内唯一）
        trace_type: 追溯类型（批次追溯、序列号追溯）
        batch_no: 批次号
        serial_no: 序列号
        product_id: 产品ID（关联master-data）
        product_name: 产品名称
        work_order_id: 工单ID（关联WorkOrder）
        work_order_uuid: 工单UUID
        operation_id: 工序ID（关联master-data）
        operation_name: 工序名称
        material_id: 原材料ID（关联master-data）
        material_name: 原材料名称
        material_batch_no: 原材料批次号
        quantity: 数量
        trace_data: 追溯数据（JSON格式，存储完整的追溯链）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimes_traceabilities"
        indexes = [
            ("tenant_id",),
            ("trace_no",),
            ("uuid",),
            ("trace_type",),
            ("batch_no",),
            ("serial_no",),
            ("product_id",),
            ("work_order_id",),
            ("work_order_uuid",),
            ("operation_id",),
            ("material_id",),
            ("material_batch_no",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "trace_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    trace_no = fields.CharField(max_length=50, description="追溯编号（组织内唯一）")
    trace_type = fields.CharField(max_length=50, description="追溯类型（批次追溯、序列号追溯）")
    
    # 批次和序列号
    batch_no = fields.CharField(max_length=50, null=True, description="批次号")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号")
    
    # 产品信息
    product_id = fields.IntField(description="产品ID（关联master-data）")
    product_name = fields.CharField(max_length=200, description="产品名称")
    
    # 工单信息
    work_order_id = fields.IntField(null=True, description="工单ID（关联WorkOrder）")
    work_order_uuid = fields.CharField(max_length=36, null=True, description="工单UUID")
    
    # 工序信息
    operation_id = fields.IntField(null=True, description="工序ID（关联master-data）")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")
    
    # 原材料信息
    material_id = fields.IntField(null=True, description="原材料ID（关联master-data）")
    material_name = fields.CharField(max_length=200, null=True, description="原材料名称")
    material_batch_no = fields.CharField(max_length=50, null=True, description="原材料批次号")
    
    # 数量
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="数量")
    
    # 追溯数据（JSON格式，存储完整的追溯链）
    trace_data = fields.JSONField(null=True, description="追溯数据（JSON格式）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.trace_no} - {self.product_name}"
