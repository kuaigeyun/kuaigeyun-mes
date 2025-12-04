"""
脚本管理 Schema 模块

定义脚本相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ScriptBase(BaseModel):
    """脚本基础 Schema"""
    name: str = Field(..., max_length=200, description="脚本名称")
    code: str = Field(..., max_length=50, description="脚本代码")
    type: str = Field(..., max_length=50, description="脚本类型")
    description: Optional[str] = Field(None, description="脚本描述")
    content: str = Field(..., description="脚本内容")
    config: Optional[Dict[str, Any]] = Field(None, description="脚本配置")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证脚本类型"""
        allowed_types = ['python', 'shell', 'sql', 'javascript', 'other']
        if v not in allowed_types:
            raise ValueError(f'脚本类型必须是 {allowed_types} 之一')
        return v


class ScriptCreate(ScriptBase):
    """创建脚本 Schema"""
    pass


class ScriptUpdate(BaseModel):
    """更新脚本 Schema"""
    name: Optional[str] = Field(None, max_length=200, description="脚本名称")
    description: Optional[str] = Field(None, description="脚本描述")
    content: Optional[str] = Field(None, description="脚本内容")
    config: Optional[Dict[str, Any]] = Field(None, description="脚本配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ScriptExecuteRequest(BaseModel):
    """执行脚本请求 Schema"""
    parameters: Optional[Dict[str, Any]] = Field(None, description="脚本参数")
    async_execution: bool = Field(False, description="是否异步执行（通过 Inngest）")


class ScriptResponse(ScriptBase):
    """脚本响应 Schema"""
    uuid: UUID = Field(..., description="脚本UUID")
    tenant_id: int = Field(..., description="组织ID")
    is_active: bool = Field(..., description="是否启用")
    is_running: bool = Field(..., description="是否正在运行")
    inngest_function_id: Optional[str] = Field(None, description="Inngest 函数ID")
    last_run_at: Optional[datetime] = Field(None, description="最后执行时间")
    last_run_status: Optional[str] = Field(None, description="最后执行状态")
    last_error: Optional[str] = Field(None, description="最后执行错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class ScriptExecuteResponse(BaseModel):
    """脚本执行响应 Schema"""
    success: bool = Field(..., description="是否成功")
    output: Optional[str] = Field(None, description="执行输出")
    error: Optional[str] = Field(None, description="执行错误")
    execution_time: Optional[float] = Field(None, description="执行时间（秒）")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID（如果异步执行）")

