"""
车辆调度模型模块

定义车辆调度数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class VehicleDispatch(BaseModel):
    """
    车辆调度模型
    
    用于管理车辆调度，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        dispatch_no: 调度单编号（组织内唯一）
        vehicle_id: 车辆ID（关联master-data）
        vehicle_no: 车牌号
        driver_id: 司机ID（用户ID）
        driver_name: 司机姓名
        plan_id: 运输计划ID
        plan_uuid: 运输计划UUID
        dispatch_date: 调度日期
        dispatch_type: 调度类型（正常调度、紧急调度、临时调度）
        status: 调度状态（待调度、已调度、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaitms_vehicle_dispatches"
        indexes = [
            ("tenant_id",),
            ("dispatch_no",),
            ("vehicle_id",),
            ("driver_id",),
            ("plan_id",),
            ("status",),
            ("dispatch_date",),
        ]
        unique_together = [("tenant_id", "dispatch_no")]
    
    dispatch_no = fields.CharField(max_length=100, description="调度单编号")
    vehicle_id = fields.IntField(null=True, description="车辆ID")
    vehicle_no = fields.CharField(max_length=50, null=True, description="车牌号")
    driver_id = fields.IntField(null=True, description="司机ID")
    driver_name = fields.CharField(max_length=100, null=True, description="司机姓名")
    plan_id = fields.IntField(null=True, description="运输计划ID")
    plan_uuid = fields.CharField(max_length=36, null=True, description="运输计划UUID")
    dispatch_date = fields.DatetimeField(null=True, description="调度日期")
    dispatch_type = fields.CharField(max_length=50, default="正常调度", description="调度类型")
    status = fields.CharField(max_length=50, default="待调度", description="调度状态")
    remark = fields.TextField(null=True, description="备注")

