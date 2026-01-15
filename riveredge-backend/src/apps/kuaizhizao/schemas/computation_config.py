"""
需求计算参数配置Schema

提供需求计算参数配置相关的数据验证Schema。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ComputationConfigBase(BaseModel):
    """需求计算参数配置基础Schema"""
    config_code: str = Field(..., max_length=50, description="配置编码")
    config_name: str = Field(..., max_length=200, description="配置名称")
    
    config_scope: str = Field("global", max_length=50, description="配置维度（global/material/warehouse/material_warehouse）")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_code: Optional[str] = Field(None, max_length=50, description="仓库编码")
    warehouse_name: Optional[str] = Field(None, max_length=200, description="仓库名称")
    
    computation_params: Dict[str, Any] = Field(..., description="计算参数（JSON格式）")
    
    is_template: bool = Field(False, description="是否为模板")
    template_name: Optional[str] = Field(None, max_length=200, description="模板名称")
    
    is_active: bool = Field(True, description="是否启用")
    priority: int = Field(0, description="优先级")
    description: Optional[str] = Field(None, description="配置描述")
    
    @field_validator("config_scope")
    def validate_config_scope(cls, v):
        """验证配置维度"""
        if v not in ["global", "material", "warehouse", "material_warehouse"]:
            raise ValueError("配置维度必须是global、material、warehouse或material_warehouse")
        return v


class ComputationConfigCreate(ComputationConfigBase):
    """创建需求计算参数配置Schema"""
    pass


class ComputationConfigUpdate(BaseModel):
    """更新需求计算参数配置Schema"""
    config_name: Optional[str] = Field(None, max_length=200, description="配置名称")
    computation_params: Optional[Dict[str, Any]] = Field(None, description="计算参数（JSON格式）")
    is_template: Optional[bool] = Field(None, description="是否为模板")
    template_name: Optional[str] = Field(None, max_length=200, description="模板名称")
    is_active: Optional[bool] = Field(None, description="是否启用")
    priority: Optional[int] = Field(None, description="优先级")
    description: Optional[str] = Field(None, description="配置描述")


class ComputationConfigResponse(ComputationConfigBase):
    """需求计算参数配置响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]
    
    class Config:
        from_attributes = True


class ComputationConfigListResponse(BaseModel):
    """需求计算参数配置列表响应Schema"""
    data: list[ComputationConfigResponse]
    total: int
    success: bool = True
