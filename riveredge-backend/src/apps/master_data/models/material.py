"""
物料数据模型模块

定义物料数据模型（物料分组、物料、BOM），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel

# 注意：ProcessRoute 在 process.py 中定义，使用字符串引用避免循环导入


class MaterialGroup(BaseModel):
    """
    物料分组模型
    
    物料的分类组织，支持层级结构（通过 parent_id 实现）。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 分组编码（组织内唯一）
        name: 分组名称
        parent_id: 父分组ID（可选，用于层级结构）
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
        table = "apps_master_data_material_groups"
        table_description = "基础数据管理 - 物料组"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("parent_id",),
            ("process_route_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="分组编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="分组名称")
    description = fields.TextField(null=True, description="描述")
    
    # 关联关系（ForeignKeyField 会自动创建 parent_id 字段）
    parent = fields.ForeignKeyField(
        "models.MaterialGroup",
        related_name="children",
        null=True,
        description="父分组（用于层级结构）"
    )
    
    # 工艺路线绑定（物料分组级别，优先级低于物料绑定）
    process_route = fields.ForeignKeyField(
        "models.ProcessRoute",
        related_name="material_groups",
        null=True,
        description="绑定的工艺路线（分组级别，物料未绑定时使用）"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class Material(BaseModel):
    """
    物料模型
    
    物料基础信息，支持多单位、批号、变体管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 物料编码（组织内唯一）
        name: 物料名称
        group_id: 物料分组ID（外键，可选）
        specification: 规格
        base_unit: 基础单位
        units: 多单位管理（JSON格式存储）
        batch_managed: 是否启用批号管理
        variant_managed: 是否启用变体管理
        variant_attributes: 变体属性（JSON格式存储）
        description: 描述
        brand: 品牌
        model: 型号
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_materials"
        table_description = "基础数据管理 - 物料"
        indexes = [
            ("tenant_id",),
            ("main_code",),
            ("code",),  # 保留用于向后兼容
            ("uuid",),
            ("group_id",),
            ("process_route_id",),
            ("material_type",),
            ("source_type",),  # 物料来源类型索引（核心功能，新增）
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "main_code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    main_code = fields.CharField(max_length=50, description="主编码（系统内部唯一标识，格式：MAT-{类型}-{序号}）")
    name = fields.CharField(max_length=200, description="物料名称")
    material_type = fields.CharField(max_length=20, null=True, description="物料类型（FIN/SEMI/RAW/PACK/AUX）")
    specification = fields.CharField(max_length=500, null=True, description="规格")
    base_unit = fields.CharField(max_length=20, description="基础单位")
    
    # 兼容字段：保留code字段作为main_code的别名（向后兼容）
    code = fields.CharField(max_length=50, null=True, description="物料编码（已废弃，使用main_code，保留用于向后兼容）")
    
    # 多单位管理（JSON格式存储）
    units = fields.JSONField(null=True, description="多单位管理（JSON格式，存储单位列表及换算关系）")
    
    # 批号管理
    batch_managed = fields.BooleanField(default=False, description="是否启用批号管理")
    
    # 变体管理
    variant_managed = fields.BooleanField(default=False, description="是否启用变体管理")
    variant_attributes = fields.JSONField(null=True, description="变体属性（JSON格式，如颜色、尺寸等）")
    
    # 物料来源控制（核心功能，新增）
    source_type = fields.CharField(
        max_length=20, 
        null=True, 
        description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）：Make(自制件)、Buy(采购件)、Phantom(虚拟件)、Outsource(委外件)、Configure(配置件)"
    )
    source_config = fields.JSONField(
        null=True, 
        description="物料来源相关配置（JSON格式），包含：BOM、工艺路线、供应商、委外供应商、委外工序、变体属性等"
    )
    
    # 默认值设置（JSON格式存储）
    defaults = fields.JSONField(null=True, description="默认值设置（JSON格式），包含财务、采购、销售、库存、生产的默认值")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述")
    brand = fields.CharField(max_length=100, null=True, description="品牌")
    model = fields.CharField(max_length=100, null=True, description="型号")
    images = fields.JSONField(null=True, description="产品图片列表")
    
    # 关联关系（ForeignKeyField 会自动创建 group_id 字段）
    group = fields.ForeignKeyField(
        "models.MaterialGroup",
        related_name="materials",
        null=True,
        description="物料分组"
    )
    
    # 工艺路线绑定（物料优先级大于物料分组）
    process_route = fields.ForeignKeyField(
        "models.ProcessRoute",
        related_name="materials",
        null=True,
        description="绑定的工艺路线（物料级别，优先级最高）"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class BOM(BaseModel):
    """
    物料清单（BOM）模型
    
    物料清单，支持替代料管理、版本管理、多层级结构、损耗率计算。
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        material_id: 主物料ID（外键，父件）
        component_id: 子物料ID（外键，子件）
        quantity: 用量（必填，数字）
        unit: 单位（可选，如：个、kg、m等）
        waste_rate: 损耗率（可选，百分比，如：5%，用于计算实际用料数量）
        is_required: 是否必选（可选，是/否，默认：是）
        level: 层级深度（0为顶层，用于多层级BOM展开）
        path: 层级路径（如：1/2/3，用于快速查询和排序）
        is_alternative: 是否为替代料
        alternative_group_id: 替代料组ID（同一组的替代料互斥）
        priority: 优先级（数字越小优先级越高）
        description: 描述
        remark: 备注
        version: BOM版本号
        bom_code: BOM编码（升版时随版本更新，如 BOM-XXX-1.0 -> BOM-XXX-1.1）
        effective_date: 生效日期
        expiry_date: 失效日期
        approval_status: 审核状态
        approved_by: 审核人ID
        approved_at: 审核时间
        approval_comment: 审核意见
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_bom"
        table_description = "基础数据管理 - BOM"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("component_id",),
            ("uuid",),
            ("alternative_group_id",),
            ("bom_code",),
            ("version",),
            ("approval_status",),
            ("level",),  # 用于层级查询
            ("path",),  # 用于路径查询
            ("material_id", "version"),  # 用于查询特定物料的特定版本BOM
        ]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="用量（必填，数字）")
    unit = fields.CharField(max_length=20, null=True, description="单位（可选，如：个、kg、m等）")
    
    # 损耗率和必选标识（根据优化设计规范新增）
    waste_rate = fields.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00, 
        description="损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）"
    )
    is_required = fields.BooleanField(default=True, description="是否必选（是/否，默认：是）")
    
    # 层级信息（用于多层级BOM展开，根据优化设计规范新增）
    level = fields.IntField(default=0, description="层级深度（0为顶层，用于多层级BOM展开）")
    path = fields.CharField(max_length=500, null=True, description="层级路径（如：1/2/3，用于快速查询和排序）")
    
    # 版本控制
    version = fields.CharField(max_length=50, default="1.0", description="BOM版本号")
    bom_code = fields.CharField(max_length=100, null=True, description="BOM编码（升版时随版本更新）")
    is_default = fields.BooleanField(default=False, description="是否为默认版本（每个物料至多一个默认版本）")
    
    # 有效期管理
    effective_date = fields.DatetimeField(null=True, description="生效日期")
    expiry_date = fields.DatetimeField(null=True, description="失效日期")
    
    # 审核管理
    approval_status = fields.CharField(
        max_length=20,
        default="draft",
        description="审核状态：draft(草稿), pending(待审核), approved(已审核), rejected(已拒绝)"
    )
    approved_by = fields.IntField(null=True, description="审核人ID")
    approved_at = fields.DatetimeField(null=True, description="审核时间")
    approval_comment = fields.TextField(null=True, description="审核意见")
    
    # 替代料管理
    is_alternative = fields.BooleanField(default=False, description="是否为替代料")
    alternative_group_id = fields.IntField(null=True, description="替代料组ID（同一组的替代料互斥）")
    priority = fields.IntField(default=0, description="优先级（数字越小优先级越高）")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述")
    remark = fields.TextField(null=True, description="备注")
    
    # 关联关系（ForeignKeyField 会自动创建 material_id 和 component_id 字段）
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="bom_items",
        description="主物料"
    )
    
    component = fields.ForeignKeyField(
        "models.Material",
        related_name="used_in_bom",
        description="子物料"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"BOM: {self.material_id} -> {self.component_id} ({self.quantity} {self.unit})"
