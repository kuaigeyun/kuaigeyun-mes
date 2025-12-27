"""
工艺参数优化 Schema 模块

定义工艺参数优化相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any


class ProcessParameterOptimizationBase(BaseModel):
    """工艺参数优化基础 Schema"""
    
    optimization_no: str = Field(..., max_length=100, description="优化编号")
    optimization_name: str = Field(..., max_length=200, description="优化名称")
    process_id: Optional[int] = Field(None, description="工艺ID")
    process_name: Optional[str] = Field(None, max_length=200, description="工艺名称")
    parameter_analysis: Optional[Any] = Field(None, description="参数分析")
    parameter_statistics: Optional[Any] = Field(None, description="参数统计")
    parameter_correlation: Optional[Any] = Field(None, description="参数关联")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    optimization_plan: Optional[Any] = Field(None, description="优化方案")
    optimization_effect: Optional[Any] = Field(None, description="优化效果")
    improvement_plan: Optional[Any] = Field(None, description="改进方案")
    improvement_status: str = Field("待执行", max_length=50, description="改进状态")
    improvement_effect: Optional[Any] = Field(None, description="改进效果")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProcessParameterOptimizationCreate(ProcessParameterOptimizationBase):
    """创建工艺参数优化 Schema"""
    pass


class ProcessParameterOptimizationUpdate(BaseModel):
    """更新工艺参数优化 Schema"""
    
    optimization_name: Optional[str] = Field(None, max_length=200, description="优化名称")
    process_id: Optional[int] = Field(None, description="工艺ID")
    process_name: Optional[str] = Field(None, max_length=200, description="工艺名称")
    parameter_analysis: Optional[Any] = Field(None, description="参数分析")
    parameter_statistics: Optional[Any] = Field(None, description="参数统计")
    parameter_correlation: Optional[Any] = Field(None, description="参数关联")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    optimization_plan: Optional[Any] = Field(None, description="优化方案")
    optimization_effect: Optional[Any] = Field(None, description="优化效果")
    improvement_plan: Optional[Any] = Field(None, description="改进方案")
    improvement_status: Optional[str] = Field(None, max_length=50, description="改进状态")
    improvement_effect: Optional[Any] = Field(None, description="改进效果")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProcessParameterOptimizationResponse(ProcessParameterOptimizationBase):
    """工艺参数优化响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

