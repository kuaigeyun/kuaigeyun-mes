"""
工艺数据模型模块

定义工艺数据模型（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from tortoise import fields
from tortoise.models import Model
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
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工序编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="工序名称")
    description = fields.TextField(null=True, description="描述")
    
    # 工序类型和跳转规则（核心功能，新增）
    reporting_type = fields.CharField(
        max_length=20,
        default="quantity",
        description="报工类型（quantity:按数量报工, status:按状态报工）"
    )
    allow_jump = fields.BooleanField(
        default=False,
        description="是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 默认生产人员（用户ID列表，JSON格式存储，同组织）
    default_operator_ids = fields.JSONField(null=True, description="默认生产人员（用户ID列表，JSON数组）")
    
    # 绑定不良品项（M2M，通过 OperationDefectType）
    defect_types = fields.ManyToManyField(
        "models.DefectType",
        through="models.OperationDefectType",
        related_name="operations",
        description="允许绑定的不良品项",
    )
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class OperationDefectType(Model):
    """
    工序-不良品项关联（M2M 中间表）
    工序允许绑定的不良品项。表仅含 id、operation_id、defect_type_id。
    """
    class Meta:
        table = "apps_master_data_operation_defect_types"
        unique_together = [("operation_id", "defect_type_id")]

    id = fields.IntField(pk=True)
    operation = fields.ForeignKeyField("models.Operation", on_delete=fields.CASCADE, related_name="operation_defect_type_links")
    defect_type = fields.ForeignKeyField("models.DefectType", on_delete=fields.CASCADE, related_name="operation_defect_type_links")


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
            ("version",),  # 版本索引
            ("code", "version"),  # 编码+版本复合索引，用于查询特定编码的所有版本
            ("parent_route_id",),  # 父工艺路线索引
            ("parent_operation_uuid",),  # 父工序UUID索引
            ("level",),  # 嵌套层级索引
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码+版本组合，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code", "version")]  # 同一租户下，编码+版本唯一
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工艺路线编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="工艺路线名称")
    description = fields.TextField(null=True, description="描述")
    
    # 版本管理（核心功能，新增）
    version = fields.CharField(max_length=20, default="1.0", description="版本号（如：v1.0、v1.1）")
    version_description = fields.TextField(null=True, description="版本说明")
    base_version = fields.CharField(max_length=20, null=True, description="基于版本（从哪个版本创建）")
    effective_date = fields.DatetimeField(null=True, description="生效日期")
    
    # 工序序列（JSON格式存储）
    operation_sequence = fields.JSONField(null=True, description="工序序列（JSON格式，存储工序ID及顺序，支持子工艺路线）")
    
    # 子工艺路线支持（核心功能，新增）
    parent_route = fields.ForeignKeyField(
        "models.ProcessRoute",
        related_name="sub_routes",
        null=True,
        description="父工艺路线（如果此工艺路线是子工艺路线，则指向父工艺路线）"
    )
    parent_operation_uuid = fields.CharField(max_length=100, null=True, description="父工序UUID（此子工艺路线所属的父工序）")
    level = fields.IntField(default=0, description="嵌套层级（0为主工艺路线，1为第一层子工艺路线，最多3层）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name} (v{self.version})"


class ProcessRouteTemplate(BaseModel):
    """
    工艺路线模板模型
    
    用于保存常用工艺路线作为模板，支持快速创建和复用。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 模板编码（组织内唯一）
        name: 模板名称
        category: 模板分类（如：注塑类、组装类、包装类等）
        description: 模板描述
        scope: 适用范围（all_materials:所有物料, all_groups:所有物料分组, specific_groups:特定物料分组）
        scope_groups: 适用范围物料分组列表（JSON格式，当scope为specific_groups时使用）
        process_route_config: 工艺路线配置（JSON格式，包含工序顺序、标准工时、SOP关联、跳转规则等）
        version: 模板版本号
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_process_route_templates"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("category",),
            ("version",),
            ("is_active",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码+版本组合，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code", "version")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="模板编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="模板名称")
    category = fields.CharField(max_length=50, null=True, description="模板分类（如：注塑类、组装类、包装类等）")
    description = fields.TextField(null=True, description="模板描述")
    
    # 适用范围
    scope = fields.CharField(
        max_length=20,
        default="all_materials",
        description="适用范围（all_materials:所有物料, all_groups:所有物料分组, specific_groups:特定物料分组）"
    )
    scope_groups = fields.JSONField(
        null=True,
        description="适用范围物料分组列表（JSON格式，当scope为specific_groups时使用）"
    )
    
    # 工艺路线配置（完整复制工艺路线的所有配置）
    process_route_config = fields.JSONField(
        null=True,
        description="工艺路线配置（JSON格式，包含工序顺序、标准工时、SOP关联、跳转规则等）"
    )
    
    # 版本管理
    version = fields.CharField(max_length=20, default="1.0", description="模板版本号")
    version_description = fields.TextField(null=True, description="版本说明")
    base_version = fields.CharField(max_length=20, null=True, description="基于版本（从哪个版本创建）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name} (v{self.version})"


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
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
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

