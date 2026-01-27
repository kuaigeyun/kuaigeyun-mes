"""
编码规则 Schema 模块

定义编码规则相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class CodeRuleBase(BaseModel):
    """
    编码规则基础 Schema
    
    包含编码规则的基本字段，用于创建和更新操作。
    
    注意：
    - expression: 规则表达式（旧格式，向后兼容）
    - rule_components: 规则组件列表（新格式，完全可配置）
    - 如果提供了rule_components，系统会自动生成expression；如果只提供了expression，系统会尝试解析为组件格式
    """
    name: str = Field(..., min_length=1, max_length=100, description="规则名称")
    code: str = Field(..., min_length=1, max_length=50, description="规则代码（唯一，用于程序识别）")
    expression: Optional[str] = Field(None, min_length=1, max_length=500, description="规则表达式（旧格式，向后兼容）")
    rule_components: Optional[List[Dict[str, Any]]] = Field(None, description="规则组件列表（新格式，完全可配置）")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: int = Field(default=1, ge=0, description="序号起始值（向后兼容，从自动计数组件读取）")
    seq_step: int = Field(default=1, ge=1, description="序号步长（向后兼容）")
    seq_reset_rule: Optional[str] = Field(None, description="序号重置规则：never、daily、monthly、yearly（向后兼容，从自动计数组件读取）")
    is_system: bool = Field(default=False, description="是否系统规则")
    is_active: bool = Field(default=True, description="是否启用")
    allow_manual_edit: bool = Field(default=True, description="允许手动填写（如果为True，用户可以手动修改自动生成的编码）")
    
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
    
    @field_validator("rule_components")
    @classmethod
    def validate_rule_components(cls, v: Optional[List[Dict[str, Any]]]) -> Optional[List[Dict[str, Any]]]:
        """
        验证规则组件列表
        
        Args:
            v: 组件列表
            
        Returns:
            验证后的组件列表
        """
        if v is not None:
            # 如果是空列表，返回None（表示不更新）
            if isinstance(v, list) and len(v) == 0:
                return None
            # 否则验证组件配置
            config = CodeRuleComponentsConfig(components=v)
            return config.components
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
    expression: Optional[str] = Field(None, min_length=1, max_length=500, description="规则表达式（旧格式，向后兼容）")
    rule_components: Optional[List[Dict[str, Any]]] = Field(None, description="规则组件列表（新格式，完全可配置）")
    description: Optional[str] = Field(None, description="规则描述")
    seq_start: Optional[int] = Field(None, ge=0, description="序号起始值（向后兼容）")
    seq_step: Optional[int] = Field(None, ge=1, description="序号步长（向后兼容）")
    seq_reset_rule: Optional[str] = Field(None, description="序号重置规则：never、daily、monthly、yearly（向后兼容）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    allow_manual_edit: Optional[bool] = Field(None, description="允许手动填写")
    
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
    
    @field_validator("rule_components")
    @classmethod
    def validate_rule_components(cls, v: Optional[List[Dict[str, Any]]]) -> Optional[List[Dict[str, Any]]]:
        """
        验证规则组件列表
        
        Args:
            v: 组件列表
            
        Returns:
            验证后的组件列表
        """
        if v is not None:
            # 如果是空列表，返回None（表示不更新）
            if isinstance(v, list) and len(v) == 0:
                return None
            # 否则验证组件配置
            config = CodeRuleComponentsConfig(components=v)
            return config.components
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
    check_duplicate: Optional[bool] = Field(default=False, description="是否检查重复（如果为True，会自动递增直到找到不重复的编码）")
    entity_type: Optional[str] = Field(default=None, description="实体类型（如：'material'，用于检查重复）")
    rule_code: str = Field(..., description="规则代码")
    context: Optional[dict] = Field(None, description="上下文变量（可选，用于自定义变量）")


class CodeGenerationResponse(BaseModel):
    """
    编码生成响应 Schema
    
    用于返回生成的编码。
    """
    code: str = Field(..., description="生成的编码")
    rule_name: str = Field(..., description="规则名称")


class CodeRulePageFieldConfig(BaseModel):
    """
    编码规则页面可用字段配置 Schema
    """
    field_name: str = Field(..., description="字段名称")
    field_label: str = Field(..., description="字段显示名称")
    field_type: str = Field(..., description="字段类型")
    description: Optional[str] = Field(None, description="字段描述")


class CodeRulePageConfigResponse(BaseModel):
    """
    编码规则页面配置响应 Schema
    
    用于返回功能页面配置信息。
    """
    page_code: str = Field(..., description="页面唯一标识")
    page_name: str = Field(..., description="页面名称")
    page_path: str = Field(..., description="页面路径")
    code_field: str = Field(..., description="编码字段名称")
    code_field_label: str = Field(..., description="编码字段显示名称")
    module: str = Field(..., description="所属模块")
    module_icon: Optional[str] = Field(None, description="模块图标")
    auto_generate: bool = Field(default=False, description="是否启用自动编码")
    rule_code: Optional[str] = Field(None, description="关联的编码规则代码")
    allow_manual_edit: bool = Field(default=True, description="允许手动填写（如果为True，用户可以手动修改自动生成的编码）")
    available_fields: Optional[list[CodeRulePageFieldConfig]] = Field(None, description="可用字段列表（用于字段引用）")


# ==================== 规则组件相关 Schema ====================

class CodeRuleComponentBase(BaseModel):
    """
    编码规则组件基础 Schema
    
    所有规则组件的基类。
    """
    type: str = Field(..., description="组件类型")
    order: int = Field(..., description="组件顺序（用于排序）")


class AutoCounterComponent(CodeRuleComponentBase):
    """
    自动计数组件
    
    可选组件，不可重复添加。
    """
    type: Literal["auto_counter"] = "auto_counter"
    digits: int = Field(default=5, ge=2, le=12, description="计数位数（2-12）")
    fixed_width: bool = Field(default=True, description="是否固定位数（开启后显示固定位数，如00001）")
    reset_cycle: Literal["never", "daily", "monthly", "yearly"] = Field(default="never", description="重置周期")
    initial_value: int = Field(default=1, ge=0, description="初始值")


class DateComponent(CodeRuleComponentBase):
    """
    提交日期组件
    
    可选组件，不可重复添加。
    """
    type: Literal["date"] = "date"
    format_type: Literal["preset", "custom"] = Field(default="preset", description="格式类型：预定义或自定义")
    preset_format: Optional[str] = Field(None, description="预定义格式（如：YYYYMMDD）")
    custom_format: Optional[str] = Field(None, description="自定义格式（使用y、M、d表示年月日）")


class FixedTextComponent(CodeRuleComponentBase):
    """
    固定字符组件
    
    可选组件，可重复添加。
    """
    type: Literal["fixed_text"] = "fixed_text"
    text: str = Field(..., min_length=1, max_length=50, description="固定字符内容")


class FormFieldComponent(CodeRuleComponentBase):
    """
    表单字段组件
    
    可选组件，可重复添加。
    """
    type: Literal["form_field"] = "form_field"
    field_name: str = Field(..., min_length=1, max_length=100, description="表单字段名称")


# 规则组件联合类型
CodeRuleComponent = AutoCounterComponent | DateComponent | FixedTextComponent | FormFieldComponent


class CodeRuleComponentsConfig(BaseModel):
    """
    编码规则组件配置
    
    用于存储规则组件的完整配置。
    """
    components: List[Dict[str, Any]] = Field(..., description="规则组件列表（JSON格式）")
    
    @field_validator("components")
    @classmethod
    def validate_components(cls, v: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        验证规则组件列表
        
        Args:
            v: 组件列表
            
        Returns:
            验证后的组件列表
            
        Raises:
            ValueError: 如果组件配置无效
        """
        if not v:
            raise ValueError("规则组件列表不能为空")
        
        # 检查自动计数组件是否重复（如果存在）
        counter_count = sum(1 for comp in v if comp.get("type") == "auto_counter")
        if counter_count > 1:
            raise ValueError("自动计数组件只能添加一个")
        
        # 检查日期组件是否重复
        date_count = sum(1 for comp in v if comp.get("type") == "date")
        if date_count > 1:
            raise ValueError("日期组件只能添加一个")
        
        # 验证每个组件的类型和必填字段
        for comp in v:
            comp_type = comp.get("type")
            if comp_type not in ["auto_counter", "date", "fixed_text", "form_field"]:
                raise ValueError(f"不支持的组件类型: {comp_type}")
            
            # 验证必填字段
            if comp_type == "auto_counter":
                if "digits" not in comp:
                    raise ValueError("自动计数组件必须包含digits字段")
            elif comp_type == "date":
                if comp.get("format_type") == "preset" and "preset_format" not in comp:
                    raise ValueError("日期组件使用预定义格式时必须包含preset_format字段")
                if comp.get("format_type") == "custom" and "custom_format" not in comp:
                    raise ValueError("日期组件使用自定义格式时必须包含custom_format字段")
            elif comp_type == "fixed_text":
                if "text" not in comp or not comp["text"]:
                    raise ValueError("固定字符组件必须包含非空的text字段")
            elif comp_type == "form_field":
                if "field_name" not in comp or not comp["field_name"]:
                    raise ValueError("表单字段组件必须包含非空的field_name字段")
        
        return v

