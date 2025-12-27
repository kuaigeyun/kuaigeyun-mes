"""
供应商评估模型模块

定义供应商评估数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SupplierEvaluation(BaseModel):
    """
    供应商评估模型
    
    用于管理供应商评估，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        evaluation_no: 评估编号（组织内唯一）
        supplier_id: 供应商ID（关联master-data）
        evaluation_period: 评估周期（月度、季度、年度）
        evaluation_date: 评估日期
        quality_score: 质量评分（0-100）
        delivery_score: 交期评分（0-100）
        price_score: 价格评分（0-100）
        service_score: 服务评分（0-100）
        total_score: 综合评分（0-100）
        evaluation_level: 评估等级（A、B、C、D）
        evaluation_result: 评估结果（JSON格式）
        evaluator_id: 评估人ID（用户ID）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaisrm_supplier_evaluations"
        indexes = [
            ("tenant_id",),
            ("evaluation_no",),
            ("uuid",),
            ("supplier_id",),
            ("evaluation_period",),
            ("evaluation_date",),
            ("evaluation_level",),
            ("total_score",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "evaluation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    evaluation_no = fields.CharField(max_length=50, description="评估编号（组织内唯一）")
    supplier_id = fields.IntField(description="供应商ID（关联master-data）")
    evaluation_period = fields.CharField(max_length=20, description="评估周期（月度、季度、年度）")
    evaluation_date = fields.DatetimeField(description="评估日期")
    
    # 评分信息
    quality_score = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="质量评分（0-100）")
    delivery_score = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="交期评分（0-100）")
    price_score = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="价格评分（0-100）")
    service_score = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="服务评分（0-100）")
    total_score = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="综合评分（0-100）")
    
    # 评估等级
    evaluation_level = fields.CharField(max_length=10, null=True, description="评估等级（A、B、C、D）")
    
    # 评估结果（JSON格式）
    evaluation_result = fields.JSONField(null=True, description="评估结果（JSON格式）")
    
    # 评估人
    evaluator_id = fields.IntField(null=True, description="评估人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.evaluation_no} - 供应商{self.supplier_id}"
