"""
备品备件模型模块

定义设备维修和保养所需的备品备件基础信息及库存管理。

Author: Antigravity (RiverEdge Agent)
Date: 2026-03-26
"""

from tortoise import fields
from typing import Optional, Dict, Any
from core.models.base import BaseModel


class SparePart(BaseModel):
    """
    备品备件基础模型
    """
    class Meta:
        table = "apps_kuaizhizao_spare_parts"
        table_description = "快格轻制造 - 备品备件基础信息"
        unique_together = [("tenant_id", "part_no")]

    id = fields.IntField(pk=True)
    part_no = fields.CharField(max_length=100, description="备件编号")
    part_name = fields.CharField(max_length=200, description="备件名称")
    category = fields.CharField(max_length=100, null=True, description="备件分类（密封件、轴承、传感器等）")
    spec = fields.CharField(max_length=200, null=True, description="规格型号")
    unit = fields.CharField(max_length=20, default="个", description="计量单位")
    
    brand = fields.CharField(max_length=100, null=True, description="品牌")
    supplier = fields.CharField(max_length=200, null=True, description="供应商")
    
    safety_stock = fields.IntField(default=0, description="安全库存")
    price = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="参考单价")
    
    # 关联设备类型
    associated_equipment_categories = fields.JSONField(null=True, description="适用设备类型列表")
    
    description = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class SparePartInventory(BaseModel):
    """
    备品备件库存模型
    """
    class Meta:
        table = "apps_kuaizhizao_spare_part_inventories"
        table_description = "快格轻制造 - 备品备件库存"
        unique_together = [("tenant_id", "spare_part_id", "warehouse_location")]

    id = fields.IntField(pk=True)
    spare_part_id = fields.IntField(description="关联备件ID")
    spare_part_uuid = fields.CharField(max_length=36, description="关联备件UUID")
    
    warehouse_location = fields.CharField(max_length=100, null=True, description="库位名称")
    stock_quantity = fields.IntField(default=0, description="当前库存数量")
    
    last_in_date = fields.DatetimeField(null=True)
    last_out_date = fields.DatetimeField(null=True)
    
    deleted_at = fields.DatetimeField(null=True)


class SparePartStockRecord(BaseModel):
    """
    备品备件出入库记录模型
    """
    class Meta:
        table = "apps_kuaizhizao_spare_part_stock_records"
        table_description = "快格轻制造 - 备品备件出入库流水"

    id = fields.IntField(pk=True)
    record_no = fields.CharField(max_length=100, description="流水号")
    spare_part_id = fields.IntField(description="关联备件ID")
    spare_part_uuid = fields.CharField(max_length=36, description="关联备件UUID")
    
    operation_type = fields.CharField(max_length=50, description="操作类型（入库、出库、盘点、退回）")
    quantity = fields.IntField(description="变动数量")
    after_quantity = fields.IntField(description="变动后库存")
    
    rel_type = fields.CharField(max_length=50, null=True, description="关联业务类型（维修、保养、工单）")
    rel_id = fields.IntField(null=True, description="关联业务ID")
    rel_uuid = fields.CharField(max_length=36, null=True, description="关联业务UUID")
    
    operator_id = fields.IntField(null=True, description="操作人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人姓名")
    
    remark = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
