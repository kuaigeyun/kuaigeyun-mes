"""
传感器数据模型模块

定义传感器数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal


class SensorData(BaseModel):
    """
    传感器数据模型
    
    用于管理传感器数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        sensor_no: 传感器编号（组织内唯一）
        sensor_name: 传感器名称
        sensor_type: 传感器类型
        device_id: 设备ID（关联master-data或EAM）
        device_name: 设备名称
        collection_frequency: 采集频率（秒）
        parameter_config: 参数配置（JSON格式）
        last_collection_time: 最后采集时间
        collection_status: 采集状态（运行中、已停止、异常）
        data_quality: 数据质量（正常、异常、缺失）
        status: 状态（启用、停用）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaaiot_sensor_datas"
        indexes = [
            ("tenant_id",),
            ("sensor_no",),
            ("sensor_type",),
            ("device_id",),
            ("collection_status",),
            ("data_quality",),
            ("status",),
        ]
        unique_together = [("tenant_id", "sensor_no")]
    
    sensor_no = fields.CharField(max_length=100, description="传感器编号")
    sensor_name = fields.CharField(max_length=200, description="传感器名称")
    sensor_type = fields.CharField(max_length=50, description="传感器类型")
    device_id = fields.IntField(null=True, description="设备ID")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    collection_frequency = fields.IntField(null=True, description="采集频率（秒）")
    parameter_config = fields.JSONField(null=True, description="参数配置")
    last_collection_time = fields.DatetimeField(null=True, description="最后采集时间")
    collection_status = fields.CharField(max_length=50, default="运行中", description="采集状态")
    data_quality = fields.CharField(max_length=50, default="正常", description="数据质量")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

