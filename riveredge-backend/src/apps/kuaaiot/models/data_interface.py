"""
数据接口模型模块

定义数据接口数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class DataInterface(BaseModel):
    """
    数据接口模型
    
    用于管理数据接口，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        interface_no: 接口编号（组织内唯一）
        interface_name: 接口名称
        interface_type: 接口类型（查询API、数据推送、数据订阅）
        interface_url: 接口URL
        interface_method: 接口方法（GET、POST、PUT、DELETE）
        request_config: 请求配置（JSON格式）
        response_config: 响应配置（JSON格式）
        subscription_config: 订阅配置（JSON格式，如果是订阅类型）
        performance_metrics: 性能指标（JSON格式）
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
        table = "apps_kuaaiot_data_interfaces"
        indexes = [
            ("tenant_id",),
            ("interface_no",),
            ("interface_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "interface_no")]
    
    interface_no = fields.CharField(max_length=100, description="接口编号")
    interface_name = fields.CharField(max_length=200, description="接口名称")
    interface_type = fields.CharField(max_length=50, description="接口类型")
    interface_url = fields.CharField(max_length=500, null=True, description="接口URL")
    interface_method = fields.CharField(max_length=20, null=True, description="接口方法")
    request_config = fields.JSONField(null=True, description="请求配置")
    response_config = fields.JSONField(null=True, description="响应配置")
    subscription_config = fields.JSONField(null=True, description="订阅配置")
    performance_metrics = fields.JSONField(null=True, description="性能指标")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

