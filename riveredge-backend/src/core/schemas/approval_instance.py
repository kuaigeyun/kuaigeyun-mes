"""
审批实例 Schema 模块

定义审批实例相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class ApprovalInstanceBase(BaseModel):
    """审批实例基础 Schema"""
    process_uuid: UUID = Field(..., description="关联流程UUID")
    title: str = Field(..., max_length=200, description="审批标题")
    content: Optional[str] = Field(None, description="审批内容")
    data: Optional[Dict[str, Any]] = Field(None, description="审批数据")


class ApprovalInstanceCreate(ApprovalInstanceBase):
    """创建审批实例 Schema"""
    pass


class ApprovalInstanceUpdate(BaseModel):
    """更新审批实例 Schema"""
    title: Optional[str] = Field(None, max_length=200, description="审批标题")
    content: Optional[str] = Field(None, description="审批内容")
    data: Optional[Dict[str, Any]] = Field(None, description="审批数据")
    status: Optional[str] = Field(None, max_length=20, description="审批状态")
    current_node: Optional[str] = Field(None, max_length=100, description="当前节点")
    current_approver_id: Optional[int] = Field(None, description="当前审批人ID")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        """验证审批状态"""
        if v is None:
            return v
        allowed_statuses = ['pending', 'approved', 'rejected', 'cancelled']
        if v not in allowed_statuses:
            raise ValueError(f'审批状态必须是 {allowed_statuses} 之一')
        return v


class ApprovalInstanceBatchAction(BaseModel):
    """批量审批操作"""
    instance_uuids: List[str] = Field(..., min_length=1, description="审批实例 UUID 列表")
    action: str = Field(..., description="操作类型（approve、reject）")
    comment: Optional[str] = Field(None, description="审批意见")

    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        allowed_actions = ['approve', 'reject']
        if v not in allowed_actions:
            raise ValueError(f'批量操作类型必须是 {allowed_actions} 之一')
        return v


class ApprovalInstanceBatchResult(BaseModel):
    """批量审批结果"""
    success_count: int
    failure_count: int
    failures: List[Dict[str, Any]] = Field(default_factory=list)


class ApprovalInstanceAction(BaseModel):
    """审批操作 Schema"""
    action: str = Field(..., description="操作类型（approve、reject、cancel、transfer）")
    comment: Optional[str] = Field(None, description="审批意见")
    transfer_to_user_id: Optional[int] = Field(None, description="转交目标用户ID（仅转交时使用）")
    instance_data_patch: Optional[Dict[str, Any]] = Field(
        None,
        description="当前节点 decisionOnApprove 允许的 instance.data 写入（分支决策）",
    )
    
    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        """验证操作类型"""
        allowed_actions = ['approve', 'reject', 'cancel', 'transfer']
        if v not in allowed_actions:
            raise ValueError(f'操作类型必须是 {allowed_actions} 之一')
        return v


class ApprovalDocumentField(BaseModel):
    """审批详情抬头字段（已标注中文名）。"""
    key: str = Field(..., description="字段名")
    label: str = Field(..., description="展示名")
    value: str = Field(..., description="展示值")


class ApprovalDocumentLine(BaseModel):
    """审批详情明细行。"""
    id: str = Field(..., description="行标识")
    title: str = Field(..., description="物料/行标题")
    meta: Optional[str] = Field(None, description="行补充说明")
    qty_text: Optional[str] = Field(None, description="数量与金额")


class ApprovalDocumentView(BaseModel):
    """审批关联单据的只读详情（活单据，非提交时一行摘要）。"""
    entity_type: str = Field(..., description="单据 entity_type")
    entity_name: str = Field(..., description="单据名称")
    code: str = Field(..., description="单据编号")
    status: Optional[str] = Field(None, description="单据业务状态")
    header: List[ApprovalDocumentField] = Field(default_factory=list, description="抬头字段")
    lines: List[ApprovalDocumentLine] = Field(default_factory=list, description="明细行")


class ApprovalInstanceResponse(ApprovalInstanceBase):
    """审批实例响应 Schema"""
    uuid: UUID = Field(..., description="审批实例UUID")
    tenant_id: int = Field(..., description="组织ID")
    process_uuid: UUID = Field(..., description="关联流程UUID")
    status: str = Field(..., description="审批状态")
    current_node: Optional[str] = Field(None, description="当前节点")
    current_node_label: Optional[str] = Field(None, description="当前节点展示名")
    current_approver_id: Optional[int] = Field(None, description="当前审批人ID")
    has_my_pending_task: Optional[bool] = Field(
        None,
        description="当前登录用户是否对该实例有 pending 审批任务（会签/或签；列表接口填充）",
    )
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    submitter_id: int = Field(..., description="提交人ID")
    submitter_name: Optional[str] = Field(None, description="提交人姓名")
    submitted_at: datetime = Field(..., description="提交时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    document: Optional[ApprovalDocumentView] = Field(
        None, description="关联业务单据详情（仅 GET 单条时填充）"
    )
    document_error: Optional[str] = Field(
        None, description="关联单据无法加载时的错误说明"
    )

    model_config = ConfigDict(from_attributes=True)

