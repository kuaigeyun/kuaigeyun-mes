"""
不合格品处理模型模块

定义不合格品处理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class NonconformingHandling(BaseModel):
    """
    不合格品处理模型
    
    用于管理不合格品处理，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        handling_no: 处理单编号（组织内唯一）
        nonconforming_product_id: 不合格品记录ID（关联NonconformingProduct）
        nonconforming_product_uuid: 不合格品记录UUID
        handling_type: 处理类型（返工、返修、报废、让步接收）
        handling_plan: 处理方案
        handling_executor_id: 处理执行人ID（用户ID）
        handling_executor_name: 处理执行人姓名
        handling_date: 处理日期
        handling_result: 处理结果（成功、失败、部分成功）
        handling_quantity: 处理数量
        status: 处理状态（待处理、处理中、已完成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiqms_nonconforming_handlings"
        indexes = [
            ("tenant_id",),
            ("handling_no",),
            ("uuid",),
            ("nonconforming_product_id",),
            ("nonconforming_product_uuid",),
            ("handling_type",),
            ("handling_executor_id",),
            ("status",),
            ("handling_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "handling_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    handling_no = fields.CharField(max_length=50, description="处理单编号（组织内唯一）")
    nonconforming_product_id = fields.IntField(null=True, description="不合格品记录ID（关联NonconformingProduct）")
    nonconforming_product_uuid = fields.CharField(max_length=36, null=True, description="不合格品记录UUID")
    
    # 处理信息
    handling_type = fields.CharField(max_length=50, description="处理类型（返工、返修、报废、让步接收）")
    handling_plan = fields.TextField(description="处理方案")
    
    # 执行人信息
    handling_executor_id = fields.IntField(null=True, description="处理执行人ID（用户ID）")
    handling_executor_name = fields.CharField(max_length=100, null=True, description="处理执行人姓名")
    
    # 处理日期
    handling_date = fields.DatetimeField(null=True, description="处理日期")
    
    # 处理结果
    handling_result = fields.CharField(max_length=50, null=True, description="处理结果（成功、失败、部分成功）")
    handling_quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="处理数量")
    
    # 处理状态
    status = fields.CharField(max_length=50, default="待处理", description="处理状态（待处理、处理中、已完成、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.handling_no} - {self.handling_type}"
