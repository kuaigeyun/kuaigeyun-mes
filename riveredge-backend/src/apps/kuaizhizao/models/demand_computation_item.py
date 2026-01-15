"""
统一需求计算明细模型

提供统一的需求计算明细数据模型定义，存储每个物料的详细计算结果。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandComputationItem(BaseModel):
    """
    统一需求计算明细模型
    
    用于存储每个物料的详细计算结果，支持MRP和LRP两种计算类型。
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    computation_id = fields.IntField(description="需求计算ID")
    
    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")
    
    # 物料来源信息（核心功能，新增）
    material_source_type = fields.CharField(max_length=20, null=True, description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）")
    material_source_config = fields.JSONField(null=True, description="物料来源配置信息（JSON格式）")
    source_validation_passed = fields.BooleanField(default=True, description="物料来源验证是否通过")
    source_validation_errors = fields.JSONField(null=True, description="物料来源验证错误信息（JSON格式）")
    
    # 需求信息（通用）
    required_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="需求数量")
    available_inventory = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="可用库存")
    net_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="净需求")
    
    # MRP专用字段
    gross_requirement = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="毛需求（MRP专用）")
    safety_stock = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="安全库存（MRP专用）")
    reorder_point = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="再订货点（MRP专用）")
    planned_receipt = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划入库（MRP专用）")
    planned_release = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划发放（MRP专用）")
    
    # LRP专用字段
    delivery_date = fields.DateField(null=True, description="交货日期（LRP专用）")
    planned_production = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划生产（LRP专用）")
    planned_procurement = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划采购（LRP专用）")
    production_start_date = fields.DateField(null=True, description="生产开始日期（LRP专用）")
    production_completion_date = fields.DateField(null=True, description="生产完成日期（LRP专用）")
    procurement_start_date = fields.DateField(null=True, description="采购开始日期（LRP专用）")
    procurement_completion_date = fields.DateField(null=True, description="采购完成日期（LRP专用）")
    
    # BOM信息（LRP专用）
    bom_id = fields.IntField(null=True, description="使用的BOM ID")
    bom_version = fields.CharField(max_length=20, null=True, description="BOM版本")
    
    # 建议行动
    suggested_work_order_quantity = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="建议工单数量")
    suggested_purchase_order_quantity = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="建议采购订单数量")
    
    # 详细结果（JSON格式，存储时间表、分解等详细信息）
    detail_results = fields.JSONField(null=True, description="详细结果（JSON格式）")
    
    # 备注
    notes = fields.TextField(null=True, description="备注")
    
    class Meta:
        table = "apps_kuaizhizao_demand_computation_items"
        table_description = "快格轻制造 - 统一需求计算明细"
        indexes = [
            ("tenant_id", "computation_id"),
            ("tenant_id", "material_id"),
            ("delivery_date",),
        ]
