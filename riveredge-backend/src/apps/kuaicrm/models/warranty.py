"""
保修管理模型模块

定义保修数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Warranty(BaseModel):
    """
    保修模型
    
    用于管理产品保修，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        warranty_no: 保修编号（组织内唯一）
        customer_id: 客户ID（关联master-data）
        product_info: 产品信息
        warranty_type: 保修类型
        warranty_period: 保修期限（月）
        warranty_status: 保修状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicrm_warranties"
        indexes = [
            ("tenant_id",),
            ("warranty_no",),
            ("uuid",),
            ("warranty_status",),
            ("customer_id",),
        ]
        unique_together = [("tenant_id", "warranty_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    warranty_no = fields.CharField(max_length=50, description="保修编号（组织内唯一）")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    product_info = fields.TextField(description="产品信息")
    
    # 保修信息
    warranty_type = fields.CharField(max_length=50, description="保修类型")
    warranty_period = fields.IntField(description="保修期限（月）")
    warranty_start_date = fields.DatetimeField(null=True, description="保修开始日期")
    warranty_end_date = fields.DatetimeField(null=True, description="保修结束日期")
    warranty_status = fields.CharField(max_length=20, default="有效", description="保修状态（有效、已过期、已取消）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.warranty_no} - {self.warranty_type}"
