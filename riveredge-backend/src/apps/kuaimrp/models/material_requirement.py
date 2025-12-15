"""
物料需求明细模型模块

定义物料需求明细数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialRequirement(BaseModel):
    """
    物料需求明细模型
    
    用于管理物料需求明细，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        requirement_no: 需求编号（组织内唯一）
        material_id: 物料ID（关联master-data）
        requirement_type: 需求类型（MRP、LRP）
        plan_id: 关联计划ID（MRPPlan或LRPBatch）
        requirement_date: 需求日期
        gross_requirement: 毛需求数量
        available_stock: 可用库存
        in_transit_stock: 在途库存
        safety_stock: 安全库存
        net_requirement: 净需求数量
        suggested_order_qty: 建议采购/生产数量
        suggested_order_date: 建议采购/生产日期
        status: 需求状态（待处理、已生成计划、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaimrp_material_requirements"
        indexes = [
            ("tenant_id",),
            ("requirement_no",),
            ("uuid",),
            ("material_id",),
            ("requirement_type",),
            ("plan_id",),
            ("requirement_date",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "requirement_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    requirement_no = fields.CharField(max_length=50, description="需求编号（组织内唯一）")
    material_id = fields.IntField(description="物料ID（关联master-data）")
    requirement_type = fields.CharField(max_length=20, description="需求类型（MRP、LRP）")
    plan_id = fields.IntField(null=True, description="关联计划ID（MRPPlan或LRPBatch）")
    
    # 需求日期和数量
    requirement_date = fields.DatetimeField(description="需求日期")
    gross_requirement = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="毛需求数量")
    available_stock = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="可用库存")
    in_transit_stock = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="在途库存")
    safety_stock = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="安全库存")
    net_requirement = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="净需求数量")
    
    # 建议计划
    suggested_order_qty = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="建议采购/生产数量")
    suggested_order_date = fields.DatetimeField(null=True, description="建议采购/生产日期")
    suggested_type = fields.CharField(max_length=20, null=True, description="建议类型（采购、生产、委外）")
    
    # 需求状态
    status = fields.CharField(max_length=50, default="待处理", description="需求状态（待处理、已生成计划、已完成）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.requirement_no} - 物料{self.material_id}"
