"""
单据关联模块数据验证schema

提供单据关联相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import Optional, List
from pydantic import BaseModel, Field

from core.schemas.base import BaseSchema


class DocumentInfo(BaseSchema):
    """单据信息"""
    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    document_code: Optional[str] = Field(None, description="单据编码")
    document_name: Optional[str] = Field(None, description="单据名称")
    status: Optional[str] = Field(None, description="单据状态")
    created_at: Optional[str] = Field(None, description="创建时间")


class DocumentRelationResponse(BaseSchema):
    """单据关联响应schema"""
    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    upstream_documents: List[DocumentInfo] = Field(..., description="上游单据列表")
    downstream_documents: List[DocumentInfo] = Field(..., description="下游单据列表")
    upstream_count: int = Field(..., description="上游单据数量")
    downstream_count: int = Field(..., description="下游单据数量")


class DocumentChainNode(BaseSchema):
    """单据链节点"""
    document: DocumentInfo = Field(..., description="单据信息")
    upstream_chain: List["DocumentChainNode"] = Field(default_factory=list, description="上游链")
    downstream_chain: List["DocumentChainNode"] = Field(default_factory=list, description="下游链")


class DocumentTraceResponse(BaseSchema):
    """单据追溯响应schema"""
    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    upstream_chain: List[DocumentChainNode] = Field(default_factory=list, description="上游追溯链")
    downstream_chain: List[DocumentChainNode] = Field(default_factory=list, description="下游追溯链")


# 更新前向引用
DocumentChainNode.model_rebuild()

