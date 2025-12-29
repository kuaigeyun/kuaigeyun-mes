"""
工艺数据 Schema 模块

定义工艺数据的 Pydantic Schema（不良品、工序、工艺路线、作业程序），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime


class DefectTypeBase(BaseModel):
    """不良品基础 Schema"""
    
    code: str = Field(..., max_length=50, description="不良品编码")
    name: str = Field(..., max_length=200, description="不良品名称")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("不良品编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("不良品名称不能为空")
        return v.strip()


class DefectTypeCreate(DefectTypeBase):
    """创建不良品 Schema"""
    pass


class DefectTypeUpdate(BaseModel):
    """更新不良品 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="不良品编码")
    name: Optional[str] = Field(None, max_length=200, description="不良品名称")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("不良品编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("不良品名称不能为空")
        return v.strip() if v else None


class DefectTypeResponse(DefectTypeBase):
    """不良品响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class OperationBase(BaseModel):
    """工序基础 Schema"""
    
    code: str = Field(..., max_length=50, description="工序编码")
    name: str = Field(..., max_length=200, description="工序名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("工序编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("工序名称不能为空")
        return v.strip()


class OperationCreate(OperationBase):
    """创建工序 Schema"""
    pass


class OperationUpdate(BaseModel):
    """更新工序 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="工序编码")
    name: Optional[str] = Field(None, max_length=200, description="工序名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工序编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工序名称不能为空")
        return v.strip() if v else None


class OperationResponse(OperationBase):
    """工序响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class ProcessRouteBase(BaseModel):
    """工艺路线基础 Schema"""

    code: str = Field(..., max_length=50, description="工艺路线编码")
    name: str = Field(..., max_length=200, description="工艺路线名称")
    description: Optional[str] = Field(None, description="描述")
    operation_sequence: Optional[Dict[str, Any]] = Field(None, description="工序序列（JSON格式）")
    is_active: bool = Field(True, description="是否启用")

    class Config:
        populate_by_name = True

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("工艺路线编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("工艺路线名称不能为空")
        return v.strip()


class ProcessRouteCreate(ProcessRouteBase):
    """创建工艺路线 Schema"""
    pass


class ProcessRouteUpdate(BaseModel):
    """更新工艺路线 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="工艺路线编码")
    name: Optional[str] = Field(None, max_length=200, description="工艺路线名称")
    description: Optional[str] = Field(None, description="描述")
    operation_sequence: Optional[Dict[str, Any]] = Field(None, description="工序序列（JSON格式）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工艺路线编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工艺路线名称不能为空")
        return v.strip() if v else None


class ProcessRouteResponse(ProcessRouteBase):
    """工艺路线响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


# ==================== 级联查询相关 Schema ====================

class OperationTreeResponse(OperationResponse):
    """工序树形响应 Schema（用于级联查询）"""
    
    class Config:
        from_attributes = True
        populate_by_name = True
        by_alias = True


class ProcessRouteTreeResponse(ProcessRouteResponse):
    """工艺路线树形响应 Schema（包含工序列表）"""
    
    operations: List[OperationTreeResponse] = Field(default_factory=list, description="工序列表（按序列顺序）")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        by_alias = True


class SOPBase(BaseModel):
    """作业程序（SOP）基础 Schema"""
    
    code: str = Field(..., max_length=50, description="SOP编码")
    name: str = Field(..., max_length=200, description="SOP名称")
    operation_id: Optional[int] = Field(None, description="关联工序ID")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    content: Optional[str] = Field(None, description="SOP内容（支持富文本）")
    attachments: Optional[Dict[str, Any]] = Field(None, description="附件列表（JSON格式）")
    flow_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（ProFlow JSON格式，包含 nodes 和 edges）")
    form_config: Optional[Dict[str, Any]] = Field(None, description="表单配置（Formily Schema格式，每个步骤的表单定义）")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("SOP编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("SOP名称不能为空")
        return v.strip()


class SOPCreate(SOPBase):
    """创建作业程序（SOP） Schema"""
    pass


class SOPUpdate(BaseModel):
    """更新作业程序（SOP） Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="SOP编码")
    name: Optional[str] = Field(None, max_length=200, description="SOP名称")
    operation_id: Optional[int] = Field(None, description="关联工序ID")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    content: Optional[str] = Field(None, description="SOP内容（支持富文本）")
    attachments: Optional[Dict[str, Any]] = Field(None, description="附件列表（JSON格式）")
    flow_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（ProFlow JSON格式，包含 nodes 和 edges）")
    form_config: Optional[Dict[str, Any]] = Field(None, description="表单配置（Formily Schema格式，每个步骤的表单定义）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("SOP编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("SOP名称不能为空")
        return v.strip() if v else None


class SOPResponse(SOPBase):
    """作业程序（SOP）响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True

