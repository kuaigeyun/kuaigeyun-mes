"""
需求计算参数配置模型

提供需求计算参数配置数据模型定义，支持灵活配置计算参数。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class ComputationConfig(BaseModel):
    """
    需求计算参数配置模型
    
    用于配置需求计算的各种参数，支持按物料、按仓库等维度配置。
    支持参数模板管理，可以保存和复用常用配置。
    
    配置维度（config_scope）：
    - global: 全局配置（所有物料通用）
    - material: 按物料配置
    - warehouse: 按仓库配置
    - material_warehouse: 按物料+仓库配置
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    config_code = fields.CharField(max_length=50, description="配置编码")
    config_name = fields.CharField(max_length=200, description="配置名称")
    
    # 配置维度
    config_scope = fields.CharField(max_length=50, default="global", description="配置维度（global/material/warehouse/material_warehouse）")
    material_id = fields.IntField(null=True, description="物料ID（当config_scope为material或material_warehouse时必填）")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    warehouse_id = fields.IntField(null=True, description="仓库ID（当config_scope为warehouse或material_warehouse时必填）")
    warehouse_code = fields.CharField(max_length=50, null=True, description="仓库编码")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")
    
    # 计算参数（JSON格式，存储灵活的计算参数配置）
    # 包含：安全库存、提前期、批量规则、再订货点等
    computation_params = fields.JSONField(description="计算参数（JSON格式）")
    
    # 是否为模板
    is_template = fields.BooleanField(default=False, description="是否为模板")
    template_name = fields.CharField(max_length=200, null=True, description="模板名称（当is_template为true时使用）")
    
    # 是否启用
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 优先级（数字越大优先级越高，用于配置冲突时选择）
    priority = fields.IntField(default=0, description="优先级")
    
    # 描述
    description = fields.TextField(null=True, description="配置描述")
    
    # 创建信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    class Meta:
        table = "apps_kuaizhizao_computation_configs"
        table_description = "快格轻制造 - 需求计算参数配置"
        indexes = [
            ("tenant_id", "config_scope"),
            ("tenant_id", "material_id"),
            ("tenant_id", "warehouse_id"),
            ("tenant_id", "is_template"),
            ("tenant_id", "is_active"),
            ("config_code",),
        ]
        unique_together = [
            ("tenant_id", "config_code"),
        ]
