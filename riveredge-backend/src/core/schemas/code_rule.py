"""
编码规则 Schema 模块

定义编码规则相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class CodeRuleBase(BaseModel):
    """
    编码规则基础 Schema
    
    包含编码规则的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="规则名称")
    code: str = Field(..., min_length=1, max_length=50, description="规则代码（唯一，用于程序识别）")
    expression: str = Field(..., min_length=1, max_length=200, description="规则表达式")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: int = Field(default=1, ge=0, description="序号起始值")
    seq_step: int = Field(default=1, ge=1, description="序号步长")
    seq_reset_rule: Optional[str] = Field(None, description="序号重置规则：never、daily、monthly、yearly")
    is_system: bool = Field(default=False, description="是否系统规则")
    is_active: bool = Field(default=True, description="是否启用")
    
    @field_validator("seq_reset_rule")
    @classmethod
    def validate_reset_rule(cls, v: Optional[str]) -> Optional[str]:
        """
        验证序号重置规则
        
        Args:
            v: 重置规则值
            
        Returns:
            验证后的重置规则值
            
        Raises:
            ValueError: 如果重置规则不合法
        """
        if v is not None and v not in ("never", "daily", "monthly", "yearly"):
            raise ValueError("序号重置规则必须是 never、daily、monthly 或 yearly")
        return v


class CodeRuleCreate(CodeRuleBase):
    """
    编码规则创建 Schema
    
    用于创建新编码规则的请求数据。
    """
    pass


class CodeRuleUpdate(BaseModel):
    """
    编码规则更新 Schema
    
    用于更新编码规则的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="规则名称")
    expression: Optional[str] = Field(None, min_length=1, max_length=200, description="规则表达式")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: Optional[int] = Field(None, ge=0, description="序号起始值")
    seq_step: Optional[int] = Field(None, ge=1, description="序号步长")
    seq_reset_rule: Optional[str] = Field(None, description="序号重置规则：never、daily、monthly、yearly")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @field_validator("seq_reset_rule")
    @classmethod
    def validate_reset_rule(cls, v: Optional[str]) -> Optional[str]:
        """
        验证序号重置规则
        
        Args:
            v: 重置规则值
            
        Returns:
            验证后的重置规则值
            
        Raises:
            ValueError: 如果重置规则不合法
        """
        if v is not None and v not in ("never", "daily", "monthly", "yearly"):
            raise ValueError("序号重置规则必须是 never、daily、monthly 或 yearly")
        return v


class CodeRuleResponse(CodeRuleBase):
    """
    编码规则响应 Schema
    
    用于返回编码规则信息。
    """
    uuid: str = Field(..., description="规则UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class CodeGenerationRequest(BaseModel):
    """
    编码生成请求 Schema
    
    用于测试编码生成功能。
    """
    rule_code: str = Field(..., description="规则代码")
    context: Optional[dict] = Field(None, description="上下文变量（可选，用于自定义变量）")


class CodeGenerationResponse(BaseModel):
    """
    编码生成响应 Schema
    
    用于返回生成的编码。
    """
    code: str = Field(..., description="生成的编码")
    rule_name: str = Field(..., description="规则名称")

