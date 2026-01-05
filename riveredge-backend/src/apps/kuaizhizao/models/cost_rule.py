"""
成本核算规则模型模块

定义成本核算规则数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class CostRule(BaseModel):
    """
    成本核算规则模型
    
    用于管理成本核算规则配置，包括材料成本、人工成本、制造费用等核算规则。
    支持多组织隔离，每个组织的成本核算规则相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 规则编码（组织内唯一）
        name: 规则名称
        rule_type: 规则类型（材料成本、人工成本、制造费用）
        cost_type: 成本类型（直接材料、间接材料、直接人工、间接人工、制造费用等）
        calculation_method: 计算方法（按数量、按工时、按比例、按固定值等）
        calculation_formula: 计算公式（JSON格式，存储计算公式配置）
        is_active: 是否启用
        description: 描述
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_cost_rules"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("rule_type",),
            ("cost_type",),
            ("is_active",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="规则编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="规则名称")
    
    # 规则类型
    rule_type = fields.CharField(max_length=50, description="规则类型（材料成本、人工成本、制造费用）")
    cost_type = fields.CharField(max_length=50, description="成本类型（直接材料、间接材料、直接人工、间接人工、制造费用等）")
    
    # 计算方法
    calculation_method = fields.CharField(max_length=50, description="计算方法（按数量、按工时、按比例、按固定值等）")
    calculation_formula = fields.JSONField(null=True, description="计算公式（JSON格式，存储计算公式配置）")
    
    # 规则参数（JSON格式，存储规则参数配置）
    rule_parameters = fields.JSONField(null=True, description="规则参数（JSON格式）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    description = fields.TextField(null=True, description="描述")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

