"""
工艺数据模型模块

定义工艺数据模型（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class DefectType(BaseModel):
    """
    不良品模型
    
    不良品类型信息，用于管理生产过程中的不良品分类。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 不良品编码（组织内唯一）
        name: 不良品名称
        category: 分类
        description: 描述
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_defect_types"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("category",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="不良品编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="不良品名称")
    category = fields.CharField(max_length=50, null=True, description="分类")
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class SOPExecution(BaseModel):
    """
    SOP 执行实例模型
    
    用于定义和管理组织内的 SOP 执行实例，每个实例对应一个 SOP 的执行。
    支持多组织隔离，每个组织的执行实例相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_sop_executions"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("sop_id",),
            ("status",),
            ("executor_id",),
            ("current_node_id",),
            ("inngest_run_id",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "status"),  # 按组织+状态查询
            ("tenant_id", "executor_id", "status"),  # 按组织+执行人+状态查询（我的任务）
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="执行实例ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 关联 SOP
    sop = fields.ForeignKeyField(
        "models.SOP",
        related_name="executions",
        description="关联SOP（外键）"
    )
    
    # 执行基本信息
    title = fields.CharField(max_length=200, description="执行标题")
    description = fields.TextField(null=True, description="执行描述")
    
    # 执行状态
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="执行状态（pending、running、completed、paused、cancelled）"
    )
    
    # 当前节点
    current_node_id = fields.CharField(max_length=100, null=True, description="当前节点ID")
    
    # 节点执行数据（存储每个节点的表单填写数据）
    node_data = fields.JSONField(
        null=True,
        description="节点执行数据（JSON格式，格式：{nodeId: {formData: {...}, completedAt: '...'}}）"
    )
    
    # Inngest 关联
    inngest_run_id = fields.CharField(
        max_length=100,
        null=True,
        description="Inngest 运行ID（关联 Inngest 工作流实例）"
    )
    
    # 执行信息
    executor_id = fields.IntField(description="执行人ID")
    started_at = fields.DatetimeField(description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.title} ({self.status})"


class Operation(BaseModel):
    """
    工序模型
    
    生产工序信息，用于管理生产过程中的各个工序。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工序编码（组织内唯一）
        name: 工序名称
        description: 描述
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_operations"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工序编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="工序名称")
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class SOPExecution(BaseModel):
    """
    SOP 执行实例模型
    
    用于定义和管理组织内的 SOP 执行实例，每个实例对应一个 SOP 的执行。
    支持多组织隔离，每个组织的执行实例相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_sop_executions"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("sop_id",),
            ("status",),
            ("executor_id",),
            ("current_node_id",),
            ("inngest_run_id",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "status"),  # 按组织+状态查询
            ("tenant_id", "executor_id", "status"),  # 按组织+执行人+状态查询（我的任务）
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="执行实例ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 关联 SOP
    sop = fields.ForeignKeyField(
        "models.SOP",
        related_name="executions",
        description="关联SOP（外键）"
    )
    
    # 执行基本信息
    title = fields.CharField(max_length=200, description="执行标题")
    description = fields.TextField(null=True, description="执行描述")
    
    # 执行状态
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="执行状态（pending、running、completed、paused、cancelled）"
    )
    
    # 当前节点
    current_node_id = fields.CharField(max_length=100, null=True, description="当前节点ID")
    
    # 节点执行数据（存储每个节点的表单填写数据）
    node_data = fields.JSONField(
        null=True,
        description="节点执行数据（JSON格式，格式：{nodeId: {formData: {...}, completedAt: '...'}}）"
    )
    
    # Inngest 关联
    inngest_run_id = fields.CharField(
        max_length=100,
        null=True,
        description="Inngest 运行ID（关联 Inngest 工作流实例）"
    )
    
    # 执行信息
    executor_id = fields.IntField(description="执行人ID")
    started_at = fields.DatetimeField(description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.title} ({self.status})"


class ProcessRoute(BaseModel):
    """
    工艺路线模型
    
    工序序列组合，用于定义生产过程中的工序顺序。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工艺路线编码（组织内唯一）
        name: 工艺路线名称
        description: 描述
        operation_sequence: 工序序列（JSON格式存储）
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_process_routes"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工艺路线编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="工艺路线名称")
    description = fields.TextField(null=True, description="描述")
    
    # 工序序列（JSON格式存储）
    operation_sequence = fields.JSONField(null=True, description="工序序列（JSON格式，存储工序ID及顺序）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class SOPExecution(BaseModel):
    """
    SOP 执行实例模型
    
    用于定义和管理组织内的 SOP 执行实例，每个实例对应一个 SOP 的执行。
    支持多组织隔离，每个组织的执行实例相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_sop_executions"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("sop_id",),
            ("status",),
            ("executor_id",),
            ("current_node_id",),
            ("inngest_run_id",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "status"),  # 按组织+状态查询
            ("tenant_id", "executor_id", "status"),  # 按组织+执行人+状态查询（我的任务）
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="执行实例ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 关联 SOP
    sop = fields.ForeignKeyField(
        "models.SOP",
        related_name="executions",
        description="关联SOP（外键）"
    )
    
    # 执行基本信息
    title = fields.CharField(max_length=200, description="执行标题")
    description = fields.TextField(null=True, description="执行描述")
    
    # 执行状态
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="执行状态（pending、running、completed、paused、cancelled）"
    )
    
    # 当前节点
    current_node_id = fields.CharField(max_length=100, null=True, description="当前节点ID")
    
    # 节点执行数据（存储每个节点的表单填写数据）
    node_data = fields.JSONField(
        null=True,
        description="节点执行数据（JSON格式，格式：{nodeId: {formData: {...}, completedAt: '...'}}）"
    )
    
    # Inngest 关联
    inngest_run_id = fields.CharField(
        max_length=100,
        null=True,
        description="Inngest 运行ID（关联 Inngest 工作流实例）"
    )
    
    # 执行信息
    executor_id = fields.IntField(description="执行人ID")
    started_at = fields.DatetimeField(description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.title} ({self.status})"


class SOP(BaseModel):
    """
    标准作业程序（SOP）模型
    
    标准作业程序，用于管理生产过程中的作业指导书。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: SOP编码（组织内唯一）
        name: SOP名称
        operation_id: 关联工序ID（外键，可选）
        version: 版本号
        content: SOP内容（支持富文本）
        attachments: 附件列表（JSON格式存储）
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_sop"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("operation_id",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="SOP编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="SOP名称")
    version = fields.CharField(max_length=20, null=True, description="版本号")
    
    # 内容信息
    content = fields.TextField(null=True, description="SOP内容（支持富文本）")
    attachments = fields.JSONField(null=True, description="附件列表（JSON格式，存储附件信息）")
    
    # eSOP 流程配置（ProFlow）
    flow_config = fields.JSONField(null=True, description="流程配置（ProFlow JSON格式，包含 nodes 和 edges）")
    
    # eSOP 表单配置（Formily）
    form_config = fields.JSONField(null=True, description="表单配置（Formily Schema格式，每个步骤的表单定义）")
    
    # 关联关系（ForeignKeyField 会自动创建 operation_id 字段）
    operation = fields.ForeignKeyField(
        "models.Operation",
        related_name="sops",
        null=True,
        description="关联工序"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class SOPExecution(BaseModel):
    """
    SOP 执行实例模型
    
    用于定义和管理组织内的 SOP 执行实例，每个实例对应一个 SOP 的执行。
    支持多组织隔离，每个组织的执行实例相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_sop_executions"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("sop_id",),
            ("status",),
            ("executor_id",),
            ("current_node_id",),
            ("inngest_run_id",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "status"),  # 按组织+状态查询
            ("tenant_id", "executor_id", "status"),  # 按组织+执行人+状态查询（我的任务）
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="执行实例ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 关联 SOP
    sop = fields.ForeignKeyField(
        "models.SOP",
        related_name="executions",
        description="关联SOP（外键）"
    )
    
    # 执行基本信息
    title = fields.CharField(max_length=200, description="执行标题")
    description = fields.TextField(null=True, description="执行描述")
    
    # 执行状态
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="执行状态（pending、running、completed、paused、cancelled）"
    )
    
    # 当前节点
    current_node_id = fields.CharField(max_length=100, null=True, description="当前节点ID")
    
    # 节点执行数据（存储每个节点的表单填写数据）
    node_data = fields.JSONField(
        null=True,
        description="节点执行数据（JSON格式，格式：{nodeId: {formData: {...}, completedAt: '...'}}）"
    )
    
    # Inngest 关联
    inngest_run_id = fields.CharField(
        max_length=100,
        null=True,
        description="Inngest 运行ID（关联 Inngest 工作流实例）"
    )
    
    # 执行信息
    executor_id = fields.IntField(description="执行人ID")
    started_at = fields.DatetimeField(description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.title} ({self.status})"

