"""
需求重算编排相关 Schema
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DemandChangeEventCreateRequest(BaseModel):
    event_type: str = Field(..., description="事件类型 order/design/route/manual")
    source_type: str = Field(..., description="来源类型 sales_order/sales_forecast/bom_change/process_route_change")
    source_id: int = Field(..., description="来源ID")
    source_code: Optional[str] = Field(None, description="来源编码")
    source_name: Optional[str] = Field(None, description="来源名称")
    changed_fields: Optional[List[str]] = Field(default_factory=list, description="变更字段")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="附加上下文")
    effective_at: Optional[datetime] = Field(None, description="生效时间")
    trigger_reason: Optional[str] = Field(None, description="触发原因")
    correlation_id: Optional[str] = Field(None, description="幂等关联ID")
    auto_create_task: bool = Field(True, description="是否自动创建重算任务")


class DemandReplanTaskExecuteRequest(BaseModel):
    force: bool = Field(False, description="是否强制执行（用于审批后执行）")
    approval_comment: Optional[str] = Field(None, description="审批意见")
