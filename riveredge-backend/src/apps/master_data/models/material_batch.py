"""
物料批号模型模块

定义物料批号数据模型，支持批号管理、追溯等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from datetime import datetime
from tortoise import fields
from core.models.base import BaseModel


class MaterialBatch(BaseModel):
    """
    物料批号模型
    
    用于管理物料的批号信息，支持批号生成、追溯、有效期管理等功能。
    
    Attributes:
        id: 批号ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        material_id: 物料ID（外键，关联物料）
        batch_no: 批号（必填，同一物料下唯一）
        production_date: 生产日期（可选）
        expiry_date: 有效期（可选，用于有保质期的物料）
        supplier_batch_no: 供应商批号（可选，记录供应商的批号）
        quantity: 批号数量（当前库存数量）
        status: 批号状态（在库、已出库、已过期等）
        remark: 备注（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_batches"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("batch_no",),
            ("status",),
            ("expiry_date",),
        ]
        unique_together = [("tenant_id", "material_id", "batch_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="批号ID（主键，自增ID，内部使用）")
    
    # 关联物料（ForeignKeyField 会自动创建 material_id 字段）
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="batches",
        description="关联物料（内部使用自增ID）"
    )
    
    # 批号信息
    batch_no = fields.CharField(max_length=100, description="批号（必填，同一物料下唯一）")
    production_date = fields.DateField(null=True, description="生产日期（可选）")
    expiry_date = fields.DateField(null=True, description="有效期（可选，用于有保质期的物料）")
    supplier_batch_no = fields.CharField(max_length=100, null=True, description="供应商批号（可选）")
    
    # 批号数量（当前库存数量）
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="批号数量（当前库存数量）")
    
    # 批号状态
    STATUS_CHOICES = [
        ("in_stock", "在库"),
        ("out_stock", "已出库"),
        ("expired", "已过期"),
        ("scrapped", "已报废"),
    ]
    status = fields.CharField(
        max_length=20,
        default="in_stock",
        description="批号状态（在库、已出库、已过期、已报废等）"
    )
    
    # 备注
    remark = fields.TextField(null=True, description="备注（可选）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.batch_no} - {self.material.name if self.material else 'N/A'}"
