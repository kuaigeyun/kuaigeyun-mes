"""
设计评审模型模块

定义设计评审数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class DesignReview(BaseModel):
    """
    设计评审模型
    
    用于管理设计评审计划、执行、记录等，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        review_no: 评审编号（组织内唯一）
        review_type: 评审类型（概念评审、设计评审、样机评审等）
        review_stage: 评审阶段
        product_id: 关联产品ID（关联master-data）
        review_date: 评审日期
        status: 评审状态（计划中、进行中、已完成、已关闭）
        conclusion: 评审结论（通过、有条件通过、不通过）
        review_content: 评审内容
        review_result: 评审结果
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaipdm_design_reviews"
        indexes = [
            ("tenant_id",),
            ("review_no",),
            ("uuid",),
            ("status",),
            ("review_type",),
            ("product_id",),
            ("review_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "review_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    review_no = fields.CharField(max_length=50, description="评审编号（组织内唯一）")
    review_type = fields.CharField(max_length=50, description="评审类型（概念评审、设计评审、样机评审等）")
    review_stage = fields.CharField(max_length=50, null=True, description="评审阶段")
    product_id = fields.IntField(null=True, description="关联产品ID（关联master-data）")
    review_date = fields.DatetimeField(null=True, description="评审日期")
    
    # 评审状态和结论
    status = fields.CharField(max_length=50, default="计划中", description="评审状态（计划中、进行中、已完成、已关闭）")
    conclusion = fields.CharField(max_length=50, null=True, description="评审结论（通过、有条件通过、不通过）")
    
    # 评审内容
    review_content = fields.TextField(null=True, description="评审内容")
    review_result = fields.TextField(null=True, description="评审结果")
    
    # 评审人员（JSON格式存储评审人员列表）
    reviewers = fields.JSONField(null=True, description="评审人员列表（JSON格式）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.review_no} - {self.review_type}"
