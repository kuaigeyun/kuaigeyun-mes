"""
物料倒冲记录模型模块

记录生产报工时的物料自动消耗（倒冲）历史。

Author: RiverEdge Team
Date: 2026-02-02
"""

from tortoise import fields
from core.models.base import BaseModel


class BackflushRecord(BaseModel):
    """
    物料倒冲记录模型
    
    记录每次报工触发的物料自动消耗情况。
    
    Attributes:
        work_order_id: 工单ID
        operation_id: 工序单ID（可选）
        report_id: 报工记录ID
        material_id: 物料ID
        batch_no: 批号
        warehouse_id: 出库仓库ID
        quantity: 倒冲数量
        status: 倒冲状态
    """
    
    class Meta:
        """模型元数据"""
        table = "apps_kuaizhizao_backflush_records"
        table_description = "快格轻制造 - 物料倒冲记录"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("operation_id",),
            ("report_id",),
            ("material_id",),
            ("batch_no",),
            ("status",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 工单关联
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    operation_id = fields.IntField(null=True, description="工序单ID")
    operation_code = fields.CharField(max_length=50, null=True, description="工序单编码")
    
    # 报工关联
    report_id = fields.IntField(description="报工记录ID")
    report_quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="报工数量")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")
    
    # 批次信息
    batch_no = fields.CharField(max_length=100, null=True, description="批号")
    
    # 仓库信息
    warehouse_id = fields.IntField(description="出库仓库ID（线边仓或主仓库）")
    warehouse_name = fields.CharField(max_length=200, null=True, description="出库仓库名称")
    warehouse_type = fields.CharField(max_length=20, null=True, description="仓库类型")
    
    # 倒冲数量
    bom_quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="BOM单位用量")
    backflush_quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="倒冲数量")
    
    # 状态
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="状态（pending=待处理, completed=已完成, failed=失败, cancelled=已取消）"
    )
    error_message = fields.TextField(null=True, description="错误信息（失败时记录）")
    
    # 处理时间
    processed_at = fields.DatetimeField(null=True, description="处理时间")
    processed_by = fields.IntField(null=True, description="处理人ID")
    processed_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    
    def __str__(self):
        """字符串表示"""
        return f"倒冲记录 {self.work_order_code} - {self.material_code} ({self.backflush_quantity})"
