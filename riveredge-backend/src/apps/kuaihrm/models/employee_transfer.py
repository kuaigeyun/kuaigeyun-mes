"""
员工异动模型模块

定义员工异动数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class EmployeeOnboarding(BaseModel):
    """
    员工入职模型
    
    用于管理员工入职流程，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        onboarding_no: 入职编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        department_id: 部门ID（关联master-data）
        position_id: 岗位ID（关联master-data）
        onboarding_date: 入职日期
        status: 状态（待申请、待审批、待办理、办理中、已确认、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_employee_onboardings"
        indexes = [
            ("tenant_id",),
            ("onboarding_no",),
            ("uuid",),
            ("employee_id",),
            ("onboarding_date",),
            ("status",),
            ("approval_instance_id",),
        ]
        unique_together = [("tenant_id", "onboarding_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    onboarding_no = fields.CharField(max_length=50, description="入职编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    department_id = fields.IntField(null=True, description="部门ID（关联master-data）")
    position_id = fields.IntField(null=True, description="岗位ID（关联master-data）")
    onboarding_date = fields.DatetimeField(description="入职日期")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待申请", description="状态（待申请、待审批、待办理、办理中、已确认、已取消）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.onboarding_no} - {self.employee_name}"


class EmployeeResignation(BaseModel):
    """
    员工离职模型
    
    用于管理员工离职流程，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        resignation_no: 离职编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        resignation_date: 离职日期
        resignation_reason: 离职原因
        status: 状态（待申请、待审批、待办理、办理中、已交接、已确认、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_employee_resignations"
        indexes = [
            ("tenant_id",),
            ("resignation_no",),
            ("uuid",),
            ("employee_id",),
            ("resignation_date",),
            ("status",),
            ("approval_instance_id",),
        ]
        unique_together = [("tenant_id", "resignation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    resignation_no = fields.CharField(max_length=50, description="离职编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    resignation_date = fields.DatetimeField(description="离职日期")
    resignation_reason = fields.TextField(null=True, description="离职原因")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待申请", description="状态（待申请、待审批、待办理、办理中、已交接、已确认、已取消）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.resignation_no} - {self.employee_name}"


class EmployeeTransfer(BaseModel):
    """
    员工异动模型
    
    用于管理员工异动（调岗、晋升、降职等），支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        transfer_no: 异动编号（组织内唯一）
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        transfer_type: 异动类型（调岗、晋升、降职、其他）
        old_department_id: 原部门ID（关联master-data）
        old_position_id: 原岗位ID（关联master-data）
        new_department_id: 新部门ID（关联master-data）
        new_position_id: 新岗位ID（关联master-data）
        transfer_date: 异动日期
        transfer_reason: 异动原因
        status: 状态（待申请、待审批、待办理、办理中、已确认、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaihrm_employee_transfers"
        indexes = [
            ("tenant_id",),
            ("transfer_no",),
            ("uuid",),
            ("employee_id",),
            ("transfer_date",),
            ("transfer_type",),
            ("status",),
            ("approval_instance_id",),
        ]
        unique_together = [("tenant_id", "transfer_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    transfer_no = fields.CharField(max_length=50, description="异动编号（组织内唯一）")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    transfer_type = fields.CharField(max_length=50, description="异动类型（调岗、晋升、降职、其他）")
    
    # 原部门岗位
    old_department_id = fields.IntField(null=True, description="原部门ID（关联master-data）")
    old_position_id = fields.IntField(null=True, description="原岗位ID（关联master-data）")
    
    # 新部门岗位
    new_department_id = fields.IntField(null=True, description="新部门ID（关联master-data）")
    new_position_id = fields.IntField(null=True, description="新岗位ID（关联master-data）")
    
    # 异动信息
    transfer_date = fields.DatetimeField(description="异动日期")
    transfer_reason = fields.TextField(null=True, description="异动原因")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待申请", description="状态（待申请、待审批、待办理、办理中、已确认、已取消）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.transfer_no} - {self.employee_name} - {self.transfer_type}"

