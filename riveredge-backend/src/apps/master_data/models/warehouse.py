"""
仓库数据模型模块

定义仓库数据模型（仓库、库区、库位），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Warehouse(BaseModel):
    """
    仓库模型
    
    仓库的最高层级组织单位，用于管理仓库的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 仓库编码（组织内唯一）
        name: 仓库名称
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
        table = "apps_master_data_warehouses"
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
    code = fields.CharField(max_length=50, description="仓库编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="仓库名称")
    description = fields.TextField(null=True, description="描述")
    
    # 仓库类型（支持线边仓管理）
    warehouse_type = fields.CharField(
        max_length=20,
        default="normal",
        description="仓库类型（normal=普通仓库, line_side=线边仓, wip=在制品仓）"
    )
    
    # 关联车间（线边仓专用）
    workshop_id = fields.IntField(null=True, description="关联车间ID（线边仓时必填）")
    workshop_name = fields.CharField(max_length=100, null=True, description="关联车间名称")
    
    # 关联工作中心（可选，更精确的线边仓关联）
    work_center_id = fields.IntField(null=True, description="关联工作中心ID")
    work_center_name = fields.CharField(max_length=100, null=True, description="关联工作中心名称")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class StorageArea(BaseModel):
    """
    库区模型
    
    仓库的子单位，属于某个仓库，用于管理库区的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 库区编码（组织内唯一）
        name: 库区名称
        warehouse_id: 所属仓库ID（外键）
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
        table = "apps_master_data_storage_areas"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("warehouse_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="库区编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="库区名称")
    description = fields.TextField(null=True, description="描述")
    
    # 关联关系（ForeignKeyField 会自动创建 warehouse_id 字段）
    warehouse = fields.ForeignKeyField(
        "models.Warehouse",
        related_name="storage_areas",
        description="所属仓库"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class StorageLocation(BaseModel):
    """
    库位模型
    
    库区的子单位，属于某个库区，用于管理库位的层级结构。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 库位编码（组织内唯一）
        name: 库位名称
        storage_area_id: 所属库区ID（外键）
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
        table = "apps_master_data_storage_locations"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("storage_area_id",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="库位编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="库位名称")
    description = fields.TextField(null=True, description="描述")
    
    # 关联关系（ForeignKeyField 会自动创建 storage_area_id 字段）
    storage_area = fields.ForeignKeyField(
        "models.StorageArea",
        related_name="storage_locations",
        description="所属库区"
    )
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

