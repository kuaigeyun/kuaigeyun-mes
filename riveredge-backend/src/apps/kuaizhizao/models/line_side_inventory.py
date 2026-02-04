"""
线边仓库存模型模块

管理线边仓的物料库存，支持按工单预留和批次管理。

Author: RiverEdge Team
Date: 2026-02-02
"""

from tortoise import fields
from core.models.base import BaseModel


class LineSideInventory(BaseModel):
    """
    线边仓库存模型
    
    管理车间线边仓的物料库存，支持批次管理和工单预留。
    
    Attributes:
        warehouse_id: 线边仓ID
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        batch_no: 批号
        quantity: 库存数量
        reserved_quantity: 预留数量（已分配给工单但未领用）
        work_order_id: 关联工单ID（预留时填写）
    """
    
    class Meta:
        """模型元数据"""
        table = "apps_kuaizhizao_line_side_inventory"
        table_description = "快格轻制造 - 线边仓库存"
        indexes = [
            ("tenant_id",),
            ("warehouse_id",),
            ("material_id",),
            ("batch_no",),
            ("work_order_id",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 仓库信息
    warehouse_id = fields.IntField(description="线边仓ID")
    warehouse_name = fields.CharField(max_length=200, null=True, description="线边仓名称")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=500, null=True, description="规格型号")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")
    
    # 批次信息
    batch_no = fields.CharField(max_length=100, null=True, description="批号")
    production_date = fields.DateField(null=True, description="生产日期")
    expiry_date = fields.DateField(null=True, description="有效期")
    
    # 库存数量
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="库存数量")
    reserved_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="预留数量")
    
    # 工单关联（可选，用于预留）
    work_order_id = fields.IntField(null=True, description="关联工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="关联工单编码")
    
    # 来源信息
    source_type = fields.CharField(max_length=20, null=True, description="来源类型（transfer=调拨, direct=直接入库）")
    source_doc_id = fields.IntField(null=True, description="来源单据ID")
    source_doc_code = fields.CharField(max_length=50, null=True, description="来源单据编码")
    
    # 状态
    status = fields.CharField(max_length=20, default="available", description="状态（available=可用, reserved=已预留, consumed=已消耗）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.material_code} - {self.batch_no or 'N/A'} ({self.quantity})"
    
    @property
    def available_quantity(self):
        """可用数量 = 库存数量 - 预留数量"""
        return self.quantity - self.reserved_quantity
