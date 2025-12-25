"""
会计科目 Schema 模块

定义会计科目数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范设计。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime


class AccountSubjectBase(BaseModel):
    """会计科目基础 Schema"""
    
    subject_code: str = Field(..., max_length=50, description="科目编码（组织内唯一，按中国会计准则4-2-2-2结构）")
    subject_name: str = Field(..., max_length=200, description="科目名称")
    subject_type: str = Field(..., max_length=50, description="科目类型（资产、负债、所有者权益、收入、费用）")
    parent_id: Optional[int] = Field(None, description="父科目ID（用于科目层级）")
    level: int = Field(1, ge=1, le=4, description="科目层级（1-4级，按中国会计准则）")
    is_leaf: bool = Field(True, description="是否末级科目")
    direction: str = Field("借方", max_length=20, description="余额方向（借方、贷方）")
    status: str = Field("启用", max_length=20, description="状态（启用、停用）")
    assist_accounting: Optional[Dict[str, Any]] = Field(None, description="辅助核算（客户、供应商、部门、项目等）")
    currency: Optional[str] = Field(None, max_length=10, description="币种（人民币、美元等，默认人民币）")
    quantity_unit: Optional[str] = Field(None, max_length=20, description="数量单位（用于数量金额式账页）")
    
    @validator("subject_code")
    def validate_subject_code(cls, v):
        """验证科目编码格式"""
        if not v or not v.strip():
            raise ValueError("科目编码不能为空")
        return v.strip()
    
    @validator("subject_type")
    def validate_subject_type(cls, v):
        """验证科目类型"""
        allowed_types = ["资产", "负债", "所有者权益", "收入", "费用"]
        if v not in allowed_types:
            raise ValueError(f"科目类型必须是以下之一：{', '.join(allowed_types)}")
        return v
    
    @validator("direction")
    def validate_direction(cls, v):
        """验证余额方向"""
        if v not in ["借方", "贷方"]:
            raise ValueError("余额方向必须是'借方'或'贷方'")
        return v


class AccountSubjectCreate(AccountSubjectBase):
    """创建会计科目 Schema"""
    pass


class AccountSubjectUpdate(BaseModel):
    """更新会计科目 Schema"""
    
    subject_name: Optional[str] = Field(None, max_length=200, description="科目名称")
    subject_type: Optional[str] = Field(None, max_length=50, description="科目类型")
    parent_id: Optional[int] = Field(None, description="父科目ID")
    level: Optional[int] = Field(None, ge=1, le=4, description="科目层级")
    is_leaf: Optional[bool] = Field(None, description="是否末级科目")
    direction: Optional[str] = Field(None, max_length=20, description="余额方向")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    assist_accounting: Optional[Dict[str, Any]] = Field(None, description="辅助核算")
    currency: Optional[str] = Field(None, max_length=10, description="币种")
    quantity_unit: Optional[str] = Field(None, max_length=20, description="数量单位")


class AccountSubjectResponse(AccountSubjectBase):
    """会计科目响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

