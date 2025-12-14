"""
物料数据模型模块

定义物料数据模型（物料分组、物料、BOM），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


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
        table = "seed_master_data_material_groups"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("parent_id",),
        ]
        unique_together = [("tenant_id", "code")]
    
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
        table = "seed_master_data_materials"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("group_id",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="物料编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="物料名称")
    specification = fields.CharField(max_length=500, null=True, description="规格")
    base_unit = fields.CharField(max_length=20, description="基础单位")
    
    # 多单位管理（JSON格式存储）
    units = fields.JSONField(null=True, description="多单位管理（JSON格式，存储单位列表及换算关系）")
    
    # 批号管理
    batch_managed = fields.BooleanField(default=False, description="是否启用批号管理")
    
    # 变体管理
    variant_managed = fields.BooleanField(default=False, description="是否启用变体管理")
    variant_attributes = fields.JSONField(null=True, description="变体属性（JSON格式，如颜色、尺寸等）")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述")
    brand = fields.CharField(max_length=100, null=True, description="品牌")
    model = fields.CharField(max_length=100, null=True, description="型号")
    
    # 关联关系（ForeignKeyField 会自动创建 group_id 字段）
    group = fields.ForeignKeyField(
        "models.MaterialGroup",
        related_name="materials",
        null=True,
        description="物料分组"
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
    
    物料清单，支持替代料管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        material_id: 主物料ID（外键）
        component_id: 子物料ID（外键）
        quantity: 用量
        unit: 单位
        is_alternative: 是否为替代料
        alternative_group_id: 替代料组ID（同一组的替代料互斥）
        priority: 优先级（数字越小优先级越高）
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
        table = "seed_master_data_bom"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("component_id",),
            ("uuid",),
            ("alternative_group_id",),
        ]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="用量")
    unit = fields.CharField(max_length=20, description="单位")
    
    # 替代料管理
    is_alternative = fields.BooleanField(default=False, description="是否为替代料")
    alternative_group_id = fields.IntField(null=True, description="替代料组ID（同一组的替代料互斥）")
    priority = fields.IntField(default=0, description="优先级（数字越小优先级越高）")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述")
    
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
