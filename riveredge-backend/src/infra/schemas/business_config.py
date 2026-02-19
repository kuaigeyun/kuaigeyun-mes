"""
业务配置 Schema 模块

定义业务配置相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class BusinessConfigResponse(BaseModel):
    """业务配置响应"""
    running_mode: str = Field(..., description="运行模式（simple/full）")
    industry: str = Field('general', description="所属行业（general/machinery/electronics/machining）")
    scale: str = Field('medium', description="企业规模（small/medium/large）")
    modules: Dict[str, bool] = Field(default_factory=dict, description="模块开关配置")
    nodes: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="节点详细配置")
    parameters: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="流程参数配置")
    mode_switched_at: Optional[str] = Field(None, description="模式切换时间")
    complexity_level: Optional[str] = Field(None, description="业务复杂度等级（L1/L2/L3/L4/L5）")
    complexity_name: Optional[str] = Field(None, description="业务模式名称")


class RunningModeSwitchRequest(BaseModel):
    """运行模式切换请求"""
    mode: str = Field(..., description="运行模式（simple/full）")
    apply_defaults: bool = Field(True, description="是否应用默认配置")


class ModuleSwitchRequest(BaseModel):
    """模块开关请求"""
    module_code: str = Field(..., description="模块代码")
    enabled: bool = Field(..., description="是否启用")


class ProcessParameterUpdateRequest(BaseModel):
    """流程参数更新请求"""
    category: str = Field(..., description="参数分类（work_order/reporting/warehouse/quality等）")
    parameter_key: str = Field(..., description="参数键")
    value: Any = Field(..., description="参数值")


class BatchProcessParameterUpdateRequest(BaseModel):
    """批量流程参数更新请求"""
    parameters: Dict[str, Dict[str, Any]] = Field(..., description="参数配置字典，格式：{\"category\": {\"key\": value}}")


class ConfigTemplateSaveRequest(BaseModel):
    """配置模板保存请求"""
    template_name: str = Field(..., description="模板名称")
    template_description: Optional[str] = Field(None, description="模板描述")


class ConfigTemplateApplyRequest(BaseModel):
    """配置模板应用请求"""
    template_id: int = Field(..., description="模板ID")


class NodesUpdateRequest(BaseModel):
    """节点配置更新请求"""
    nodes: Dict[str, Dict[str, Any]] = Field(..., description="节点配置 map")
    industry: Optional[str] = Field(None, description="行业")
    scale: Optional[str] = Field(None, description="规模")


class ComplexityPresetApplyRequest(BaseModel):
    """业务复杂度预设应用请求"""
    level: str = Field(..., description="复杂度等级（L1/L2/L3/L4/L5）")
