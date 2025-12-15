"""
商机模型模块

定义商机数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Opportunity(BaseModel):
    """
    商机模型
    
    用于管理销售商机，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        oppo_no: 商机编号（组织内唯一）
        oppo_name: 商机名称
        customer_id: 客户ID（关联master-data）
        stage: 商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）
        amount: 商机金额
        expected_close_date: 预计成交日期
        source: 商机来源（线索转化、直接创建）
        owner_id: 负责人（用户ID）
        probability: 成交概率（0-100）
        status: 商机状态（进行中、已成交、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicrm_opportunities"
        indexes = [
            ("tenant_id",),
            ("oppo_no",),
            ("uuid",),
            ("stage",),
            ("status",),
            ("owner_id",),
            ("customer_id",),
        ]
        unique_together = [("tenant_id", "oppo_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    oppo_no = fields.CharField(max_length=50, description="商机编号（组织内唯一）")
    oppo_name = fields.CharField(max_length=200, description="商机名称")
    customer_id = fields.IntField(null=True, description="客户ID（关联master-data）")
    
    # 商机阶段和金额
    stage = fields.CharField(max_length=50, default="初步接触", description="商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）")
    amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="商机金额")
    expected_close_date = fields.DatetimeField(null=True, description="预计成交日期")
    
    # 来源和负责人
    source = fields.CharField(max_length=50, null=True, description="商机来源（线索转化、直接创建）")
    lead_id = fields.IntField(null=True, description="关联线索ID（如果来自线索转化）")
    owner_id = fields.IntField(null=True, description="负责人（用户ID）")
    
    # 成交概率和状态
    probability = fields.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"), description="成交概率（0-100）")
    status = fields.CharField(max_length=20, default="进行中", description="商机状态（进行中、已成交、已关闭）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.oppo_no} - {self.oppo_name}"
