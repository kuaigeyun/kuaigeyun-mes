"""
批号规则与序列号规则 Schema 模块

定义批号规则、序列号规则的 Pydantic Schema。

Author: RiverEdge Team
Date: 2026-02-26
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


# ==================== 批号规则 ====================

class BatchRuleBase(BaseModel):
    """批号规则基础 Schema"""
    name: str = Field(..., max_length=100, description="规则名称")
    code: str = Field(..., max_length=50, description="规则代码")
    rule_components: Optional[List[Dict[str, Any]]] = Field(None, description="规则组件列表（JSON）")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: int = Field(1, description="序号起始值")
    seq_step: int = Field(1, description="序号步长")
    seq_reset_rule: Optional[str] = Field(None, max_length=20, description="序号重置规则：never/daily/monthly/yearly")
    is_active: bool = Field(True, description="是否启用")


class BatchRuleCreate(BatchRuleBase):
    """创建批号规则 Schema"""
    pass


class BatchRuleUpdate(BaseModel):
    """更新批号规则 Schema"""
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    rule_components: Optional[List[Dict[str, Any]]] = None
    description: Optional[str] = None
    seq_start: Optional[int] = None
    seq_step: Optional[int] = None
    seq_reset_rule: Optional[str] = None
    is_active: Optional[bool] = None


class BatchRuleResponse(BatchRuleBase):
    """批号规则响应 Schema"""
    id: int = Field(..., description="规则ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    is_system: bool = Field(False, description="是否系统规则")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class BatchRuleListResponse(BaseModel):
    """批号规则列表响应"""
    items: List[BatchRuleResponse]
    total: int


# ==================== 序列号规则 ====================

class SerialRuleBase(BaseModel):
    """序列号规则基础 Schema"""
    name: str = Field(..., max_length=100, description="规则名称")
    code: str = Field(..., max_length=50, description="规则代码")
    rule_components: Optional[List[Dict[str, Any]]] = Field(None, description="规则组件列表（JSON）")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: int = Field(1, description="序号起始值")
    seq_step: int = Field(1, description="序号步长")
    seq_reset_rule: Optional[str] = Field(None, max_length=20, description="序号重置规则")
    is_active: bool = Field(True, description="是否启用")


class SerialRuleCreate(SerialRuleBase):
    """创建序列号规则 Schema"""
    pass


class SerialRuleUpdate(BaseModel):
    """更新序列号规则 Schema"""
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    rule_components: Optional[List[Dict[str, Any]]] = None
    description: Optional[str] = None
    seq_start: Optional[int] = None
    seq_step: Optional[int] = None
    seq_reset_rule: Optional[str] = None
    is_active: Optional[bool] = None


class SerialRuleResponse(SerialRuleBase):
    """序列号规则响应 Schema"""
    id: int = Field(..., description="规则ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    is_system: bool = Field(False, description="是否系统规则")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class SerialRuleListResponse(BaseModel):
    """序列号规则列表响应"""
    items: List[SerialRuleResponse]
    total: int
