"""
工厂数据模型模块

定义工厂数据模型（厂区、车间、产线、工位），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Plant(BaseModel):
    """
    厂区模型

    工厂的最高层级组织单位，用于管理多厂区场景。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 厂区编码（组织内唯一）
        name: 厂区名称
        description: 描述
        address: 地址
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_plants"
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
    code = fields.CharField(max_length=50, description="厂区编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="厂区名称")
    description = fields.TextField(null=True, description="描述")
    address = fields.CharField(max_length=500, null=True, description="地址")

    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class Workshop(BaseModel):
    """
    车间模型
    
    工厂的最高层级组织单位，用于管理车间的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 车间编码（组织内唯一）
        name: 车间名称
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
        table = "apps_master_data_workshops"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("plant_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="车间编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="车间名称")
    description = fields.TextField(null=True, description="描述")

    # 关联关系（ForeignKeyField 会自动创建 plant_id 字段）
    plant = fields.ForeignKeyField(
        "models.Plant",
        related_name="workshops",
        null=True,
        description="所属厂区（可选）"
    )

    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class ProductionLine(BaseModel):
    """
    产线模型
    
    车间的子单位，属于某个车间，用于管理产线的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 产线编码（组织内唯一）
        name: 产线名称
        workshop_id: 所属车间ID（外键）
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
        table = "apps_master_data_production_lines"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("workshop_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="产线编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="产线名称")
    description = fields.TextField(null=True, description="描述")
    
    # 关联关系（ForeignKeyField 会自动创建 workshop_id 字段）
    workshop = fields.ForeignKeyField(
        "models.Workshop",
        related_name="production_lines",
        description="所属车间"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class Workstation(BaseModel):
    """
    工位模型
    
    产线的子单位，属于某条产线，用于管理工位的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工位编码（组织内唯一）
        name: 工位名称
        production_line_id: 所属产线ID（外键）
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
        table = "apps_master_data_workstations"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("production_line_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工位编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="工位名称")
    description = fields.TextField(null=True, description="描述")
    
    # 关联关系（ForeignKeyField 会自动创建 production_line_id 字段）
    production_line = fields.ForeignKeyField(
        "models.ProductionLine",
        related_name="workstations",
        description="所属产线"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

