"""
成本核算规则模型模块

定义成本核算规则数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class CostRule(BaseModel):
    """成本核算规则模型"""
    """
    成本核算规则模型

    用于管理成本核算规则配置，包括材料成本、人工成本、制造费用等核算规则。
    支持多组织隔离，每个组织的成本核算规则相互独立。
    """

    class Meta:
        table = "apps_kuaicaiwu_cost_rules"
        table_description = "轻管理会计 - 成本核算规则"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("rule_type",),
            ("cost_type",),
            ("is_active",),
        ]
        unique_together = [("tenant_id", "code")]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, description="规则编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="规则名称")
    rule_type = fields.CharField(max_length=50, description="规则类型（材料成本、人工成本、制造费用）")
    cost_type = fields.CharField(max_length=50, description="成本类型")
    calculation_method = fields.CharField(max_length=50, description="计算方法")
    allocation_basis = fields.CharField(max_length=50, null=True, description="分摊基准（如：产量、工时、机器工时、产值、手动分摊）")
    wip_valuation_method = fields.CharField(max_length=50, null=True, description="[已弃用] 在产品核算方法，配置面已移除")
    source_module = fields.CharField(max_length=50, null=True, description="费用来源模块（如：薪资、采购、仓库、报工）")
    calculation_formula = fields.JSONField(null=True, description="计算公式（JSON格式）")
    rule_parameters = fields.JSONField(null=True, description="规则参数（JSON格式）")
    is_active = fields.BooleanField(default=True, description="是否启用")
    description = fields.TextField(null=True, description="描述")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.name}"
