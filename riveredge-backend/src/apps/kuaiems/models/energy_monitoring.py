"""
能源监测模型模块

定义能源监测数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class EnergyMonitoring(BaseModel):
    """
    能源监测模型
    
    用于管理能源监测，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        monitoring_no: 监测编号（组织内唯一）
        monitoring_name: 监测名称
        energy_type: 能源类型（电、水、气、蒸汽等）
        device_id: 设备ID（关联master-data或IOT）
        device_name: 设备名称
        collection_frequency: 采集频率（秒）
        current_consumption: 当前能耗
        unit: 单位（kWh、m³、kg等）
        collection_status: 采集状态（运行中、已停止、异常）
        data_quality: 数据质量（正常、异常、缺失）
        last_collection_time: 最后采集时间
        alert_status: 预警状态（正常、预警、紧急）
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
        table = "seed_kuaiems_energy_monitorings"
        indexes = [
            ("tenant_id",),
            ("monitoring_no",),
            ("energy_type",),
            ("device_id",),
            ("collection_status",),
            ("alert_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "monitoring_no")]
    
    monitoring_no = fields.CharField(max_length=100, description="监测编号")
    monitoring_name = fields.CharField(max_length=200, description="监测名称")
    energy_type = fields.CharField(max_length=50, description="能源类型")
    device_id = fields.IntField(null=True, description="设备ID")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    collection_frequency = fields.IntField(null=True, description="采集频率（秒）")
    current_consumption = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="当前能耗")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    collection_status = fields.CharField(max_length=50, default="运行中", description="采集状态")
    data_quality = fields.CharField(max_length=50, default="正常", description="数据质量")
    last_collection_time = fields.DatetimeField(null=True, description="最后采集时间")
    alert_status = fields.CharField(max_length=50, default="正常", description="预警状态")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

