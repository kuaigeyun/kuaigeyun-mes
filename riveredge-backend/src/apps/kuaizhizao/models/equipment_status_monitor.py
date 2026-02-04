"""
设备状态监控模型模块

定义设备状态监控数据模型，用于记录设备状态的实时数据和历史记录。

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import fields
from core.models.base import BaseModel


class EquipmentStatusMonitor(BaseModel):
    """
    设备状态监控记录模型

    用于记录设备状态的实时数据，支持多组织隔离。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        equipment_id: 设备ID（关联Equipment）
        equipment_uuid: 设备UUID
        equipment_code: 设备编码
        equipment_name: 设备名称
        status: 设备状态（正常、运行中、待机、维修中、故障、停用）
        is_online: 是否在线
        runtime_hours: 运行时长（小时）
        last_maintenance_date: 上次维护日期
        next_maintenance_date: 下次维护日期
        temperature: 温度（摄氏度，可选）
        pressure: 压力（可选）
        vibration: 振动值（可选）
        other_parameters: 其他参数（JSON格式）
        data_source: 数据来源（manual/SCADA/sensor）
        monitored_at: 监控时间
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_equipment_status_monitors"
        table_description = "快格轻制造 - 设备状态监控"
        indexes = [
            ("tenant_id",),
            ("equipment_id",),
            ("equipment_uuid",),
            ("status",),
            ("is_online",),
            ("monitored_at",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联设备
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_code = fields.CharField(max_length=50, description="设备编码")
    equipment_name = fields.CharField(max_length=200, description="设备名称")

    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="设备状态（正常、运行中、待机、维修中、故障、停用）")
    is_online = fields.BooleanField(default=False, description="是否在线")
    
    # 运行信息
    runtime_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="运行时长（小时）")
    last_maintenance_date = fields.DatetimeField(null=True, description="上次维护日期")
    next_maintenance_date = fields.DatetimeField(null=True, description="下次维护日期")

    # 监控参数（可选）
    temperature = fields.DecimalField(max_digits=8, decimal_places=2, null=True, description="温度（摄氏度）")
    pressure = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="压力")
    vibration = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="振动值")
    other_parameters = fields.JSONField(null=True, description="其他参数（JSON格式）")

    # 数据来源
    data_source = fields.CharField(max_length=50, default="manual", description="数据来源（manual/SCADA/sensor）")

    # 监控时间
    monitored_at = fields.DatetimeField(description="监控时间")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.equipment_code} - {self.status} ({self.monitored_at})"


class EquipmentStatusHistory(BaseModel):
    """
    设备状态历史记录模型

    用于记录设备状态变化历史，支持状态追踪。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        equipment_id: 设备ID
        equipment_uuid: 设备UUID
        from_status: 原状态
        to_status: 新状态
        status_changed_at: 状态变更时间
        changed_by: 变更人ID
        changed_by_name: 变更人姓名
        reason: 变更原因
        remark: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_equipment_status_histories"
        table_description = "快格轻制造 - 设备状态历史"
        indexes = [
            ("tenant_id",),
            ("equipment_id",),
            ("equipment_uuid",),
            ("status_changed_at",),
            ("to_status",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联设备
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")

    # 状态变更信息
    from_status = fields.CharField(max_length=50, null=True, description="原状态")
    to_status = fields.CharField(max_length=50, description="新状态")
    status_changed_at = fields.DatetimeField(description="状态变更时间")

    # 变更人信息
    changed_by = fields.IntField(null=True, description="变更人ID")
    changed_by_name = fields.CharField(max_length=100, null=True, description="变更人姓名")

    # 变更原因
    reason = fields.CharField(max_length=200, null=True, description="变更原因")
    remark = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.equipment_uuid}: {self.from_status} -> {self.to_status} at {self.status_changed_at}"
