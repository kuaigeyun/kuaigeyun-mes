"""
设备故障维修 Schema 模块

定义设备故障和维修记录相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class EquipmentFaultBase(BaseModel):
    """
    设备故障记录基础 Schema
    
    包含设备故障记录的基本字段，用于创建和更新操作。
    """
    fault_no: Optional[str] = Field(None, max_length=100, description="故障记录编号（可选，创建时自动生成）")
    equipment_uuid: str = Field(..., description="设备UUID")
    fault_date: datetime = Field(..., description="故障发生日期")
    fault_type: str = Field(..., max_length=50, description="故障类型（机械故障、电气故障、软件故障、其他）")
    fault_description: str = Field(..., description="故障描述")
    fault_level: str = Field(..., max_length=50, description="故障级别（轻微、一般、严重、紧急）")
    reporter_id: Optional[int] = Field(None, description="报告人ID（用户ID）")
    reporter_name: Optional[str] = Field(None, max_length=100, description="报告人姓名")
    status: str = Field(default="待处理", max_length=50, description="故障状态（待处理、处理中、已修复、已关闭）")
    repair_required: bool = Field(default=True, description="是否需要维修")
    remark: Optional[str] = Field(None, description="备注")
    
    @field_validator("fault_type")
    @classmethod
    def validate_fault_type(cls, v: str) -> str:
        allowed_types = ["机械故障", "电气故障", "软件故障", "其他"]
        if v not in allowed_types:
            raise ValueError(f"故障类型必须是 {allowed_types} 之一")
        return v
    
    @field_validator("fault_level")
    @classmethod
    def validate_fault_level(cls, v: str) -> str:
        allowed_levels = ["轻微", "一般", "严重", "紧急"]
        if v not in allowed_levels:
            raise ValueError(f"故障级别必须是 {allowed_levels} 之一")
        return v
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed_statuses = ["待处理", "处理中", "已修复", "已关闭"]
        if v not in allowed_statuses:
            raise ValueError(f"故障状态必须是 {allowed_statuses} 之一")
        return v


class EquipmentFaultCreate(EquipmentFaultBase):
    """
    设备故障记录创建 Schema
    
    用于创建新设备故障记录的请求数据。
    """
    pass


class EquipmentFaultUpdate(BaseModel):
    """
    设备故障记录更新 Schema
    
    用于更新设备故障记录的请求数据，所有字段可选。
    """
    fault_date: Optional[datetime] = Field(None, description="故障发生日期")
    fault_type: Optional[str] = Field(None, max_length=50, description="故障类型")
    fault_description: Optional[str] = Field(None, description="故障描述")
    fault_level: Optional[str] = Field(None, max_length=50, description="故障级别")
    reporter_id: Optional[int] = Field(None, description="报告人ID")
    reporter_name: Optional[str] = Field(None, max_length=100, description="报告人姓名")
    status: Optional[str] = Field(None, max_length=50, description="故障状态")
    repair_required: Optional[bool] = Field(None, description="是否需要维修")
    remark: Optional[str] = Field(None, description="备注")


class EquipmentFaultResponse(EquipmentFaultBase):
    """
    设备故障记录响应 Schema
    
    用于返回设备故障记录信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="设备故障记录UUID（对外暴露，业务标识）")
    id: int = Field(..., description="设备故障记录ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., description="设备名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class EquipmentRepairBase(BaseModel):
    """
    设备维修记录基础 Schema
    
    包含设备维修记录的基本字段，用于创建和更新操作。
    """
    repair_no: Optional[str] = Field(None, max_length=100, description="维修记录编号（可选，创建时自动生成）")
    equipment_fault_uuid: Optional[str] = Field(None, description="设备故障UUID（可选）")
    equipment_uuid: str = Field(..., description="设备UUID")
    repair_date: datetime = Field(..., description="维修日期")
    repair_type: str = Field(..., max_length=50, description="维修类型（现场维修、返厂维修、委外维修）")
    repair_description: str = Field(..., description="维修描述")
    repair_cost: Optional[Decimal] = Field(None, description="维修成本")
    repair_parts: Optional[Dict[str, Any]] = Field(None, description="维修备件（JSON格式）")
    repairer_id: Optional[int] = Field(None, description="维修人员ID（用户ID）")
    repairer_name: Optional[str] = Field(None, max_length=100, description="维修人员姓名")
    repair_duration: Optional[Decimal] = Field(None, description="维修时长（小时）")
    status: str = Field(default="进行中", max_length=50, description="维修状态（进行中、已完成、已取消）")
    repair_result: Optional[str] = Field(None, max_length=50, description="维修结果（成功、失败、部分成功）")
    remark: Optional[str] = Field(None, description="备注")
    
    @field_validator("repair_type")
    @classmethod
    def validate_repair_type(cls, v: str) -> str:
        allowed_types = ["现场维修", "返厂维修", "委外维修"]
        if v not in allowed_types:
            raise ValueError(f"维修类型必须是 {allowed_types} 之一")
        return v
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed_statuses = ["进行中", "已完成", "已取消"]
        if v not in allowed_statuses:
            raise ValueError(f"维修状态必须是 {allowed_statuses} 之一")
        return v
    
    @field_validator("repair_result")
    @classmethod
    def validate_repair_result(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            allowed_results = ["成功", "失败", "部分成功"]
            if v not in allowed_results:
                raise ValueError(f"维修结果必须是 {allowed_results} 之一")
        return v


class EquipmentRepairCreate(EquipmentRepairBase):
    """
    设备维修记录创建 Schema
    
    用于创建新设备维修记录的请求数据。
    """
    pass


class EquipmentRepairUpdate(BaseModel):
    """
    设备维修记录更新 Schema
    
    用于更新设备维修记录的请求数据，所有字段可选。
    """
    repair_date: Optional[datetime] = Field(None, description="维修日期")
    repair_type: Optional[str] = Field(None, max_length=50, description="维修类型")
    repair_description: Optional[str] = Field(None, description="维修描述")
    repair_cost: Optional[Decimal] = Field(None, description="维修成本")
    repair_parts: Optional[Dict[str, Any]] = Field(None, description="维修备件")
    repairer_id: Optional[int] = Field(None, description="维修人员ID")
    repairer_name: Optional[str] = Field(None, max_length=100, description="维修人员姓名")
    repair_duration: Optional[Decimal] = Field(None, description="维修时长（小时）")
    status: Optional[str] = Field(None, max_length=50, description="维修状态")
    repair_result: Optional[str] = Field(None, max_length=50, description="维修结果")
    remark: Optional[str] = Field(None, description="备注")


class EquipmentRepairResponse(EquipmentRepairBase):
    """
    设备维修记录响应 Schema
    
    用于返回设备维修记录信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="设备维修记录UUID（对外暴露，业务标识）")
    id: int = Field(..., description="设备维修记录ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    equipment_fault_id: Optional[int] = Field(None, description="设备故障ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., description="设备名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class EquipmentFaultListResponse(BaseModel):
    """
    设备故障记录列表响应 Schema
    
    用于返回设备故障记录列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[EquipmentFaultResponse] = Field(..., description="设备故障记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class EquipmentRepairListResponse(BaseModel):
    """
    设备维修记录列表响应 Schema
    
    用于返回设备维修记录列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[EquipmentRepairResponse] = Field(..., description="设备维修记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")

