"""
工作时间段配置数据验证Schema模块

定义工作时间段配置相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class WorkingHoursConfigBase(BaseModel):
    """
    工作时间段配置基础Schema

    包含所有工作时间段配置的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="配置名称")
    scope_type: str = Field(..., description="适用范围类型（warehouse/work_center/department/all）")
    scope_id: Optional[int] = Field(None, description="适用范围ID（可选）")
    scope_name: Optional[str] = Field(None, description="适用范围名称")
    day_of_week: Optional[int] = Field(None, description="星期几（0=周一，6=周日，null表示所有工作日）")
    start_date: Optional[date] = Field(None, description="生效开始日期（可选）")
    end_date: Optional[date] = Field(None, description="生效结束日期（可选）")
    working_hours: List[Dict[str, str]] = Field(..., description="工作时间段配置（JSON格式）")
    is_enabled: bool = Field(True, description="是否启用")
    priority: int = Field(0, description="优先级")
    remarks: Optional[str] = Field(None, description="备注")


class WorkingHoursConfigCreate(WorkingHoursConfigBase):
    """
    工作时间段配置创建Schema

    用于创建新工作时间段配置的数据验证。
    """
    pass


class WorkingHoursConfigUpdate(BaseModel):
    """
    工作时间段配置更新Schema

    用于更新工作时间段配置的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="配置名称")
    scope_type: Optional[str] = Field(None, description="适用范围类型")
    scope_id: Optional[int] = Field(None, description="适用范围ID")
    scope_name: Optional[str] = Field(None, description="适用范围名称")
    day_of_week: Optional[int] = Field(None, description="星期几")
    start_date: Optional[date] = Field(None, description="生效开始日期")
    end_date: Optional[date] = Field(None, description="生效结束日期")
    working_hours: Optional[List[Dict[str, str]]] = Field(None, description="工作时间段配置")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    priority: Optional[int] = Field(None, description="优先级")
    remarks: Optional[str] = Field(None, description="备注")


class WorkingHoursConfigResponse(WorkingHoursConfigBase):
    """
    工作时间段配置响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="配置ID")
    uuid: str = Field(..., description="业务ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class WorkingHoursConfigListResponse(WorkingHoursConfigResponse):
    """
    工作时间段配置列表响应Schema

    用于工作时间段配置列表API的响应数据格式。
    """
    pass

