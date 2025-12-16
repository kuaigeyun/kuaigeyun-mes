"""
生产报工模型模块

定义生产报工数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionReport(BaseModel):
    """
    生产报工模型
    
    用于管理生产报工记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报工单编号（组织内唯一）
        work_order_id: 工单ID（关联WorkOrder）
        work_order_uuid: 工单UUID
        operation_id: 工序ID（关联master-data）
        operation_name: 工序名称
        report_date: 报工日期
        quantity: 报工数量
        qualified_quantity: 合格数量
        defective_quantity: 不良品数量
        defective_reason: 不良品原因
        work_hours: 工时（小时）
        operator_id: 操作员ID（用户ID）
        operator_name: 操作员姓名
        work_center_id: 工作中心ID（关联master-data）
        work_center_name: 工作中心名称
        batch_no: 批次号（可选）
        serial_no: 序列号（可选）
        status: 报工状态（草稿、已确认、已审核）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimes_production_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("uuid",),
            ("work_order_id",),
            ("work_order_uuid",),
            ("operation_id",),
            ("report_date",),
            ("operator_id",),
            ("work_center_id",),
            ("batch_no",),
            ("serial_no",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    report_no = fields.CharField(max_length=50, description="报工单编号（组织内唯一）")
    work_order_id = fields.IntField(null=True, description="工单ID（关联WorkOrder）")
    work_order_uuid = fields.CharField(max_length=36, null=True, description="工单UUID")
    operation_id = fields.IntField(null=True, description="工序ID（关联master-data）")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")
    
    # 报工日期
    report_date = fields.DatetimeField(description="报工日期")
    
    # 数量信息
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="报工数量")
    qualified_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="合格数量")
    defective_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="不良品数量")
    defective_reason = fields.TextField(null=True, description="不良品原因")
    
    # 工时信息
    work_hours = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="工时（小时）")
    
    # 操作员
    operator_id = fields.IntField(null=True, description="操作员ID（用户ID）")
    operator_name = fields.CharField(max_length=100, null=True, description="操作员姓名")
    
    # 工作中心
    work_center_id = fields.IntField(null=True, description="工作中心ID（关联master-data）")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")
    
    # 批次和序列号
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    serial_no = fields.CharField(max_length=50, null=True, description="序列号（可选）")
    
    # 报工状态
    status = fields.CharField(max_length=50, default="草稿", description="报工状态（草稿、已确认、已审核）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.report_no} - {self.operation_name}"
