"""
初始化向导 Schema 模块

定义初始化向导相关的 Pydantic Schema，用于数据验证和序列化。

Author: Luigi Lu
Date: 2025-01-15
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class InitStepConfig(BaseModel):
    """初始化步骤配置"""
    step_id: str = Field(..., description="步骤ID")
    title: str = Field(..., description="步骤标题")
    description: str = Field(..., description="步骤描述")
    order: int = Field(..., description="步骤顺序")
    required: bool = Field(True, description="是否必填")


class InitWizardStepResponse(BaseModel):
    """初始化步骤响应"""
    step_id: str = Field(..., description="步骤ID")
    title: str = Field(..., description="步骤标题")
    description: str = Field(..., description="步骤描述")
    order: int = Field(..., description="步骤顺序")
    required: bool = Field(..., description="是否必填")
    completed: bool = Field(False, description="是否已完成")


class InitStepsResponse(BaseModel):
    """初始化步骤列表响应"""
    steps: List[InitWizardStepResponse] = Field(..., description="步骤列表")
    current_step: Optional[str] = Field(None, description="当前步骤ID")
    progress: float = Field(0.0, description="完成进度（0-100）")


# 步骤1：组织信息完善
class Step1OrganizationInfo(BaseModel):
    """步骤1：组织信息完善"""
    organization_code: Optional[str] = Field(None, max_length=50, description="组织代码")
    industry: Optional[str] = Field(None, max_length=100, description="行业")
    scale: Optional[str] = Field(None, max_length=50, description="规模（small/medium/large）")


# 步骤2：默认设置
class Step2DefaultSettings(BaseModel):
    """步骤2：默认设置"""
    timezone: str = Field("Asia/Shanghai", description="时区")
    currency: str = Field("CNY", description="货币")
    language: str = Field("zh-CN", description="语言")


# 步骤2.5：编码规则配置
class Step2_5CodeRules(BaseModel):
    """步骤2.5：编码规则配置"""
    use_default_rules: bool = Field(True, description="是否使用默认编码规则")
    custom_rules: Optional[Dict[str, Any]] = Field(None, description="自定义编码规则（可选）")


# 步骤3：管理员信息
class Step3AdminInfo(BaseModel):
    """步骤3：管理员信息"""
    full_name: Optional[str] = Field(None, max_length=100, description="管理员全名")
    email: Optional[str] = Field(None, description="管理员邮箱")


# 步骤4：选择行业模板
class Step4Template(BaseModel):
    """步骤4：选择行业模板"""
    template_id: Optional[int] = Field(None, description="行业模板ID")


# 步骤数据汇总
class InitWizardData(BaseModel):
    """初始化向导数据"""
    step1_organization_info: Optional[Step1OrganizationInfo] = Field(None, description="步骤1数据")
    step2_default_settings: Optional[Step2DefaultSettings] = Field(None, description="步骤2数据")
    step2_5_code_rules: Optional[Step2_5CodeRules] = Field(None, description="步骤2.5数据")
    step3_admin_info: Optional[Step3AdminInfo] = Field(None, description="步骤3数据")
    step4_template: Optional[Step4Template] = Field(None, description="步骤4数据")


class StepCompleteRequest(BaseModel):
    """完成步骤请求"""
    step_id: str = Field(..., description="步骤ID")
    data: Dict[str, Any] = Field(..., description="步骤数据")


class InitWizardCompleteRequest(BaseModel):
    """完成初始化向导请求"""
    data: InitWizardData = Field(..., description="初始化数据")


class InitWizardResponse(BaseModel):
    """初始化向导响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="消息")
    tenant_id: int = Field(..., description="组织ID")

