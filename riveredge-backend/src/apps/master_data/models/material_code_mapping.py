"""
物料编码映射模型模块

定义物料编码映射数据模型，支持外部编码映射到内部编码。
用于解决编码不统一问题，支持一对多映射。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialCodeMapping(BaseModel):
    """
    物料编码映射模型
    
    用于定义物料编码映射关系，支持外部编码映射到内部编码。
    一个内部编码可以对应多个外部编码（一对多映射）。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 映射ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        material_id: 物料ID（外键，关联内部物料）
        internal_code: 内部编码（物料编码）
        external_code: 外部编码（外部系统的编码）
        external_system: 外部系统名称（如：ERP、WMS、MES等）
        description: 描述
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="映射ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    # 关联物料（ForeignKeyField 会自动创建 material_id 字段）
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="code_mappings",
        description="关联物料（内部使用自增ID）"
    )
    
    # 编码信息
    internal_code = fields.CharField(max_length=50, description="内部编码（物料编码）")
    external_code = fields.CharField(max_length=100, description="外部编码（外部系统的编码）")
    external_system = fields.CharField(max_length=50, description="外部系统名称（如：ERP、WMS、MES等）")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_code_mappings"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("internal_code",),
            ("external_code",),
            ("external_system",),
            ("is_active",),
        ]
        # 同一组织、同一外部系统、同一外部编码只能有一条映射记录
        unique_together = [("tenant_id", "external_system", "external_code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.internal_code} <-> {self.external_code} ({self.external_system})"

