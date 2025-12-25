"""
文档版本 Schema 模块

定义文档版本数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class DocumentVersionBase(BaseModel):
    """文档版本基础 Schema"""
    
    version_no: str = Field(..., max_length=50, description="版本编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("version_no")
    def validate_version_no(cls, v):
        """验证版本编号格式"""
        if not v or not v.strip():
            raise ValueError("版本编号不能为空")
        return v.strip()


class DocumentVersionCreate(DocumentVersionBase):
    """创建文档版本 Schema"""
    pass


class DocumentVersionUpdate(BaseModel):
    """更新文档版本 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class DocumentVersionResponse(DocumentVersionBase):
    """文档版本响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
