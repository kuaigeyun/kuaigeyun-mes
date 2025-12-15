"""
实时生产看板模型模块

定义实时生产看板数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class ProductionDashboard(BaseModel):
    """
    实时生产看板模型
    
    用于管理实时生产看板，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        dashboard_no: 看板编号（组织内唯一）
        dashboard_name: 看板名称
        dashboard_type: 看板类型（Andon系统、生产状态监控、异常预警）
        production_line_id: 产线ID
        production_line_name: 产线名称
        alert_level: 报警等级（正常、预警、紧急）
        alert_category: 报警分类
        alert_status: 报警状态（待处理、处理中、已处理）
        alert_time: 报警时间
        alert_description: 报警描述
        handler_id: 处理人ID
        handler_name: 处理人姓名
        handle_time: 处理时间
        handle_result: 处理结果
        production_status: 生产状态（运行中、停机、故障）
        status_data: 状态数据（JSON格式）
        status_trend: 状态趋势（JSON格式）
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
        table = "seed_kuaimi_production_dashboards"
        indexes = [
            ("tenant_id",),
            ("dashboard_no",),
            ("dashboard_type",),
            ("production_line_id",),
            ("alert_level",),
            ("alert_status",),
            ("production_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "dashboard_no")]
    
    dashboard_no = fields.CharField(max_length=100, description="看板编号")
    dashboard_name = fields.CharField(max_length=200, description="看板名称")
    dashboard_type = fields.CharField(max_length=50, description="看板类型")
    production_line_id = fields.IntField(null=True, description="产线ID")
    production_line_name = fields.CharField(max_length=200, null=True, description="产线名称")
    alert_level = fields.CharField(max_length=50, default="正常", description="报警等级")
    alert_category = fields.CharField(max_length=100, null=True, description="报警分类")
    alert_status = fields.CharField(max_length=50, default="待处理", description="报警状态")
    alert_time = fields.DatetimeField(null=True, description="报警时间")
    alert_description = fields.TextField(null=True, description="报警描述")
    handler_id = fields.IntField(null=True, description="处理人ID")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handle_time = fields.DatetimeField(null=True, description="处理时间")
    handle_result = fields.TextField(null=True, description="处理结果")
    production_status = fields.CharField(max_length=50, default="运行中", description="生产状态")
    status_data = fields.JSONField(null=True, description="状态数据")
    status_trend = fields.JSONField(null=True, description="状态趋势")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

