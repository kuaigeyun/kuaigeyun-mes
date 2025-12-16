"""
设备数据采集模型模块

定义设备数据采集数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class DeviceDataCollection(BaseModel):
    """
    设备数据采集模型
    
    用于管理设备数据采集，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        collection_no: 采集编号（组织内唯一）
        device_id: 设备ID（关联master-data）
        device_name: 设备名称
        collection_type: 采集类型（实时采集、定时采集、事件采集）
        collection_frequency: 采集频率（秒）
        collection_params: 采集参数（JSON格式）
        collection_status: 采集状态（运行中、已停止、异常）
        last_collection_time: 最后采集时间
        collection_count: 采集次数
        error_count: 错误次数
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiiot_device_data_collections"
        indexes = [
            ("tenant_id",),
            ("collection_no",),
            ("uuid",),
            ("device_id",),
            ("collection_type",),
            ("collection_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "collection_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    collection_no = fields.CharField(max_length=50, description="采集编号（组织内唯一）")
    device_id = fields.IntField(null=True, description="设备ID（关联master-data）")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    collection_type = fields.CharField(max_length=50, description="采集类型（实时采集、定时采集、事件采集）")
    collection_frequency = fields.IntField(null=True, description="采集频率（秒）")
    collection_params = fields.JSONField(null=True, description="采集参数（JSON格式）")
    
    # 采集状态
    collection_status = fields.CharField(max_length=50, default="已停止", description="采集状态（运行中、已停止、异常）")
    last_collection_time = fields.DatetimeField(null=True, description="最后采集时间")
    collection_count = fields.IntField(default=0, description="采集次数")
    error_count = fields.IntField(default=0, description="错误次数")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.collection_no} - {self.device_name}"

