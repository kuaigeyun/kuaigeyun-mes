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
        monitoring_type: 监控类型（设备状态、异常预警、实时看板）
        device_id: 设备ID（关联master-data或EAM）
        device_name: 设备名称
        monitoring_config: 监控配置（JSON格式）
        alert_rules: 预警规则（JSON格式）
        current_status: 当前状态
        alert_status: 预警状态（正常、预警、紧急）
        last_update_time: 最后更新时间
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
        table = "apps_kuaaiot_real_time_monitorings"
        indexes = [
            ("tenant_id",),
            ("monitoring_no",),
            ("monitoring_type",),
            ("device_id",),
            ("alert_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "monitoring_no")]
    
    monitoring_no = fields.CharField(max_length=100, description="监控编号")
    monitoring_name = fields.CharField(max_length=200, description="监控名称")
    monitoring_type = fields.CharField(max_length=50, description="监控类型")
    device_id = fields.IntField(null=True, description="设备ID")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    monitoring_config = fields.JSONField(null=True, description="监控配置")
    alert_rules = fields.JSONField(null=True, description="预警规则")
    current_status = fields.CharField(max_length=50, null=True, description="当前状态")
    alert_status = fields.CharField(max_length=50, default="正常", description="预警状态")
    last_update_time = fields.DatetimeField(null=True, description="最后更新时间")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

