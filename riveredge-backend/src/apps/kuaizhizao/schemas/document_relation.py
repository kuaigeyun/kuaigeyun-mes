"""
单据关联关系Schema

提供单据关联关系相关的数据验证Schema。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class DocumentRelationBase(BaseModel):
    """单据关联关系基础Schema"""
    source_type: str = Field(..., max_length=50, description="源单据类型")
    source_id: int = Field(..., description="源单据ID")
    source_code: Optional[str] = Field(None, max_length=50, description="源单据编码")
    source_name: Optional[str] = Field(None, max_length=200, description="源单据名称")
    
    target_type: str = Field(..., max_length=50, description="目标单据类型")
    target_id: int = Field(..., description="目标单据ID")
    target_code: Optional[str] = Field(None, max_length=50, description="目标单据编码")
    target_name: Optional[str] = Field(None, max_length=200, description="目标单据名称")
    
    relation_type: str = Field(..., max_length=20, description="关联类型（source/target）")
    relation_mode: str = Field("push", max_length=20, description="关联方式（push/pull/manual）")
    relation_desc: Optional[str] = Field(None, max_length=200, description="关联描述")
    
    business_mode: Optional[str] = Field(None, max_length=20, description="业务模式（MTS/MTO）")
    demand_id: Optional[int] = Field(None, description="关联的需求ID")
    notes: Optional[str] = Field(None, description="备注")
    
    @field_validator("relation_type")
    def validate_relation_type(cls, v):
        """验证关联类型"""
        if v not in ["source", "target"]:
            raise ValueError("关联类型必须是source或target")
        return v
    
    @field_validator("relation_mode")
    def validate_relation_mode(cls, v):
        """验证关联方式"""
        if v not in ["push", "pull", "manual"]:
            raise ValueError("关联方式必须是push、pull或manual")
        return v


class DocumentRelationCreate(DocumentRelationBase):
    """创建单据关联关系Schema"""
    pass


class DocumentRelationResponse(DocumentRelationBase):
    """单据关联关系响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    
    class Config:
        from_attributes = True


class DocumentRelationListResponse(BaseModel):
    """单据关联关系列表响应Schema"""
    upstream: List[DocumentRelationResponse] = Field(default_factory=list, description="上游单据列表")
    downstream: List[DocumentRelationResponse] = Field(default_factory=list, description="下游单据列表")


class DocumentTraceNode(BaseModel):
    """单据追溯节点"""
    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    document_code: Optional[str] = Field(None, description="单据编码")
    document_name: Optional[str] = Field(None, description="单据名称")
    level: int = Field(..., description="层级（从根节点开始的层级）")
    children: List["DocumentTraceNode"] = Field(default_factory=list, description="子节点（下游或上游）")


class DocumentTraceResponse(BaseModel):
    """单据追溯响应Schema"""
    document_type: str = Field(..., description="根单据类型")
    document_id: int = Field(..., description="根单据ID")
    document_code: Optional[str] = Field(None, description="根单据编码")
    document_name: Optional[str] = Field(None, description="根单据名称")
    upstream_chain: List[DocumentTraceNode] = Field(default_factory=list, description="上游追溯链")
    downstream_chain: List[DocumentTraceNode] = Field(default_factory=list, description="下游追溯链")
