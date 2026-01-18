"""
物料序列号模型模块

定义物料序列号数据模型，支持序列号管理、追溯等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from datetime import datetime
from tortoise import fields
from core.models.base import BaseModel


class MaterialSerial(BaseModel):
    """
    物料序列号模型
    
    用于管理物料的序列号信息，支持序列号生成、追溯、状态管理等功能。
    
    Attributes:
        id: 序列号ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        material_id: 物料ID（外键，关联物料）
        serial_no: 序列号（必填，全局唯一）
        production_date: 生产日期（可选）
        factory_date: 出厂日期（可选）
        supplier_serial_no: 供应商序列号（可选，记录供应商的序列号）
        status: 序列号状态（在库、已出库、已销售、已报废等）
        remark: 备注（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_serials"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("serial_no",),
            ("status",),
        ]
        unique_together = [("tenant_id", "serial_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="序列号ID（主键，自增ID，内部使用）")
    
    # 关联物料（ForeignKeyField 会自动创建 material_id 字段）
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="serials",
        description="关联物料（内部使用自增ID）"
    )
    
    # 序列号信息
    serial_no = fields.CharField(max_length=100, description="序列号（必填，全局唯一）")
    production_date = fields.DateField(null=True, description="生产日期（可选）")
    factory_date = fields.DateField(null=True, description="出厂日期（可选）")
    supplier_serial_no = fields.CharField(max_length=100, null=True, description="供应商序列号（可选）")
    
    # 序列号状态
    STATUS_CHOICES = [
        ("in_stock", "在库"),
        ("out_stock", "已出库"),
        ("sold", "已销售"),
        ("scrapped", "已报废"),
        ("returned", "已退货"),
    ]
    status = fields.CharField(
        max_length=20,
        default="in_stock",
        description="序列号状态（在库、已出库、已销售、已报废、已退货等）"
    )
    
    # 备注
    remark = fields.TextField(null=True, description="备注（可选）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.serial_no} - {self.material.name if self.material else 'N/A'}"
