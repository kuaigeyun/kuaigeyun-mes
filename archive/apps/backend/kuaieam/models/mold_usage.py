"""
模具使用记录模型模块

定义模具使用记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MoldUsage(BaseModel):
    """
    模具使用记录模型
    
    用于管理模具使用记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        usage_no: 使用记录编号（组织内唯一）
        mold_id: 模具ID（关联master-data）
        mold_name: 模具名称
        mold_code: 模具编码
        source_type: 来源类型（生产订单、工单）
        source_id: 来源ID
        source_no: 来源编号
        usage_date: 使用日期
        usage_count: 使用次数
        total_usage_count: 累计使用次数
        operator_id: 操作人员ID（用户ID）
        operator_name: 操作人员姓名
        status: 使用状态（使用中、已归还、已报废）
        return_date: 归还日期
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaieam_mold_usages"
        indexes = [
            ("tenant_id",),
            ("usage_no",),
            ("mold_id",),
            ("source_type",),
            ("usage_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "usage_no")]
    
    usage_no = fields.CharField(max_length=100, description="使用记录编号")
    mold_id = fields.IntField(description="模具ID")
    mold_name = fields.CharField(max_length=200, description="模具名称")
    mold_code = fields.CharField(max_length=100, null=True, description="模具编码")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（生产订单、工单）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="来源编号")
    usage_date = fields.DatetimeField(description="使用日期")
    usage_count = fields.IntField(default=1, description="使用次数")
    total_usage_count = fields.IntField(null=True, description="累计使用次数")
    operator_id = fields.IntField(null=True, description="操作人员ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人员姓名")
    status = fields.CharField(max_length=50, default="使用中", description="使用状态")
    return_date = fields.DatetimeField(null=True, description="归还日期")
    remark = fields.TextField(null=True, description="备注")
