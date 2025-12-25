"""
供应链网络 Schema 模块

定义供应链网络相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional


class SupplyChainNetworkBase(BaseModel):
    """供应链网络基础 Schema"""
    
    network_no: str = Field(..., max_length=100, description="网络编号")
    network_name: str = Field(..., max_length=200, description="网络名称")
    node_type: str = Field(..., max_length=50, description="节点类型")
    node_id: Optional[int] = Field(None, description="节点ID")
    node_name: Optional[str] = Field(None, max_length=200, description="节点名称")
    node_code: Optional[str] = Field(None, max_length=100, description="节点编码")
    parent_node_id: Optional[int] = Field(None, description="父节点ID")
    parent_node_uuid: Optional[str] = Field(None, max_length=36, description="父节点UUID")
    level: int = Field(1, description="层级")
    relationship_type: Optional[str] = Field(None, max_length=50, description="关系类型")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SupplyChainNetworkCreate(SupplyChainNetworkBase):
    """创建供应链网络 Schema"""
    pass


class SupplyChainNetworkUpdate(BaseModel):
    """更新供应链网络 Schema"""
    
    network_name: Optional[str] = Field(None, max_length=200, description="网络名称")
    node_type: Optional[str] = Field(None, max_length=50, description="节点类型")
    node_id: Optional[int] = Field(None, description="节点ID")
    node_name: Optional[str] = Field(None, max_length=200, description="节点名称")
    node_code: Optional[str] = Field(None, max_length=100, description="节点编码")
    parent_node_id: Optional[int] = Field(None, description="父节点ID")
    parent_node_uuid: Optional[str] = Field(None, max_length=36, description="父节点UUID")
    level: Optional[int] = Field(None, description="层级")
    relationship_type: Optional[str] = Field(None, max_length=50, description="关系类型")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SupplyChainNetworkResponse(SupplyChainNetworkBase):
    """供应链网络响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

