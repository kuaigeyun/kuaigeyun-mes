"""
传感器数据模型模块

定义传感器数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class SensorData(BaseModel):
    """
    传感器数据模型
    
    用于管理传感器数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        data_no: 数据编号（组织内唯一）
        sensor_id: 传感器ID（关联master-data）
        sensor_name: 传感器名称
        config_id: 配置ID（关联SensorConfiguration）
        collection_time: 采集时间
        data_value: 数据值
        data_unit: 数据单位
        data_quality: 数据质量（正常、异常、缺失）
        is_alarm: 是否报警
        status: 状态（正常、异常）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiiot_sensor_data"
        indexes = [
            ("tenant_id",),
            ("data_no",),
            ("uuid",),
            ("sensor_id",),
            ("config_id",),
            ("collection_time",),
            ("data_quality",),
            ("is_alarm",),
            ("status",),
        ]
        unique_together = [("tenant_id", "data_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    data_no = fields.CharField(max_length=50, description="数据编号（组织内唯一）")
    sensor_id = fields.IntField(null=True, description="传感器ID（关联master-data）")
    sensor_name = fields.CharField(max_length=200, null=True, description="传感器名称")
    config_id = fields.IntField(null=True, description="配置ID（关联SensorConfiguration）")
    collection_time = fields.DatetimeField(description="采集时间")
    
    # 数据信息
    data_value = fields.DecimalField(max_digits=18, decimal_places=4, description="数据值")
    data_unit = fields.CharField(max_length=50, null=True, description="数据单位")
    data_quality = fields.CharField(max_length=50, default="正常", description="数据质量（正常、异常、缺失）")
    is_alarm = fields.BooleanField(default=False, description="是否报警")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="状态（正常、异常）")
    
    def __str__(self):
        return f"{self.data_no} - {self.sensor_name} - {self.data_value}"

