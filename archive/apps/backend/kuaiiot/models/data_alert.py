"""
数据预警模型模块

定义数据预警数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class DataAlert(BaseModel):
    """
    数据预警模型
    
    用于管理数据预警，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        alert_no: 预警编号（组织内唯一）
        alert_type: 预警类型（数据异常、阈值超限、设备故障等）
        alert_level: 预警级别（低、中、高、紧急）
        sensor_id: 传感器ID（关联master-data）
        sensor_name: 传感器名称
        device_id: 设备ID（关联master-data）
        device_name: 设备名称
        alert_content: 预警内容
        alert_time: 预警时间
        is_handled: 是否已处理
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_time: 处理时间
        handling_result: 处理结果
        status: 状态（待处理、处理中、已处理、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiiot_data_alerts"
        indexes = [
            ("tenant_id",),
            ("alert_no",),
            ("uuid",),
            ("alert_type",),
            ("alert_level",),
            ("sensor_id",),
            ("device_id",),
            ("is_handled",),
            ("status",),
        ]
        unique_together = [("tenant_id", "alert_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    alert_no = fields.CharField(max_length=50, description="预警编号（组织内唯一）")
    alert_type = fields.CharField(max_length=50, description="预警类型（数据异常、阈值超限、设备故障等）")
    alert_level = fields.CharField(max_length=50, description="预警级别（低、中、高、紧急）")
    sensor_id = fields.IntField(null=True, description="传感器ID（关联master-data）")
    sensor_name = fields.CharField(max_length=200, null=True, description="传感器名称")
    device_id = fields.IntField(null=True, description="设备ID（关联master-data）")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    alert_content = fields.TextField(null=True, description="预警内容")
    alert_time = fields.DatetimeField(description="预警时间")
    
    # 处理信息
    is_handled = fields.BooleanField(default=False, description="是否已处理")
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_time = fields.DatetimeField(null=True, description="处理时间")
    handling_result = fields.TextField(null=True, description="处理结果")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待处理", description="状态（待处理、处理中、已处理、已关闭）")
    
    def __str__(self):
        return f"{self.alert_no} - {self.alert_type} - {self.alert_level}"

