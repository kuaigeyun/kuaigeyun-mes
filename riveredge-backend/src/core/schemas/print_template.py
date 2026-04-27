"""
打印模板 Schema 模块

定义打印模板相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class PrintTemplateBase(BaseModel):
    """打印模板基础 Schema"""
    name: str = Field(..., max_length=200, description="模板名称")
    code: str = Field(..., max_length=50, description="模板代码基名（创建时自动追加 _流水号）")
    type: str = Field(..., max_length=50, description="模板类型")
    description: Optional[str] = Field(None, description="模板描述")
    content: str = Field(..., description="模板内容")
    config: Optional[Dict[str, Any]] = Field(None, description="模板配置")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证模板类型"""
        allowed_types = ['pdf', 'html', 'word', 'excel', 'other']
        if v not in allowed_types:
            raise ValueError(f'模板类型必须是 {allowed_types} 之一')
        return v


class PrintTemplateCreate(PrintTemplateBase):
    """创建打印模板 Schema"""
    pass


class PrintTemplateUpdate(BaseModel):
    """更新打印模板 Schema"""
    name: Optional[str] = Field(None, max_length=200, description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    content: Optional[str] = Field(None, description="模板内容")
    config: Optional[Dict[str, Any]] = Field(None, description="模板配置")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_default: Optional[bool] = Field(None, description="是否默认模板")


class PrintTemplateRenderRequest(BaseModel):
    """渲染打印模板请求 Schema"""
    data: Dict[str, Any] = Field(..., description="模板数据")
    output_format: Optional[str] = Field("pdf", description="输出格式")
    async_execution: bool = Field(False, description="是否异步执行（Taskiq 后台任务）")


class PrintTemplateCompileRequest(BaseModel):
    """编译可视化模板请求"""
    source_type: str = Field("designer_json", description="源码类型：designer_json 或 html_jinja")
    source: Dict[str, Any] | str = Field(..., description="设计器 schema 或原始模板源码")
    target_engine: str = Field("jinja2", description="目标渲染引擎")
    document_type: Optional[str] = Field(None, description="业务单据类型")


class PrintTemplateCompilePreviewRequest(PrintTemplateCompileRequest):
    """编译并预览可视化模板请求"""
    preview_data: Optional[Dict[str, Any]] = Field(None, description="预览渲染数据")
    strict_variables: bool = Field(False, description="是否严格变量模式")


class PrintTemplateCompileResponse(BaseModel):
    """编译可视化模板响应"""
    success: bool = Field(..., description="是否成功")
    compiled_template: str = Field(..., description="编译后的模板")
    schema_version: Optional[str] = Field(None, description="schema 版本")
    warnings: Optional[list[str]] = Field(None, description="编译告警")


class PrintTemplateCompilePreviewResponse(PrintTemplateCompileResponse):
    """编译并预览响应"""
    rendered_html: Optional[str] = Field(None, description="使用 preview_data 渲染后的 HTML")


class PrintTemplateResponse(PrintTemplateBase):
    """打印模板响应 Schema"""
    uuid: UUID = Field(..., description="打印模板UUID")
    tenant_id: int = Field(..., description="组织ID")
    is_active: bool = Field(..., description="是否启用")
    is_default: bool = Field(..., description="是否默认模板")
    inngest_function_id: Optional[str] = Field(None, description="后台任务函数 ID（Taskiq；历史字段名）")
    usage_count: int = Field(..., description="使用次数")
    last_used_at: Optional[datetime] = Field(None, description="最后使用时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PrintTemplateRenderResponse(BaseModel):
    """打印模板渲染响应 Schema"""
    success: bool = Field(..., description="是否成功")
    output_format: Optional[str] = Field(None, description="输出格式")
    content: Optional[str] = Field(None, description="渲染内容（HTML 或 base64 PDF）")
    content_encoding: Optional[str] = Field(None, description="内容编码（如 base64）")
    mime_type: Optional[str] = Field(None, description="MIME 类型")
    message: Optional[str] = Field(None, description="返回信息")
    file_url: Optional[str] = Field(None, description="生成文件URL")
    file_uuid: Optional[str] = Field(None, description="生成文件UUID")
    error: Optional[str] = Field(None, description="错误信息")
    inngest_run_id: Optional[str] = Field(None, description="异步任务 ID / Taskiq task_id（历史字段名 inngest_run_id）")

