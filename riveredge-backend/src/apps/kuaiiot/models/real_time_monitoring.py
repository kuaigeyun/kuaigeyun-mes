"""
实时监控模型模块

定义实时监控数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class RealTimeMonitoring(BaseModel):
    """
    实时监控模型
    
    用于管理实时监控，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        monitoring_no: 监控编号（组织内唯一）
        monitoring_name: 监控名称
        monitoring_type: 监控类型（设备状态、传感器数据、生产数据等）
        device_id: 设备ID（关联master-data）
        device_name: 设备名称
        monitoring_config: 监控配置（JSON格式）
        refresh_interval: 刷新间隔（秒）
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiiot_real_time_monitorings"
        indexes = [
            ("tenant_id",),
            ("monitoring_no",),
            ("uuid",),
            ("monitoring_type",),
            ("device_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "monitoring_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    monitoring_no = fields.CharField(max_length=50, description="监控编号（组织内唯一）")
    monitoring_name = fields.CharField(max_length=200, description="监控名称")
    monitoring_type = fields.CharField(max_length=50, description="监控类型（设备状态、传感器数据、生产数据等）")
    device_id = fields.IntField(null=True, description="设备ID（关联master-data）")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    monitoring_config = fields.JSONField(null=True, description="监控配置（JSON格式）")
    refresh_interval = fields.IntField(null=True, description="刷新间隔（秒）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.monitoring_no} - {self.monitoring_name}"

