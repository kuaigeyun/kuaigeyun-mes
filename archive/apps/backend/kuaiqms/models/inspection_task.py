"""
质量检验任务模型模块

定义质量检验任务数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class InspectionTask(BaseModel):
    """
    质量检验任务模型
    
    用于管理质量检验任务，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        task_no: 检验任务编号（组织内唯一）
        inspection_type: 检验类型（来料检验、过程检验、成品检验、委外来料检验）
        source_type: 来源类型（采购订单、生产订单、工单、委外订单）
        source_id: 来源ID
        source_no: 来源编号
        material_id: 物料ID（关联master-data）
        material_name: 物料名称
        batch_no: 批次号（可选）
        serial_no: 序列号（可选）
        quantity: 检验数量
        inspector_id: 检验员ID（用户ID）
        inspector_name: 检验员姓名
        inspection_standard_id: 检验标准ID（关联master-data）
        inspection_standard_name: 检验标准名称
        planned_inspection_date: 计划检验日期
        status: 任务状态（待检验、检验中、已完成、已取消）
        priority: 优先级（高、中、低）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiqms_inspection_tasks"
        indexes = [
            ("tenant_id",),
            ("task_no",),
            ("uuid",),
            ("inspection_type",),
            ("source_type",),
            ("source_id",),
            ("source_no",),
            ("material_id",),
            ("batch_no",),
            ("serial_no",),
            ("inspector_id",),
            ("status",),
            ("planned_inspection_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "task_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    task_no = fields.CharField(max_length=50, description="检验任务编号（组织内唯一）")
    inspection_type = fields.CharField(max_length=50, description="检验类型（来料检验、过程检验、成品检验、委外来料检验）")
    
    # 来源信息
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（采购订单、生产订单、工单、委外订单）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=50, null=True, description="来源编号")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID（关联master-data）")
    material_name = fields.CharField(max_length=200, description="物料名称")
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号（可选）")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="检验数量")
    
    # 检验员信息
    inspector_id = fields.IntField(null=True, description="检验员ID（用户ID）")
    inspector_name = fields.CharField(max_length=100, null=True, description="检验员姓名")
    
    # 检验标准
    inspection_standard_id = fields.IntField(null=True, description="检验标准ID（关联master-data）")
    inspection_standard_name = fields.CharField(max_length=200, null=True, description="检验标准名称")
    
    # 计划时间
    planned_inspection_date = fields.DatetimeField(null=True, description="计划检验日期")
    
    # 任务状态
    status = fields.CharField(max_length=50, default="待检验", description="任务状态（待检验、检验中、已完成、已取消）")
    
    # 优先级
    priority = fields.CharField(max_length=20, default="中", description="优先级（高、中、低）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.task_no} - {self.inspection_type}"
