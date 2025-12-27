"""
不合格品记录模型模块

定义不合格品记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class NonconformingProduct(BaseModel):
    """
    不合格品记录模型
    
    用于管理不合格品记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        record_no: 不合格品记录编号（组织内唯一）
        source_type: 来源类型（检验记录、生产报工、客户投诉等）
        source_id: 来源ID
        source_no: 来源编号
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        batch_no: 批次号（可选）
        serial_no: 序列号（可选）
        quantity: 不合格数量
        defect_type: 缺陷类型（关联master-data）
        defect_type_name: 缺陷类型名称
        defect_description: 缺陷描述
        defect_cause: 缺陷原因
        impact_assessment: 影响评估（高、中、低）
        impact_scope: 影响范围描述
        status: 记录状态（待处理、处理中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiqms_nonconforming_products"
        indexes = [
            ("tenant_id",),
            ("record_no",),
            ("uuid",),
            ("source_type",),
            ("source_id",),
            ("source_no",),
            ("material_id",),
            ("batch_no",),
            ("serial_no",),
            ("defect_type",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "record_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    record_no = fields.CharField(max_length=50, description="不合格品记录编号（组织内唯一）")
    
    # 来源信息
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（检验记录、生产报工、客户投诉等）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=50, null=True, description="来源编号")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID（关联master-data）")
    material_name = fields.CharField(max_length=200, description="物料名称")
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号（可选）")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="不合格数量")
    
    # 缺陷信息
    defect_type = fields.IntField(null=True, description="缺陷类型（关联master-data）")
    defect_type_name = fields.CharField(max_length=200, null=True, description="缺陷类型名称")
    defect_description = fields.TextField(description="缺陷描述")
    defect_cause = fields.TextField(null=True, description="缺陷原因")
    
    # 影响评估
    impact_assessment = fields.CharField(max_length=20, null=True, description="影响评估（高、中、低）")
    impact_scope = fields.TextField(null=True, description="影响范围描述")
    
    # 记录状态
    status = fields.CharField(max_length=50, default="待处理", description="记录状态（待处理、处理中、已处理、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.record_no} - {self.material_name}"
