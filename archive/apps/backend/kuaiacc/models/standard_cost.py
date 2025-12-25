"""
标准成本模型模块

定义标准成本数据模型，支持多组织隔离。
按照中国财务规范：标准成本法。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class StandardCost(BaseModel):
    """
    标准成本模型
    
    用于管理标准成本，支持多组织隔离。
    按照中国财务规范：标准成本法。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        cost_no: 成本编号（组织内唯一）
        material_id: 物料ID（关联master-data）
        material_code: 物料编码
        material_name: 物料名称
        version: 版本号（标准成本版本）
        effective_date: 生效日期
        expiry_date: 失效日期
        material_cost: 材料成本
        labor_cost: 人工成本
        manufacturing_cost: 制造费用
        total_cost: 总成本
        unit: 单位
        status: 状态（草稿、已生效、已失效）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_standard_costs"
        indexes = [
            ("tenant_id",),
            ("cost_no",),
            ("uuid",),
            ("material_id",),
            ("version",),
            ("effective_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "cost_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    cost_no = fields.CharField(max_length=50, description="成本编号（组织内唯一）")
    material_id = fields.IntField(description="物料ID（关联master-data）")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    
    # 版本和有效期
    version = fields.CharField(max_length=20, description="版本号（标准成本版本）")
    effective_date = fields.DatetimeField(description="生效日期")
    expiry_date = fields.DatetimeField(null=True, description="失效日期")
    
    # 成本构成（中国财务：标准成本法）
    material_cost = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="材料成本")
    labor_cost = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="人工成本")
    manufacturing_cost = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="制造费用")
    total_cost = fields.DecimalField(max_digits=18, decimal_places=2, description="总成本")
    unit = fields.CharField(max_length=20, description="单位")
    
    # 状态
    status = fields.CharField(max_length=20, default="草稿", description="状态（草稿、已生效、已失效）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.cost_no} - {self.material_code} - {self.total_cost}"

