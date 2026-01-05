"""
维护保养计划 Schema 模块

定义维护保养计划相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, date
from typing import Optional, Dict, Any
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class MaintenancePlanBase(BaseModel):
    """
    维护计划基础 Schema
    
    包含维护计划的基本字段，用于创建和更新操作。
    """
    plan_no: Optional[str] = Field(None, max_length=100, description="维护计划编号（可选，创建时自动生成）")
    plan_name: str = Field(..., min_length=1, max_length=200, description="计划名称")
    equipment_uuid: str = Field(..., description="设备UUID")
    plan_type: str = Field(..., max_length=50, description="计划类型（预防性维护、定期维护、临时维护）")
    maintenance_type: str = Field(..., max_length=50, description="维护类型（日常保养、小修、中修、大修）")
    cycle_type: str = Field(..., max_length=50, description="周期类型（按时间、按运行时长、按使用次数）")
    cycle_value: Optional[int] = Field(None, ge=0, description="周期值")
    cycle_unit: Optional[str] = Field(None, max_length=20, description="周期单位（天、小时、次）")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID（用户ID）")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    status: str = Field(default="草稿", max_length=50, description="计划状态（草稿、已发布、执行中、已完成、已取消）")
    remark: Optional[str] = Field(None, description="备注")
    
    @field_validator("plan_type")
    @classmethod
    def validate_plan_type(cls, v: str) -> str:
        allowed_types = ["预防性维护", "定期维护", "临时维护"]
        if v not in allowed_types:
            raise ValueError(f"计划类型必须是 {allowed_types} 之一")
        return v
    
    @field_validator("maintenance_type")
    @classmethod
    def validate_maintenance_type(cls, v: str) -> str:
        allowed_types = ["日常保养", "小修", "中修", "大修"]
        if v not in allowed_types:
            raise ValueError(f"维护类型必须是 {allowed_types} 之一")
        return v
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed_statuses = ["草稿", "已发布", "执行中", "已完成", "已取消"]
        if v not in allowed_statuses:
            raise ValueError(f"计划状态必须是 {allowed_statuses} 之一")
        return v


class MaintenancePlanCreate(MaintenancePlanBase):
    """
    维护计划创建 Schema
    
    用于创建新维护计划的请求数据。
    """
    pass


class MaintenancePlanUpdate(BaseModel):
    """
    维护计划更新 Schema
    
    用于更新维护计划的请求数据，所有字段可选。
    """
    plan_name: Optional[str] = Field(None, min_length=1, max_length=200, description="计划名称")
    plan_type: Optional[str] = Field(None, max_length=50, description="计划类型")
    maintenance_type: Optional[str] = Field(None, max_length=50, description="维护类型")
    cycle_type: Optional[str] = Field(None, max_length=50, description="周期类型")
    cycle_value: Optional[int] = Field(None, ge=0, description="周期值")
    cycle_unit: Optional[str] = Field(None, max_length=20, description="周期单位")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    status: Optional[str] = Field(None, max_length=50, description="计划状态")
    remark: Optional[str] = Field(None, description="备注")


class MaintenancePlanResponse(MaintenancePlanBase):
    """
    维护计划响应 Schema
    
    用于返回维护计划信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="维护计划UUID（对外暴露，业务标识）")
    id: int = Field(..., description="维护计划ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., description="设备名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class MaintenanceExecutionBase(BaseModel):
    """
    维护执行记录基础 Schema
    
    包含维护执行记录的基本字段，用于创建和更新操作。
    """
    execution_no: Optional[str] = Field(None, max_length=100, description="执行记录编号（可选，创建时自动生成）")
    maintenance_plan_uuid: Optional[str] = Field(None, description="维护计划UUID（可选）")
    equipment_uuid: str = Field(..., description="设备UUID")
    execution_date: datetime = Field(..., description="执行日期")
    executor_id: Optional[int] = Field(None, description="执行人员ID（用户ID）")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人员姓名")
    execution_content: Optional[str] = Field(None, description="执行内容")
    execution_result: Optional[str] = Field(None, max_length=50, description="执行结果（正常、异常、待处理）")
    maintenance_cost: Optional[Decimal] = Field(None, description="维护成本")
    spare_parts_used: Optional[Dict[str, Any]] = Field(None, description="使用备件（JSON格式）")
    status: str = Field(default="草稿", max_length=50, description="记录状态（草稿、已确认、已验收）")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID（用户ID）")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果（合格、不合格）")
    remark: Optional[str] = Field(None, description="备注")
    
    @field_validator("execution_result")
    @classmethod
    def validate_execution_result(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            allowed_results = ["正常", "异常", "待处理"]
            if v not in allowed_results:
                raise ValueError(f"执行结果必须是 {allowed_results} 之一")
        return v
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed_statuses = ["草稿", "已确认", "已验收"]
        if v not in allowed_statuses:
            raise ValueError(f"记录状态必须是 {allowed_statuses} 之一")
        return v


class MaintenanceExecutionCreate(MaintenanceExecutionBase):
    """
    维护执行记录创建 Schema
    
    用于创建新维护执行记录的请求数据。
    """
    pass


class MaintenanceExecutionUpdate(BaseModel):
    """
    维护执行记录更新 Schema
    
    用于更新维护执行记录的请求数据，所有字段可选。
    """
    execution_date: Optional[datetime] = Field(None, description="执行日期")
    executor_id: Optional[int] = Field(None, description="执行人员ID")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人员姓名")
    execution_content: Optional[str] = Field(None, description="执行内容")
    execution_result: Optional[str] = Field(None, max_length=50, description="执行结果")
    maintenance_cost: Optional[Decimal] = Field(None, description="维护成本")
    spare_parts_used: Optional[Dict[str, Any]] = Field(None, description="使用备件")
    status: Optional[str] = Field(None, max_length=50, description="记录状态")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果")
    remark: Optional[str] = Field(None, description="备注")


class MaintenanceExecutionResponse(MaintenanceExecutionBase):
    """
    维护执行记录响应 Schema
    
    用于返回维护执行记录信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="维护执行记录UUID（对外暴露，业务标识）")
    id: int = Field(..., description="维护执行记录ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    maintenance_plan_id: Optional[int] = Field(None, description="维护计划ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., description="设备名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class MaintenancePlanListResponse(BaseModel):
    """
    维护计划列表响应 Schema
    
    用于返回维护计划列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[MaintenancePlanResponse] = Field(..., description="维护计划列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class MaintenanceExecutionListResponse(BaseModel):
    """
    维护执行记录列表响应 Schema
    
    用于返回维护执行记录列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[MaintenanceExecutionResponse] = Field(..., description="维护执行记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")

