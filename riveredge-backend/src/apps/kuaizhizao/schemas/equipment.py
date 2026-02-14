"""
设备 Schema 模块

定义设备相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2026-01-05
"""

from datetime import datetime, date
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class EquipmentBase(BaseModel):
    """
    设备基础 Schema
    
    包含设备的基本字段，用于创建和更新操作。
    """
    code: Optional[str] = Field(None, max_length=50, description="设备编码（可选，创建时自动生成）")
    name: str = Field(..., min_length=1, max_length=200, description="设备名称")
    type: Optional[str] = Field(None, max_length=50, description="设备类型（如：加工设备、检测设备、包装设备等）")
    category: Optional[str] = Field(None, max_length=50, description="设备分类（如：CNC、注塑机、冲压机等）")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    workstation_id: Optional[int] = Field(None, description="关联工位ID（可选）")
    workstation_code: Optional[str] = Field(None, max_length=50, description="工位编码")
    workstation_name: Optional[str] = Field(None, max_length=200, description="工位名称")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID（可选）")
    work_center_code: Optional[str] = Field(None, max_length=50, description="工作中心编码")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    status: str = Field(default="正常", max_length=50, description="设备状态（正常、维修中、停用、报废）")
    is_active: bool = Field(default=True, description="是否启用")
    description: Optional[str] = Field(None, description="描述")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """
        验证设备状态
        
        Args:
            v: 设备状态值
            
        Returns:
            验证后的设备状态值
            
        Raises:
            ValueError: 如果设备状态不合法
        """
        allowed_statuses = ["正常", "维修中", "停用", "校验中", "报废"]
        if v not in allowed_statuses:
            raise ValueError(f"设备状态必须是 {allowed_statuses} 之一")
        return v


class EquipmentCreate(EquipmentBase):
    """
    设备创建 Schema
    
    用于创建新设备的请求数据。
    """
    pass


class EquipmentUpdate(BaseModel):
    """
    设备更新 Schema
    
    用于更新设备的请求数据，所有字段可选。
    """
    code: Optional[str] = Field(None, max_length=50, description="设备编码")
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="设备名称")
    type: Optional[str] = Field(None, max_length=50, description="设备类型")
    category: Optional[str] = Field(None, max_length=50, description="设备分类")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    workstation_id: Optional[int] = Field(None, description="关联工位ID（可选）")
    workstation_code: Optional[str] = Field(None, max_length=50, description="工位编码")
    workstation_name: Optional[str] = Field(None, max_length=200, description="工位名称")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID（可选）")
    work_center_code: Optional[str] = Field(None, max_length=50, description="工作中心编码")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    status: Optional[str] = Field(None, max_length=50, description="设备状态（正常、维修中、停用、报废）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="描述")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """
        验证设备状态
        
        Args:
            v: 设备状态值（可选）
            
        Returns:
            验证后的设备状态值
            
        Raises:
            ValueError: 如果设备状态不合法
        """
        if v is not None:
            allowed_statuses = ["正常", "维修中", "停用", "校验中", "报废"]
            if v not in allowed_statuses:
                raise ValueError(f"设备状态必须是 {allowed_statuses} 之一")
        return v


class EquipmentResponse(EquipmentBase):
    """
    设备响应 Schema
    
    用于返回设备信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="设备UUID（对外暴露，业务标识）")
    id: int = Field(..., description="设备ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class EquipmentListResponse(BaseModel):
    """
    设备列表响应 Schema
    
    用于返回设备列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[EquipmentResponse] = Field(..., description="设备列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")

