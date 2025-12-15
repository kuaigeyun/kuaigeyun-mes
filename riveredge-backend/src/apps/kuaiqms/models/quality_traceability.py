"""
质量追溯模型模块

定义质量追溯数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class QualityTraceability(BaseModel):
    """
    质量追溯模型
    
    用于管理质量追溯，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        trace_no: 追溯编号（组织内唯一）
        trace_type: 追溯类型（批次追溯、序列号追溯、质量档案）
        batch_no: 批次号（可选）
        serial_no: 序列号（可选）
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        trace_data: 追溯数据（JSON格式，存储追溯路径和相关信息）
        status: 追溯状态（有效、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiqms_quality_traceabilities"
        indexes = [
            ("tenant_id",),
            ("trace_no",),
            ("uuid",),
            ("trace_type",),
            ("batch_no",),
            ("serial_no",),
            ("material_id",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "trace_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    trace_no = fields.CharField(max_length=50, description="追溯编号（组织内唯一）")
    trace_type = fields.CharField(max_length=50, description="追溯类型（批次追溯、序列号追溯、质量档案）")
    
    # 追溯标识
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号（可选）")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID（关联master-data）")
    material_name = fields.CharField(max_length=200, description="物料名称")
    
    # 追溯数据（JSON格式）
    trace_data = fields.JSONField(null=True, description="追溯数据（JSON格式，存储追溯路径和相关信息）")
    
    # 追溯状态
    status = fields.CharField(max_length=50, default="有效", description="追溯状态（有效、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.trace_no} - {self.trace_type}"
