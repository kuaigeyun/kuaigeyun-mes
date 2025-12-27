"""
成本中心 Schema 模块

定义成本中心数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：成本中心管理。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class CostCenterBase(BaseModel):
    """成本中心基础 Schema"""
    
    center_code: str = Field(..., max_length=50, description="成本中心编码（组织内唯一）")
    center_name: str = Field(..., max_length=200, description="成本中心名称")
    center_type: str = Field(..., max_length=50, description="成本中心类型（生产中心、服务中心、管理中心等）")
    department_id: Optional[int] = Field(None, description="部门ID（关联master-data）")
    parent_id: Optional[int] = Field(None, description="父成本中心ID（用于成本中心层级）")
    level: int = Field(1, ge=1, description="成本中心层级")
    status: str = Field("启用", max_length=20, description="状态（启用、停用）")
    
    @validator("center_code")
    def validate_center_code(cls, v):
        """验证成本中心编码格式"""
        if not v or not v.strip():
            raise ValueError("成本中心编码不能为空")
        return v.strip()
    
    @validator("center_type")
    def validate_center_type(cls, v):
        """验证成本中心类型"""
        allowed_types = ["生产中心", "服务中心", "管理中心", "其他"]
        if v not in allowed_types:
            raise ValueError(f"成本中心类型必须是以下之一：{', '.join(allowed_types)}")
        return v


class CostCenterCreate(CostCenterBase):
    """创建成本中心 Schema"""
    pass


class CostCenterUpdate(BaseModel):
    """更新成本中心 Schema"""
    
    center_name: Optional[str] = Field(None, max_length=200, description="成本中心名称")
    center_type: Optional[str] = Field(None, max_length=50, description="成本中心类型")
    department_id: Optional[int] = Field(None, description="部门ID")
    parent_id: Optional[int] = Field(None, description="父成本中心ID")
    level: Optional[int] = Field(None, ge=1, description="成本中心层级")
    status: Optional[str] = Field(None, max_length=20, description="状态")


class CostCenterResponse(CostCenterBase):
    """成本中心响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

