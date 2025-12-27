"""
运输计划模型模块

定义运输计划数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class TransportPlan(BaseModel):
    """
    运输计划模型
    
    用于管理运输计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 计划编号（组织内唯一）
        plan_name: 计划名称
        vehicle_id: 车辆ID（关联master-data）
        vehicle_no: 车牌号
        driver_id: 司机ID（用户ID）
        driver_name: 司机姓名
        route_info: 路线信息（JSON格式）
        planned_start_date: 计划开始时间
        planned_end_date: 计划结束时间
        actual_start_date: 实际开始时间
        actual_end_date: 实际结束时间
        status: 计划状态（草稿、已发布、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaitms_transport_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("vehicle_id",),
            ("driver_id",),
            ("status",),
            ("planned_start_date",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    plan_no = fields.CharField(max_length=100, description="计划编号")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    vehicle_id = fields.IntField(null=True, description="车辆ID")
    vehicle_no = fields.CharField(max_length=50, null=True, description="车牌号")
    driver_id = fields.IntField(null=True, description="司机ID")
    driver_name = fields.CharField(max_length=100, null=True, description="司机姓名")
    route_info = fields.JSONField(null=True, description="路线信息")
    planned_start_date = fields.DatetimeField(null=True, description="计划开始时间")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束时间")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始时间")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束时间")
    status = fields.CharField(max_length=50, default="草稿", description="计划状态")
    remark = fields.TextField(null=True, description="备注")

