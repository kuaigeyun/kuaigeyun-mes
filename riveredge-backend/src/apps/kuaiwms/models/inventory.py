"""
库存模型模块

定义库存数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Inventory(BaseModel):
    """
    库存模型
    
    用于管理实时库存，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        material_id: 物料ID（关联master-data）
        warehouse_id: 仓库ID（关联master-data）
        location_id: 库位ID（关联master-data，可选）
        quantity: 库存数量
        available_quantity: 可用数量
        reserved_quantity: 预留数量
        in_transit_quantity: 在途数量
        unit: 单位
        batch_no: 批次号（可选）
        lot_no: 批次号（可选）
        expiry_date: 有效期（可选）
        cost_price: 成本单价
        total_cost: 总成本
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiwms_inventories"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("warehouse_id",),
            ("location_id",),
            ("uuid",),
            ("batch_no",),
            ("lot_no",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "material_id", "warehouse_id", "location_id", "batch_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    material_id = fields.IntField(description="物料ID（关联master-data）")
    warehouse_id = fields.IntField(description="仓库ID（关联master-data）")
    location_id = fields.IntField(null=True, description="库位ID（关联master-data，可选）")
    
    # 库存数量
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="库存数量")
    available_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="可用数量")
    reserved_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="预留数量")
    in_transit_quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="在途数量")
    
    # 单位
    unit = fields.CharField(max_length=20, null=True, description="单位")
    
    # 批次信息
    batch_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    lot_no = fields.CharField(max_length=50, null=True, description="批次号（可选）")
    expiry_date = fields.DatetimeField(null=True, description="有效期（可选）")
    
    # 成本信息
    cost_price = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="成本单价")
    total_cost = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="总成本")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"物料{self.material_id} - 仓库{self.warehouse_id} - {self.quantity}"
