"""
产品模型模块

定义产品数据模型。
"""

from tortoise import fields
from core.models.base import BaseModel


class Product(BaseModel):
    """
    产品模型
    
    用于管理产品基础数据，支持多组织隔离。
    包含 BOM（Bill of Materials）管理功能。
    
    Attributes:
        id: 产品ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        code: 产品编码（唯一）
        name: 产品名称
        specification: 规格
        unit: 单位
        bom_data: BOM 数据（JSON格式）
        version: 版本号
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    # 基础字段已从 BaseModel 继承（uuid, tenant_id, created_at, updated_at, deleted_at）
    
    # 基本信息
    code = fields.CharField(max_length=50, description="产品编码（唯一）")
    name = fields.CharField(max_length=200, description="产品名称")
    specification = fields.CharField(max_length=500, null=True, description="规格")
    unit = fields.CharField(max_length=20, description="单位")
    
    # BOM 信息
    bom_data = fields.JSONField(null=True, description="BOM 数据（JSON格式）")
    
    # 版本信息
    version = fields.CharField(max_length=20, null=True, description="版本号")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_products"
        table_description = "基础数据管理 - 产品"
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("version",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

