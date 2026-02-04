"""
成本核算记录模型模块

定义成本核算记录数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class CostCalculation(BaseModel):
    """
    成本核算记录模型
    
    用于记录工单或产品的成本核算结果，包括材料成本、人工成本、制造费用等。
    支持多组织隔离，每个组织的成本核算记录相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        calculation_no: 核算单号（组织内唯一）
        calculation_type: 核算类型（工单成本、产品成本、标准成本、实际成本）
        work_order_id: 工单ID（工单成本核算时关联）
        work_order_code: 工单编码
        product_id: 产品ID（产品成本核算时关联）
        product_code: 产品编码
        product_name: 产品名称
        quantity: 数量
        material_cost: 材料成本
        labor_cost: 人工成本
        manufacturing_cost: 制造费用
        total_cost: 总成本
        unit_cost: 单位成本
        calculation_date: 核算日期
        calculation_status: 核算状态（草稿、已核算、已审核）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_cost_calculations"
        table_description = "快格轻制造 - 成本核算"
        indexes = [
            ("tenant_id",),
            ("calculation_no",),
            ("uuid",),
            ("calculation_type",),
            ("work_order_id",),
            ("product_id",),
            ("calculation_date",),
            ("calculation_status",),
        ]
        unique_together = [("tenant_id", "calculation_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    calculation_no = fields.CharField(max_length=50, description="核算单号（组织内唯一）")
    calculation_type = fields.CharField(max_length=50, description="核算类型（工单成本、产品成本、标准成本、实际成本）")
    
    # 关联信息
    work_order_id = fields.IntField(null=True, description="工单ID（工单成本核算时关联）")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    product_id = fields.IntField(null=True, description="产品ID（产品成本核算时关联）")
    product_code = fields.CharField(max_length=50, null=True, description="产品编码")
    product_name = fields.CharField(max_length=200, null=True, description="产品名称")
    
    # 数量
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="数量")
    
    # 成本明细
    material_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="材料成本")
    labor_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="人工成本")
    manufacturing_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="制造费用")
    total_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总成本")
    unit_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="单位成本")
    
    # 成本明细（JSON格式，存储详细的成本明细）
    cost_details = fields.JSONField(null=True, description="成本明细（JSON格式）")
    
    # 核算信息
    calculation_date = fields.DateField(description="核算日期")
    calculation_status = fields.CharField(max_length=50, default="草稿", description="核算状态（草稿、已核算、已审核）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.calculation_no} - {self.product_name}"

