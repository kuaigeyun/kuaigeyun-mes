"""
质量检验记录模型模块

定义质量检验记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class InspectionRecord(BaseModel):
    """
    质量检验记录模型
    
    用于管理质量检验记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        record_no: 检验记录编号（组织内唯一）
        task_id: 检验任务ID（关联InspectionTask）
        task_uuid: 检验任务UUID
        inspection_type: 检验类型（来料检验、过程检验、成品检验、委外来料检验）
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        batch_no: 批次号（可选）
        serial_no: 序列号（可选）
        quantity: 检验数量
        qualified_quantity: 合格数量
        defective_quantity: 不合格数量
        inspection_result: 检验结果（合格、不合格、让步接收）
        inspection_date: 检验日期
        inspector_id: 检验员ID（用户ID）
        inspector_name: 检验员姓名
        inspection_standard_id: 检验标准ID（关联master-data）
        inspection_standard_name: 检验标准名称
        inspection_data: 检验数据（JSON格式，存储检验项和检验值）
        status: 记录状态（草稿、已确认、已审核）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiqms_inspection_records"
        indexes = [
            ("tenant_id",),
            ("record_no",),
            ("uuid",),
            ("task_id",),
            ("task_uuid",),
            ("inspection_type",),
            ("material_id",),
            ("batch_no",),
            ("serial_no",),
            ("inspector_id",),
            ("inspection_result",),
            ("inspection_date",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "record_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    record_no = fields.CharField(max_length=50, description="检验记录编号（组织内唯一）")
    task_id = fields.IntField(null=True, description="检验任务ID（关联InspectionTask）")
    task_uuid = fields.CharField(max_length=36, null=True, description="检验任务UUID")
    inspection_type = fields.CharField(max_length=50, description="检验类型（来料检验、过程检验、成品检验、委外来料检验）")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID（关联master-data）")
    material_name = fields.CharField(max_length=200, description="物料名称")
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号（可选）")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="检验数量")
    qualified_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="合格数量")
    defective_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="不合格数量")
    
    # 检验结果
    inspection_result = fields.CharField(max_length=50, description="检验结果（合格、不合格、让步接收）")
    
    # 检验日期
    inspection_date = fields.DatetimeField(description="检验日期")
    
    # 检验员信息
    inspector_id = fields.IntField(null=True, description="检验员ID（用户ID）")
    inspector_name = fields.CharField(max_length=100, null=True, description="检验员姓名")
    
    # 检验标准
    inspection_standard_id = fields.IntField(null=True, description="检验标准ID（关联master-data）")
    inspection_standard_name = fields.CharField(max_length=200, null=True, description="检验标准名称")
    
    # 检验数据（JSON格式）
    inspection_data = fields.JSONField(null=True, description="检验数据（JSON格式，存储检验项和检验值）")
    
    # 记录状态
    status = fields.CharField(max_length=50, default="草稿", description="记录状态（草稿、已确认、已审核）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.record_no} - {self.inspection_result}"
