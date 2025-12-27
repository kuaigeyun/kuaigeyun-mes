"""
运输执行模型模块

定义运输执行数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class TransportExecution(BaseModel):
    """
    运输执行模型
    
    用于管理运输执行，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        execution_no: 执行单编号（组织内唯一）
        plan_id: 运输计划ID
        plan_uuid: 运输计划UUID
        vehicle_id: 车辆ID（关联master-data）
        vehicle_no: 车牌号
        driver_id: 司机ID（用户ID）
        driver_name: 司机姓名
        loading_date: 装车日期
        loading_status: 装车状态（待装车、装车中、已装车）
        departure_date: 发车日期
        current_location: 当前位置（GPS坐标）
        tracking_status: 跟踪状态（待发车、在途、已到达、已签收）
        arrival_date: 到达日期
        sign_date: 签收日期
        sign_person: 签收人
        sign_status: 签收状态（待签收、已签收、拒签）
        status: 执行状态（待执行、执行中、已完成、异常、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaitms_transport_executions"
        indexes = [
            ("tenant_id",),
            ("execution_no",),
            ("plan_id",),
            ("vehicle_id",),
            ("driver_id",),
            ("status",),
            ("tracking_status",),
            ("loading_date",),
        ]
        unique_together = [("tenant_id", "execution_no")]
    
    execution_no = fields.CharField(max_length=100, description="执行单编号")
    plan_id = fields.IntField(null=True, description="运输计划ID")
    plan_uuid = fields.CharField(max_length=36, null=True, description="运输计划UUID")
    vehicle_id = fields.IntField(null=True, description="车辆ID")
    vehicle_no = fields.CharField(max_length=50, null=True, description="车牌号")
    driver_id = fields.IntField(null=True, description="司机ID")
    driver_name = fields.CharField(max_length=100, null=True, description="司机姓名")
    loading_date = fields.DatetimeField(null=True, description="装车日期")
    loading_status = fields.CharField(max_length=50, default="待装车", description="装车状态")
    departure_date = fields.DatetimeField(null=True, description="发车日期")
    current_location = fields.CharField(max_length=200, null=True, description="当前位置")
    tracking_status = fields.CharField(max_length=50, default="待发车", description="跟踪状态")
    arrival_date = fields.DatetimeField(null=True, description="到达日期")
    sign_date = fields.DatetimeField(null=True, description="签收日期")
    sign_person = fields.CharField(max_length=100, null=True, description="签收人")
    sign_status = fields.CharField(max_length=50, default="待签收", description="签收状态")
    status = fields.CharField(max_length=50, default="待执行", description="执行状态")
    remark = fields.TextField(null=True, description="备注")

