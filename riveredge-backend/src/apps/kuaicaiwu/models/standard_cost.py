"""
标准成本库模型
"""

from tortoise import fields
from core.models.base import BaseModel

class StandardCost(BaseModel):
    """
    标准成本模型
    
    存储物料的标准成本、工序/工位标率等，作为成本差异分析的基准。
    """
    
    class Meta:
        table = "apps_kuaicaiwu_standard_costs"
        table_description = "管理会计 - 标准成本库"
        indexes = [
            ("tenant_id",),
            ("target_type", "target_id"),
            ("is_active",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    
    # 目标类型：material(物料), work_center(工作中心), work_station(工位)
    target_type = fields.CharField(max_length=20, description="目标类型")
    target_id = fields.IntField(description="目标ID")
    target_code = fields.CharField(max_length=50, null=True, description="目标编码")
    target_name = fields.CharField(max_length=200, null=True, description="目标名称")

    # 成本项目类型：material_cost, labor_rate, overhead_rate
    cost_item_type = fields.CharField(max_length=20, description="成本项目类型")
    
    # 标准数值
    standard_value = fields.DecimalField(max_digits=18, decimal_places=4, description="标准数值（单价或费率）")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    unit = fields.CharField(max_length=20, null=True, description="单位（如 /kg, /hour）")

    # 版本与有效期
    version = fields.CharField(max_length=20, default="1.0", description="版本号")
    effective_date = fields.DateField(null=True, description="生效日期")
    expiry_date = fields.DateField(null=True, description="失效日期")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    description = fields.TextField(null=True, description="描述")
    
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"StandardCost: {self.target_type}#{self.target_id} - {self.standard_value}"
