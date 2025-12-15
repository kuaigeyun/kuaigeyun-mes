"""
需求追溯模型模块

定义需求追溯数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class RequirementTraceability(BaseModel):
    """
    需求追溯模型
    
    用于管理需求追溯关系，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        requirement_id: 需求ID（关联MaterialRequirement）
        source_type: 需求来源类型（销售订单、销售预测、安全库存、独立需求等）
        source_id: 需求来源ID
        source_no: 需求来源编号
        parent_requirement_id: 父需求ID（用于需求层级关系）
        level: 需求层级（0为最顶层）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaimrp_requirement_traceabilities"
        indexes = [
            ("tenant_id",),
            ("requirement_id",),
            ("uuid",),
            ("source_type",),
            ("source_id",),
            ("parent_requirement_id",),
            ("level",),
            ("created_at",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联需求
    requirement_id = fields.IntField(description="需求ID（关联MaterialRequirement）")
    
    # 需求来源
    source_type = fields.CharField(max_length=50, description="需求来源类型（销售订单、销售预测、安全库存、独立需求等）")
    source_id = fields.IntField(null=True, description="需求来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="需求来源编号")
    
    # 需求层级关系
    parent_requirement_id = fields.IntField(null=True, description="父需求ID（用于需求层级关系）")
    level = fields.IntField(default=0, description="需求层级（0为最顶层）")
    
    # 需求数量
    requirement_qty = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="需求数量")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"需求{self.requirement_id} <- {self.source_type}"
