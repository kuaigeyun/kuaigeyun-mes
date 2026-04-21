"""
业务配置 Schema 模块

蓝图下线后（2026 重构）：仅保留「参数读写」相关的请求/响应 Schema。
旧版 running-mode / modules / nodes / templates / complexity-preset 相关 Schema 已全部移除。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Any, Dict

from pydantic import BaseModel, Field


class BusinessConfigResponse(BaseModel):
    """业务配置响应（仅 parameters）。"""

    parameters: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="参数配置（category -> key -> value）",
    )


class ProcessParameterUpdateRequest(BaseModel):
    """单个参数更新请求。"""

    category: str = Field(..., description="参数分类（work_order/reporting/warehouse/quality 等）")
    parameter_key: str = Field(..., description="参数键")
    value: Any = Field(..., description="参数值")


class BatchProcessParameterUpdateRequest(BaseModel):
    """批量参数更新请求。"""

    parameters: Dict[str, Dict[str, Any]] = Field(
        ...,
        description='参数配置字典，格式：{"category": {"key": value}}',
    )
