"""
流程审批模型模块

定义流程审批数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ApprovalProcess(BaseModel):
    """
    审批流程模型
    
    用于管理审批流程，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        process_no: 流程编号（组织内唯一）
        process_name: 流程名称
        process_type: 流程类型（请假、报销、采购、人事等）
        process_config: 流程配置（JSON格式）
        status: 状态（草稿、已发布、已停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaioa_approval_processes"
        indexes = [
            ("tenant_id",),
            ("process_no",),
            ("uuid",),
            ("process_name",),
            ("process_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "process_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    process_no = fields.CharField(max_length=50, description="流程编号（组织内唯一）")
    process_name = fields.CharField(max_length=200, description="流程名称")
    process_type = fields.CharField(max_length=50, description="流程类型（请假、报销、采购、人事等）")
    process_config = fields.JSONField(null=True, description="流程配置（JSON格式）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已发布、已停用）")
    
    def __str__(self):
        return f"{self.process_no} - {self.process_name}"


class ApprovalInstance(BaseModel):
    """
    审批实例模型
    
    用于管理审批实例，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        instance_no: 实例编号（组织内唯一）
        process_id: 流程ID（关联ApprovalProcess）
        business_type: 业务类型
        business_id: 业务ID
        applicant_id: 申请人ID（关联master-data）
        applicant_name: 申请人姓名
        application_date: 申请日期
        current_node_id: 当前节点ID（关联ApprovalNode）
        status: 状态（待审批、审批中、已通过、已拒绝、已撤回、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaioa_approval_instances"
        indexes = [
            ("tenant_id",),
            ("instance_no",),
            ("uuid",),
            ("process_id",),
            ("business_type",),
            ("business_id",),
            ("applicant_id",),
            ("application_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "instance_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    instance_no = fields.CharField(max_length=50, description="实例编号（组织内唯一）")
    process_id = fields.IntField(description="流程ID（关联ApprovalProcess）")
    business_type = fields.CharField(max_length=50, description="业务类型")
    business_id = fields.IntField(null=True, description="业务ID")
    
    # 申请人信息
    applicant_id = fields.IntField(description="申请人ID（关联master-data）")
    applicant_name = fields.CharField(max_length=100, description="申请人姓名")
    application_date = fields.DatetimeField(description="申请日期")
    
    # 流程信息
    current_node_id = fields.IntField(null=True, description="当前节点ID（关联ApprovalNode）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待审批", description="状态（待审批、审批中、已通过、已拒绝、已撤回、已取消）")
    
    def __str__(self):
        return f"{self.instance_no} - {self.applicant_name}"


class ApprovalNode(BaseModel):
    """
    审批节点模型
    
    用于管理审批节点，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        node_no: 节点编号（组织内唯一）
        instance_id: 实例ID（关联ApprovalInstance）
        node_name: 节点名称
        node_type: 节点类型（开始、审批、会签、或签、结束）
        approver_id: 审批人ID（关联master-data）
        approver_name: 审批人姓名
        approval_date: 审批日期
        approval_result: 审批结果（通过、拒绝、转交）
        approval_comment: 审批意见
        status: 状态（待审批、审批中、已通过、已拒绝、已转交）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaioa_approval_nodes"
        indexes = [
            ("tenant_id",),
            ("node_no",),
            ("uuid",),
            ("instance_id",),
            ("node_type",),
            ("approver_id",),
            ("approval_date",),
            ("approval_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "node_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    node_no = fields.CharField(max_length=50, description="节点编号（组织内唯一）")
    instance_id = fields.IntField(description="实例ID（关联ApprovalInstance）")
    node_name = fields.CharField(max_length=200, description="节点名称")
    node_type = fields.CharField(max_length=50, description="节点类型（开始、审批、会签、或签、结束）")
    
    # 审批人信息
    approver_id = fields.IntField(null=True, description="审批人ID（关联master-data）")
    approver_name = fields.CharField(max_length=100, null=True, description="审批人姓名")
    approval_date = fields.DatetimeField(null=True, description="审批日期")
    approval_result = fields.CharField(max_length=50, null=True, description="审批结果（通过、拒绝、转交）")
    approval_comment = fields.TextField(null=True, description="审批意见")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待审批", description="状态（待审批、审批中、已通过、已拒绝、已转交）")
    
    def __str__(self):
        return f"{self.node_no} - {self.node_name}"

