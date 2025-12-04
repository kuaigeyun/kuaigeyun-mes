"""
定时任务 Schema 模块

定义定时任务相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ScheduledTaskBase(BaseModel):
    """定时任务基础 Schema"""
    name: str = Field(..., max_length=100, description="任务名称")
    code: str = Field(..., max_length=50, description="任务代码")
    description: Optional[str] = Field(None, description="任务描述")
    type: str = Field(..., max_length=20, description="任务类型")
    trigger_type: str = Field(..., max_length=20, description="触发器类型")
    trigger_config: Dict[str, Any] = Field(..., description="触发器配置")
    task_config: Dict[str, Any] = Field(..., description="任务配置")
    is_active: bool = Field(True, description="是否启用")
    
    @field_validator('trigger_type')
    @classmethod
    def validate_trigger_type(cls, v):
        """验证触发器类型"""
        allowed_types = ['cron', 'interval', 'date']
        if v not in allowed_types:
            raise ValueError(f'触发器类型必须是 {allowed_types} 之一')
        return v
    
    @field_validator('type')
    @classmethod
    def validate_task_type(cls, v):
        """验证任务类型"""
        allowed_types = ['python_script', 'api_call']
        if v not in allowed_types:
            raise ValueError(f'任务类型必须是 {allowed_types} 之一')
        return v


class ScheduledTaskCreate(ScheduledTaskBase):
    """创建定时任务 Schema"""
    pass


class ScheduledTaskUpdate(BaseModel):
    """更新定时任务 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="任务名称")
    description: Optional[str] = Field(None, description="任务描述")
    trigger_type: Optional[str] = Field(None, max_length=20, description="触发器类型")
    trigger_config: Optional[Dict[str, Any]] = Field(None, description="触发器配置")
    task_config: Optional[Dict[str, Any]] = Field(None, description="任务配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ScheduledTaskResponse(ScheduledTaskBase):
    """定时任务响应 Schema"""
    uuid: UUID = Field(..., description="定时任务UUID")
    tenant_id: int = Field(..., description="组织ID")
    inngest_function_id: Optional[str] = Field(None, description="Inngest 函数ID")
    is_running: bool = Field(..., description="是否正在运行")
    last_run_at: Optional[datetime] = Field(None, description="最后运行时间")
    last_run_status: Optional[str] = Field(None, description="最后运行状态")
    last_error: Optional[str] = Field(None, description="最后错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

