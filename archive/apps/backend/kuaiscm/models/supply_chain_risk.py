"""
供应链风险模型模块

定义供应链风险数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SupplyChainRisk(BaseModel):
    """
    供应链风险模型
    
    用于管理供应链风险，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        risk_no: 风险编号（组织内唯一）
        risk_name: 风险名称
        risk_type: 风险类型（供应商风险、物流风险、市场风险等）
        risk_category: 风险分类
        supplier_id: 供应商ID（关联master-data，如果是供应商风险）
        supplier_name: 供应商名称
        risk_level: 风险等级（高、中、低）
        risk_probability: 风险概率（百分比）
        risk_impact: 风险影响（高、中、低）
        risk_description: 风险描述
        warning_status: 预警状态（未预警、已预警、已处理）
        contingency_plan: 应急预案（JSON格式）
        status: 状态（待评估、评估中、已评估、已处理）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiscm_supply_chain_risks"
        indexes = [
            ("tenant_id",),
            ("risk_no",),
            ("risk_type",),
            ("supplier_id",),
            ("risk_level",),
            ("warning_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "risk_no")]
    
    risk_no = fields.CharField(max_length=100, description="风险编号")
    risk_name = fields.CharField(max_length=200, description="风险名称")
    risk_type = fields.CharField(max_length=50, description="风险类型")
    risk_category = fields.CharField(max_length=50, null=True, description="风险分类")
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")
    risk_level = fields.CharField(max_length=20, default="中", description="风险等级")
    risk_probability = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="风险概率")
    risk_impact = fields.CharField(max_length=20, null=True, description="风险影响")
    risk_description = fields.TextField(null=True, description="风险描述")
    warning_status = fields.CharField(max_length=50, default="未预警", description="预警状态")
    contingency_plan = fields.JSONField(null=True, description="应急预案")
    status = fields.CharField(max_length=50, default="待评估", description="状态")
    remark = fields.TextField(null=True, description="备注")

