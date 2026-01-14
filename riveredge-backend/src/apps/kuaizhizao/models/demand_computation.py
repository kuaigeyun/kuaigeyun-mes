"""
统一需求计算模型

提供统一的需求计算数据模型定义，合并MRP和LRP运算结果。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandComputation(BaseModel):
    """
    统一需求计算模型
    
    用于统一管理MRP（物料需求计划）和LRP（物流需求计划）运算结果。
    支持灵活的参数配置和计算结果存储。
    
    计算类型（computation_type）：
    - MRP: 物料需求计划（基于销售预测，MTS模式）
    - LRP: 物流需求计划（基于销售订单，MTO模式）
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    computation_code = fields.CharField(max_length=50, description="计算编码")
    
    # 关联需求
    demand_id = fields.IntField(description="需求ID（关联统一需求表）")
    demand_code = fields.CharField(max_length=50, description="需求编码")
    demand_type = fields.CharField(max_length=20, description="需求类型（sales_forecast/sales_order）")
    business_mode = fields.CharField(max_length=20, description="业务模式（MTS/MTO）")
    
    # 计算类型
    computation_type = fields.CharField(max_length=20, description="计算类型（MRP/LRP）")
    
    # 计算参数（JSON格式，存储灵活的计算参数配置）
    computation_params = fields.JSONField(description="计算参数（JSON格式）")
    
    # 计算状态
    computation_status = fields.CharField(max_length=20, default="进行中", description="计算状态")
    computation_start_time = fields.DatetimeField(null=True, description="计算开始时间")
    computation_end_time = fields.DatetimeField(null=True, description="计算结束时间")
    
    # 计算结果汇总（JSON格式，存储汇总结果）
    computation_summary = fields.JSONField(null=True, description="计算结果汇总（JSON格式）")
    
    # 错误信息
    error_message = fields.TextField(null=True, description="错误信息")
    
    # 备注
    notes = fields.TextField(null=True, description="备注")
    
    # 创建信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    class Meta:
        table = "apps_kuaizhizao_demand_computations"
        table_description = "快格轻制造 - 统一需求计算"
        indexes = [
            ("tenant_id", "demand_id"),
            ("tenant_id", "computation_type"),
            ("tenant_id", "computation_status"),
            ("computation_code",),
            ("computation_start_time",),
        ]
