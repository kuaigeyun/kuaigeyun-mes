"""
单据关联关系模型

提供单据关联关系数据模型定义，支持各种单据之间的关联关系存储和查询。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class DocumentRelation(BaseModel):
    """
    单据关联关系模型
    
    用于存储各种单据之间的关联关系，支持上游和下游单据的追溯。
    
    关联关系类型（relation_type）：
    - source: 源单据（上游）
    - target: 目标单据（下游）
    
    关联方式（relation_mode）：
    - push: 下推（从上游单据生成下游单据）
    - pull: 上拉（从下游单据关联上游单据）
    - manual: 手动关联
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    # 源单据信息
    source_type = fields.CharField(max_length=50, description="源单据类型（如：demand、work_order等）")
    source_id = fields.IntField(description="源单据ID")
    source_code = fields.CharField(max_length=50, null=True, description="源单据编码")
    source_name = fields.CharField(max_length=200, null=True, description="源单据名称")
    
    # 目标单据信息
    target_type = fields.CharField(max_length=50, description="目标单据类型（如：work_order、purchase_order等）")
    target_id = fields.IntField(description="目标单据ID")
    target_code = fields.CharField(max_length=50, null=True, description="目标单据编码")
    target_name = fields.CharField(max_length=200, null=True, description="目标单据名称")
    
    # 关联信息
    relation_type = fields.CharField(max_length=20, description="关联类型（source/target）")
    relation_mode = fields.CharField(max_length=20, default="push", description="关联方式（push/pull/manual）")
    relation_desc = fields.CharField(max_length=200, null=True, description="关联描述")
    
    # 业务信息
    business_mode = fields.CharField(max_length=20, null=True, description="业务模式（MTS/MTO）")
    demand_id = fields.IntField(null=True, description="关联的需求ID（用于追溯）")
    
    # 备注
    notes = fields.TextField(null=True, description="备注")
    
    # 创建信息
    created_by = fields.IntField(null=True, description="创建人ID")
    
    class Meta:
        table = "apps_kuaizhizao_document_relations"
        table_description = "快格轻制造 - 单据关联关系"
        indexes = [
            ("tenant_id", "source_type", "source_id"),
            ("tenant_id", "target_type", "target_id"),
            ("tenant_id", "relation_type"),
            ("tenant_id", "demand_id"),
            ("source_type", "source_id"),
            ("target_type", "target_id"),
        ]
        unique_together = [
            ("tenant_id", "source_type", "source_id", "target_type", "target_id"),
        ]
