"""
物料编码别名模型模块

定义物料编码别名数据模型，支持主编码和部门编码的映射关系。

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialCodeAlias(BaseModel):
    """
    物料编码别名模型
    
    存储物料的部门编码（别名），建立与主编码的映射关系。
    支持一个主编码对应多个部门编码。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        material_id: 物料ID（外键，关联到Material）
        code_type: 编码类型（SALE/DES/SUP/PUR/WH/PROD等）
        code: 部门编码
        department: 部门名称（可选）
        description: 描述（可选）
        is_primary: 是否为主要编码（同一类型中，只有一个可以是主要编码）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_code_aliases"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("code_type",),
            ("code",),
            ("uuid",),
        ]
        unique_together = [("tenant_id", "code_type", "code")]  # 同一组织内，同一类型的编码唯一
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联关系
    material = fields.ForeignKeyField(
        "models.Material",
        related_name="code_aliases",
        description="关联的物料"
    )
    
    # 编码信息
    code_type = fields.CharField(max_length=20, description="编码类型（SALE/DES/SUP/PUR/WH/PROD/CUSTOMER/SUPPLIER等）")
    code = fields.CharField(max_length=50, description="编码（部门编码、客户编码或供应商编码）")
    department = fields.CharField(max_length=100, null=True, description="部门名称（可选，用于部门编码）")
    
    # 外部实体关联（用于客户编码和供应商编码）
    external_entity_type = fields.CharField(max_length=20, null=True, description="外部实体类型（customer/supplier，用于客户编码和供应商编码）")
    external_entity_id = fields.IntField(null=True, description="外部实体ID（客户ID或供应商ID）")
    
    # 扩展信息
    description = fields.TextField(null=True, description="描述（可选）")
    is_primary = fields.BooleanField(default=False, description="是否为主要编码（同一类型中，只有一个可以是主要编码）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code_type}:{self.code} -> Material({self.material_id})"
