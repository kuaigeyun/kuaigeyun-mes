"""
项目管理模型模块

定义项目管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Project(BaseModel):
    """
    项目主表模型
    
    用于管理项目基本信息，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        project_no: 项目编号（组织内唯一）
        project_name: 项目名称
        project_type: 项目类型（研发项目、生产项目、客户项目等）
        project_category: 项目分类
        manager_id: 项目经理ID（关联master-data）
        manager_name: 项目经理姓名
        department_id: 负责部门ID（关联master-data）
        start_date: 计划开始日期
        end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        budget_amount: 预算金额
        actual_amount: 实际金额
        progress: 项目进度（百分比，0-100）
        status: 状态（草稿、待审批、已审批、进行中、已暂停、已完成、已取消）
        priority: 优先级（低、中、高、紧急）
        description: 项目描述
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
        table = "apps_kuaipm_projects"
        indexes = [
            ("tenant_id",),
            ("project_no",),
            ("uuid",),
            ("project_type",),
            ("manager_id",),
            ("department_id",),
            ("status",),
            ("priority",),
        ]
        unique_together = [("tenant_id", "project_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    project_no = fields.CharField(max_length=50, description="项目编号（组织内唯一）")
    project_name = fields.CharField(max_length=200, description="项目名称")
    project_type = fields.CharField(max_length=50, description="项目类型（研发项目、生产项目、客户项目等）")
    project_category = fields.CharField(max_length=50, null=True, description="项目分类")
    
    # 项目负责人
    manager_id = fields.IntField(description="项目经理ID（关联master-data）")
    manager_name = fields.CharField(max_length=100, description="项目经理姓名")
    department_id = fields.IntField(null=True, description="负责部门ID（关联master-data）")
    
    # 时间信息
    start_date = fields.DatetimeField(null=True, description="计划开始日期")
    end_date = fields.DatetimeField(null=True, description="计划结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    
    # 金额信息
    budget_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="预算金额")
    actual_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, default=Decimal("0.00"), description="实际金额")
    
    # 进度和状态
    progress = fields.IntField(default=0, description="项目进度（百分比，0-100）")
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、待审批、已审批、进行中、已暂停、已完成、已取消）")
    priority = fields.CharField(max_length=50, default="中", description="优先级（低、中、高、紧急）")
    
    # 描述信息
    description = fields.TextField(null=True, description="项目描述")
    
    # 审批信息
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=50, null=True, description="审批状态")
    
    def __str__(self):
        return f"{self.project_no} - {self.project_name}"


class ProjectApplication(BaseModel):
    """
    项目申请模型
    
    用于管理项目申请，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        application_no: 申请编号（组织内唯一）
        project_id: 项目ID（关联Project）
        applicant_id: 申请人ID（关联master-data）
        applicant_name: 申请人姓名
        application_date: 申请日期
        application_reason: 申请原因
        expected_start_date: 预期开始日期
        expected_end_date: 预期结束日期
        expected_budget: 预期预算
        status: 状态（待审批、已通过、已拒绝、已取消）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        approval_comment: 审批意见
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_applications"
        indexes = [
            ("tenant_id",),
            ("application_no",),
            ("uuid",),
            ("project_id",),
            ("applicant_id",),
            ("application_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "application_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    application_no = fields.CharField(max_length=50, description="申请编号（组织内唯一）")
    project_id = fields.IntField(null=True, description="项目ID（关联Project）")
    
    # 申请人信息
    applicant_id = fields.IntField(description="申请人ID（关联master-data）")
    applicant_name = fields.CharField(max_length=100, description="申请人姓名")
    application_date = fields.DatetimeField(description="申请日期")
    
    # 申请内容
    application_reason = fields.TextField(description="申请原因")
    expected_start_date = fields.DatetimeField(null=True, description="预期开始日期")
    expected_end_date = fields.DatetimeField(null=True, description="预期结束日期")
    expected_budget = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="预期预算")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待审批", description="状态（待审批、已通过、已拒绝、已取消）")
    
    # 审批信息
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=50, null=True, description="审批状态")
    approval_comment = fields.TextField(null=True, description="审批意见")
    
    def __str__(self):
        return f"{self.application_no} - {self.applicant_name}"


class ProjectWBS(BaseModel):
    """
    项目WBS分解模型
    
    用于管理项目WBS分解，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        wbs_code: WBS编码（组织内唯一）
        project_id: 项目ID（关联Project）
        parent_id: 父节点ID（关联ProjectWBS，支持树形结构）
        wbs_name: WBS名称
        wbs_level: WBS层级（1、2、3等）
        wbs_path: WBS路径（如：1.1.1）
        description: 描述
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        planned_duration: 计划工期（天）
        planned_cost: 计划成本
        weight: 权重（百分比，用于计算项目进度）
        status: 状态（未开始、进行中、已完成、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_wbs"
        indexes = [
            ("tenant_id",),
            ("wbs_code",),
            ("uuid",),
            ("project_id",),
            ("parent_id",),
            ("wbs_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "wbs_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    wbs_code = fields.CharField(max_length=50, description="WBS编码（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    parent_id = fields.IntField(null=True, description="父节点ID（关联ProjectWBS，支持树形结构）")
    
    # WBS信息
    wbs_name = fields.CharField(max_length=200, description="WBS名称")
    wbs_level = fields.IntField(description="WBS层级（1、2、3等）")
    wbs_path = fields.CharField(max_length=200, null=True, description="WBS路径（如：1.1.1）")
    description = fields.TextField(null=True, description="描述")
    
    # 计划信息
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    planned_duration = fields.IntField(null=True, description="计划工期（天）")
    planned_cost = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="计划成本")
    weight = fields.DecimalField(max_digits=5, decimal_places=2, null=True, default=Decimal("0.00"), description="权重（百分比，用于计算项目进度）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="未开始", description="状态（未开始、进行中、已完成、已取消）")
    
    def __str__(self):
        return f"{self.wbs_code} - {self.wbs_name}"


class ProjectTask(BaseModel):
    """
    项目任务模型
    
    用于管理项目任务，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        task_no: 任务编号（组织内唯一）
        project_id: 项目ID（关联Project）
        wbs_id: WBS ID（关联ProjectWBS）
        parent_id: 父任务ID（关联ProjectTask，支持子任务）
        task_name: 任务名称
        task_type: 任务类型（设计、开发、测试、部署等）
        assignee_id: 负责人ID（关联master-data）
        assignee_name: 负责人姓名
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        planned_hours: 计划工时（小时）
        actual_hours: 实际工时（小时）
        progress: 任务进度（百分比，0-100）
        status: 状态（待分配、进行中、已完成、已取消、已暂停）
        priority: 优先级（低、中、高、紧急）
        description: 任务描述
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_tasks"
        indexes = [
            ("tenant_id",),
            ("task_no",),
            ("uuid",),
            ("project_id",),
            ("wbs_id",),
            ("parent_id",),
            ("assignee_id",),
            ("status",),
            ("priority",),
        ]
        unique_together = [("tenant_id", "task_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    task_no = fields.CharField(max_length=50, description="任务编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    wbs_id = fields.IntField(null=True, description="WBS ID（关联ProjectWBS）")
    parent_id = fields.IntField(null=True, description="父任务ID（关联ProjectTask，支持子任务）")
    
    # 任务信息
    task_name = fields.CharField(max_length=200, description="任务名称")
    task_type = fields.CharField(max_length=50, null=True, description="任务类型（设计、开发、测试、部署等）")
    
    # 负责人信息
    assignee_id = fields.IntField(null=True, description="负责人ID（关联master-data）")
    assignee_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 时间信息
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    
    # 工时信息
    planned_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划工时（小时）")
    actual_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True, default=Decimal("0.00"), description="实际工时（小时）")
    
    # 进度和状态
    progress = fields.IntField(default=0, description="任务进度（百分比，0-100）")
    status = fields.CharField(max_length=50, default="待分配", description="状态（待分配、进行中、已完成、已取消、已暂停）")
    priority = fields.CharField(max_length=50, default="中", description="优先级（低、中、高、紧急）")
    
    # 描述信息
    description = fields.TextField(null=True, description="任务描述")
    
    def __str__(self):
        return f"{self.task_no} - {self.task_name}"


class ProjectResource(BaseModel):
    """
    项目资源模型
    
    用于管理项目资源分配，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        resource_no: 资源编号（组织内唯一）
        project_id: 项目ID（关联Project）
        task_id: 任务ID（关联ProjectTask）
        resource_type: 资源类型（人员、设备、物料、资金等）
        resource_id: 资源ID（关联master-data，根据resource_type关联不同表）
        resource_name: 资源名称
        planned_quantity: 计划数量
        actual_quantity: 实际数量
        planned_cost: 计划成本
        actual_cost: 实际成本
        start_date: 开始日期
        end_date: 结束日期
        status: 状态（计划中、已分配、使用中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_resources"
        indexes = [
            ("tenant_id",),
            ("resource_no",),
            ("uuid",),
            ("project_id",),
            ("task_id",),
            ("resource_type",),
            ("resource_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "resource_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    resource_no = fields.CharField(max_length=50, description="资源编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    task_id = fields.IntField(null=True, description="任务ID（关联ProjectTask）")
    
    # 资源信息
    resource_type = fields.CharField(max_length=50, description="资源类型（人员、设备、物料、资金等）")
    resource_id = fields.IntField(description="资源ID（关联master-data，根据resource_type关联不同表）")
    resource_name = fields.CharField(max_length=200, description="资源名称")
    
    # 数量信息
    planned_quantity = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="计划数量")
    actual_quantity = fields.DecimalField(max_digits=10, decimal_places=2, null=True, default=Decimal("0.00"), description="实际数量")
    
    # 成本信息
    planned_cost = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="计划成本")
    actual_cost = fields.DecimalField(max_digits=18, decimal_places=2, null=True, default=Decimal("0.00"), description="实际成本")
    
    # 时间信息
    start_date = fields.DatetimeField(null=True, description="开始日期")
    end_date = fields.DatetimeField(null=True, description="结束日期")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="计划中", description="状态（计划中、已分配、使用中、已完成、已取消）")
    remark = fields.TextField(null=True, description="备注")
    
    def __str__(self):
        return f"{self.resource_no} - {self.resource_name}"


class ProjectProgress(BaseModel):
    """
    项目进度模型
    
    用于管理项目进度跟踪，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        progress_no: 进度编号（组织内唯一）
        project_id: 项目ID（关联Project）
        task_id: 任务ID（关联ProjectTask）
        progress_date: 进度日期
        progress_percentage: 进度百分比（0-100）
        completed_work: 已完成工作量
        remaining_work: 剩余工作量
        progress_description: 进度描述
        reporter_id: 汇报人ID（关联master-data）
        reporter_name: 汇报人姓名
        status: 状态（正常、延迟、提前、异常）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_progresses"
        indexes = [
            ("tenant_id",),
            ("progress_no",),
            ("uuid",),
            ("project_id",),
            ("task_id",),
            ("progress_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "progress_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    progress_no = fields.CharField(max_length=50, description="进度编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    task_id = fields.IntField(null=True, description="任务ID（关联ProjectTask）")
    
    # 进度信息
    progress_date = fields.DatetimeField(description="进度日期")
    progress_percentage = fields.IntField(description="进度百分比（0-100）")
    completed_work = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="已完成工作量")
    remaining_work = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="剩余工作量")
    progress_description = fields.TextField(null=True, description="进度描述")
    
    # 汇报人信息
    reporter_id = fields.IntField(description="汇报人ID（关联master-data）")
    reporter_name = fields.CharField(max_length=100, description="汇报人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="状态（正常、延迟、提前、异常）")
    
    def __str__(self):
        return f"{self.progress_no} - {self.progress_date}"


class ProjectCost(BaseModel):
    """
    项目成本模型
    
    用于管理项目成本跟踪，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        cost_no: 成本编号（组织内唯一）
        project_id: 项目ID（关联Project）
        task_id: 任务ID（关联ProjectTask）
        cost_type: 成本类型（人工成本、材料成本、设备成本、其他成本等）
        cost_date: 成本发生日期
        cost_amount: 成本金额
        cost_description: 成本描述
        cost_category: 成本分类
        status: 状态（待确认、已确认、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_costs"
        indexes = [
            ("tenant_id",),
            ("cost_no",),
            ("uuid",),
            ("project_id",),
            ("task_id",),
            ("cost_type",),
            ("cost_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "cost_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    cost_no = fields.CharField(max_length=50, description="成本编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    task_id = fields.IntField(null=True, description="任务ID（关联ProjectTask）")
    
    # 成本信息
    cost_type = fields.CharField(max_length=50, description="成本类型（人工成本、材料成本、设备成本、其他成本等）")
    cost_date = fields.DatetimeField(description="成本发生日期")
    cost_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="成本金额")
    cost_description = fields.TextField(null=True, description="成本描述")
    cost_category = fields.CharField(max_length=50, null=True, description="成本分类")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待确认", description="状态（待确认、已确认、已取消）")
    
    def __str__(self):
        return f"{self.cost_no} - {self.cost_amount}"


class ProjectRisk(BaseModel):
    """
    项目风险模型
    
    用于管理项目风险监控，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        risk_no: 风险编号（组织内唯一）
        project_id: 项目ID（关联Project）
        risk_name: 风险名称
        risk_type: 风险类型（技术风险、进度风险、成本风险、质量风险、资源风险等）
        risk_level: 风险等级（低、中、高、极高）
        probability: 发生概率（百分比，0-100）
        impact: 影响程度（低、中、高、极高）
        risk_description: 风险描述
        risk_source: 风险来源
        identified_by: 识别人ID（关联master-data）
        identified_date: 识别日期
        mitigation_plan: 应对措施
        owner_id: 负责人ID（关联master-data）
        owner_name: 负责人姓名
        status: 状态（已识别、应对中、已解决、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_risks"
        indexes = [
            ("tenant_id",),
            ("risk_no",),
            ("uuid",),
            ("project_id",),
            ("risk_type",),
            ("risk_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "risk_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    risk_no = fields.CharField(max_length=50, description="风险编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    
    # 风险信息
    risk_name = fields.CharField(max_length=200, description="风险名称")
    risk_type = fields.CharField(max_length=50, description="风险类型（技术风险、进度风险、成本风险、质量风险、资源风险等）")
    risk_level = fields.CharField(max_length=50, description="风险等级（低、中、高、极高）")
    probability = fields.IntField(null=True, description="发生概率（百分比，0-100）")
    impact = fields.CharField(max_length=50, null=True, description="影响程度（低、中、高、极高）")
    risk_description = fields.TextField(null=True, description="风险描述")
    risk_source = fields.CharField(max_length=200, null=True, description="风险来源")
    
    # 识别信息
    identified_by = fields.IntField(description="识别人ID（关联master-data）")
    identified_date = fields.DatetimeField(description="识别日期")
    
    # 应对信息
    mitigation_plan = fields.TextField(null=True, description="应对措施")
    owner_id = fields.IntField(null=True, description="负责人ID（关联master-data）")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已识别", description="状态（已识别、应对中、已解决、已关闭）")
    
    def __str__(self):
        return f"{self.risk_no} - {self.risk_name}"


class ProjectQuality(BaseModel):
    """
    项目质量模型
    
    用于管理项目质量监控，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        quality_no: 质量编号（组织内唯一）
        project_id: 项目ID（关联Project）
        task_id: 任务ID（关联ProjectTask）
        quality_type: 质量类型（质量检查、质量评审、质量测试等）
        quality_date: 质量日期
        quality_standard: 质量标准
        quality_result: 质量结果（合格、不合格、待整改）
        quality_score: 质量评分（0-100）
        quality_description: 质量描述
        inspector_id: 检查人ID（关联master-data）
        inspector_name: 检查人姓名
        issue_count: 问题数量
        resolved_count: 已解决问题数量
        status: 状态（待检查、检查中、已通过、待整改、已整改）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipm_project_qualities"
        indexes = [
            ("tenant_id",),
            ("quality_no",),
            ("uuid",),
            ("project_id",),
            ("task_id",),
            ("quality_type",),
            ("quality_date",),
            ("quality_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "quality_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    quality_no = fields.CharField(max_length=50, description="质量编号（组织内唯一）")
    project_id = fields.IntField(description="项目ID（关联Project）")
    task_id = fields.IntField(null=True, description="任务ID（关联ProjectTask）")
    
    # 质量信息
    quality_type = fields.CharField(max_length=50, description="质量类型（质量检查、质量评审、质量测试等）")
    quality_date = fields.DatetimeField(description="质量日期")
    quality_standard = fields.CharField(max_length=200, null=True, description="质量标准")
    quality_result = fields.CharField(max_length=50, null=True, description="质量结果（合格、不合格、待整改）")
    quality_score = fields.IntField(null=True, description="质量评分（0-100）")
    quality_description = fields.TextField(null=True, description="质量描述")
    
    # 检查人信息
    inspector_id = fields.IntField(description="检查人ID（关联master-data）")
    inspector_name = fields.CharField(max_length=100, description="检查人姓名")
    
    # 问题统计
    issue_count = fields.IntField(default=0, description="问题数量")
    resolved_count = fields.IntField(default=0, description="已解决问题数量")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待检查", description="状态（待检查、检查中、已通过、待整改、已整改）")
    
    def __str__(self):
        return f"{self.quality_no} - {self.quality_result}"

