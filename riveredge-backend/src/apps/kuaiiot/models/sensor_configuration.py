"""
传感器配置模型模块

定义传感器配置数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SensorConfiguration(BaseModel):
    """
    传感器配置模型
    
    用于管理传感器配置，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        config_no: 配置编号（组织内唯一）
        sensor_id: 传感器ID（关联master-data）
        sensor_name: 传感器名称
        sensor_type: 传感器类型（温度、压力、流量等）
        parameter_name: 参数名称
        parameter_unit: 参数单位
        collection_frequency: 采集频率（秒）
        data_range_min: 数据范围最小值
        data_range_max: 数据范围最大值
        alarm_threshold_min: 报警阈值最小值
        alarm_threshold_max: 报警阈值最大值
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiiot_sensor_configurations"
        indexes = [
            ("tenant_id",),
            ("config_no",),
            ("uuid",),
            ("sensor_id",),
            ("sensor_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "config_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    config_no = fields.CharField(max_length=50, description="配置编号（组织内唯一）")
    sensor_id = fields.IntField(null=True, description="传感器ID（关联master-data）")
    sensor_name = fields.CharField(max_length=200, null=True, description="传感器名称")
    sensor_type = fields.CharField(max_length=50, description="传感器类型（温度、压力、流量等）")
    parameter_name = fields.CharField(max_length=100, description="参数名称")
    parameter_unit = fields.CharField(max_length=50, null=True, description="参数单位")
    collection_frequency = fields.IntField(null=True, description="采集频率（秒）")
    
    # 数据范围
    data_range_min = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数据范围最小值")
    data_range_max = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数据范围最大值")
    alarm_threshold_min = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="报警阈值最小值")
    alarm_threshold_max = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="报警阈值最大值")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.config_no} - {self.sensor_name}"

