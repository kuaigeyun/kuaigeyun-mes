"""
物料编码规则配置 Schema 模块

定义物料编码规则配置相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2026-01-08
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class MaterialTypeConfigBase(BaseModel):
    """物料类型配置基础 Schema"""
    
    code: str = Field(..., max_length=20, description="类型代码（如：FIN, SEMI, RAW）")
    name: str = Field(..., max_length=100, description="类型名称（如：成品, 半成品, 原材料）")
    description: Optional[str] = Field(None, max_length=255, description="类型描述")
    independent_sequence: bool = Field(True, description="是否独立计数")


class SequenceConfigBase(BaseModel):
    """序号配置基础 Schema"""
    
    length: int = Field(4, ge=1, le=10, description="序号位数")
    start_value: int = Field(1, ge=0, description="起始值")
    step: int = Field(1, ge=1, description="步长")
    padding: Dict[str, Any] = Field(
        default={"direction": "left", "char": "0"},
        description="填充配置：{'direction': 'left/right', 'char': '0'}"
    )
    independent_by_type: bool = Field(True, description="是否按类型独立计数")
    
    @field_validator("padding")
    @classmethod
    def validate_padding(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """验证填充配置"""
        if "direction" not in v:
            v["direction"] = "left"
        if "char" not in v:
            v["char"] = "0"
        if v["direction"] not in ("left", "right"):
            raise ValueError("填充方向必须是 left 或 right")
        return v


class MaterialCodeRuleMainBase(BaseModel):
    """主编码规则配置基础 Schema"""
    
    rule_name: str = Field(..., min_length=1, max_length=100, description="规则名称")
    template: str = Field(..., min_length=1, max_length=200, description="格式模板（如：{PREFIX}-{TYPE}-{SEQUENCE}）")
    prefix: Optional[str] = Field(None, max_length=50, description="前缀（如：MAT）")
    sequence_config: Optional[Dict[str, Any]] = Field(None, description="序号配置（JSON格式）")
    material_types: Optional[List[MaterialTypeConfigBase]] = Field(None, description="物料类型列表")


class MaterialCodeRuleMainCreate(MaterialCodeRuleMainBase):
    """创建主编码规则 Schema"""
    pass


class MaterialCodeRuleMainUpdate(BaseModel):
    """更新主编码规则 Schema"""
    
    rule_name: Optional[str] = Field(None, min_length=1, max_length=100, description="规则名称")
    template: Optional[str] = Field(None, min_length=1, max_length=200, description="格式模板")
    prefix: Optional[str] = Field(None, max_length=50, description="前缀")
    sequence_config: Optional[Dict[str, Any]] = Field(None, description="序号配置")
    material_types: Optional[List[MaterialTypeConfigBase]] = Field(None, description="物料类型列表")


class MaterialCodeRuleMainResponse(MaterialCodeRuleMainBase):
    """主编码规则配置响应 Schema"""
    
    id: int = Field(..., description="规则ID")
    uuid: UUID = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    is_active: bool = Field(..., description="是否启用")
    version: int = Field(..., description="版本号")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialCodeRuleAliasBase(BaseModel):
    """部门编码规则配置基础 Schema"""
    
    code_type: str = Field(..., min_length=1, max_length=50, description="编码类型代码（如：SALE, DES, SUP）")
    code_type_name: str = Field(..., min_length=1, max_length=100, description="编码类型名称（如：销售编码, 设计编码）")
    template: Optional[str] = Field(None, max_length=200, description="格式模板（如：{PREFIX}-{DEPT}-{SEQUENCE}）")
    prefix: Optional[str] = Field(None, max_length=50, description="前缀（如：SALE）")
    validation_pattern: Optional[str] = Field(None, max_length=500, description="验证规则（正则表达式）")
    departments: Optional[List[str]] = Field(None, description="关联部门列表")


class MaterialCodeRuleAliasCreate(MaterialCodeRuleAliasBase):
    """创建部门编码规则 Schema"""
    pass


class MaterialCodeRuleAliasUpdate(BaseModel):
    """更新部门编码规则 Schema"""
    
    code_type_name: Optional[str] = Field(None, min_length=1, max_length=100, description="编码类型名称")
    template: Optional[str] = Field(None, max_length=200, description="格式模板")
    prefix: Optional[str] = Field(None, max_length=50, description="前缀")
    validation_pattern: Optional[str] = Field(None, max_length=500, description="验证规则")
    departments: Optional[List[str]] = Field(None, description="关联部门列表")


class MaterialCodeRuleAliasResponse(MaterialCodeRuleAliasBase):
    """部门编码规则配置响应 Schema"""
    
    id: int = Field(..., description="规则ID")
    uuid: UUID = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    is_active: bool = Field(..., description="是否启用")
    version: int = Field(..., description="版本号")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class CodePreviewRequest(BaseModel):
    """编码预览请求 Schema"""
    
    template: str = Field(..., min_length=1, max_length=200, description="格式模板")
    prefix: Optional[str] = Field(None, max_length=50, description="前缀")
    material_type: str = Field("RAW", max_length=20, description="物料类型代码")
    sample_sequence: int = Field(1, ge=1, description="示例序号")
    sequence_config: Optional[Dict[str, Any]] = Field(None, description="序号配置（用于预览 Scope Key）")


class CodePreviewResponse(BaseModel):
    """编码预览响应 Schema"""
    
    preview_code: str = Field(..., description="预览的编码")
    sequence_key: Optional[str] = Field(None, description="序号作用域 Key（用于验证隔离策略）")
