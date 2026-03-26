"""
设备点检模型模块

定义设备日常点检和巡检数据模型，支持多组织隔离。

Author: Antigravity (RiverEdge Agent)
Date: 2026-03-26
"""

from tortoise import fields
from typing import Optional, Dict, Any
from core.models.base import BaseModel


class EquipmentPointInspectionPlan(BaseModel):
    """
    设备点检计划模型
    
    定义设备点检的标准项目和周期。
    """
    class Meta:
        table = "apps_kuaizhizao_equipment_point_inspection_plans"
        table_description = "快格轻制造 - 设备点检计划"
        unique_together = [("tenant_id", "plan_no")]

    id = fields.IntField(pk=True)
    plan_no = fields.CharField(max_length=50, description="计划编号")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    
    inspection_items = fields.JSONField(description="点检项目（JSON格式，包含：项目名称、标准、检查方法）")
    
    cycle_type = fields.CharField(max_length=50, description="周期类型（每天、每周、每月）")
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    responsible_person_id = fields.IntField(null=True, description="负责人ID")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    description = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentPointInspectionRecord(BaseModel):
    """
    设备点检记录模型
    
    记录每次点检的具体执行情况。
    """
    class Meta:
        table = "apps_kuaizhizao_equipment_point_inspection_records"
        table_description = "快格轻制造 - 设备点检记录"

    id = fields.IntField(pk=True)
    record_no = fields.CharField(max_length=50, description="记录编号")
    
    plan_id = fields.IntField(null=True, description="关联计划ID")
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    
    inspection_date = fields.DateField(description="点检日期")
    inspector_id = fields.IntField(null=True, description="点检人ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="点检人姓名")
    
    results = fields.JSONField(description="点检结果详情（JSON格式）")
    has_abnormality = fields.BooleanField(default=False, description="是否存在异常")
    abnormality_description = fields.TextField(null=True, description="异常描述")
    
    fault_report_uuid = fields.CharField(max_length=36, null=True, description="关联故障记录UUID（如果触发报修）")
    
    status = fields.CharField(max_length=50, default="已完成", description="记录状态（待点检、已完成）")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)
