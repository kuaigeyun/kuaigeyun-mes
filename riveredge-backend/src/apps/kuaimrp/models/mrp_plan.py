"""
MRP需求计划模型模块

定义MRP需求计划数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MRPPlan(BaseModel):
    """
    MRP需求计划模型
    
    用于管理MRP需求计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 计划编号（组织内唯一）
        plan_name: 计划名称
        plan_type: 计划类型（MRP、LRP）
        plan_date: 计划日期
        status: 计划状态（草稿、计算中、已完成、已关闭）
        start_date: 计划开始日期
        end_date: 计划结束日期
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimrp_mrp_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("uuid",),
            ("status",),
            ("plan_type",),
            ("plan_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    plan_no = fields.CharField(max_length=50, description="计划编号（组织内唯一）")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    plan_type = fields.CharField(max_length=20, default="MRP", description="计划类型（MRP、LRP）")
    plan_date = fields.DatetimeField(description="计划日期")
    
    # 计划状态
    status = fields.CharField(max_length=50, default="草稿", description="计划状态（草稿、计算中、已完成、已关闭）")
    
    # 计划时间范围
    start_date = fields.DatetimeField(null=True, description="计划开始日期")
    end_date = fields.DatetimeField(null=True, description="计划结束日期")
    
    # 计算参数（JSON格式）
    calculation_params = fields.JSONField(null=True, description="计算参数（JSON格式）")
    
    # 计算结果统计（JSON格式）
    calculation_result = fields.JSONField(null=True, description="计算结果统计（JSON格式）")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.plan_no} - {self.plan_name}"
