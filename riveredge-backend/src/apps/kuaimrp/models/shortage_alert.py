"""
缺料预警模型模块

定义缺料预警数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ShortageAlert(BaseModel):
    """
    缺料预警模型
    
    用于管理缺料预警，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        alert_no: 预警编号（组织内唯一）
        material_id: 物料ID（关联master-data）
        requirement_id: 关联需求ID（MaterialRequirement）
        shortage_qty: 缺料数量
        shortage_date: 缺料日期
        alert_level: 预警等级（紧急、重要、一般）
        alert_reason: 缺料原因
        alert_status: 预警状态（待处理、处理中、已解决、已关闭）
        suggested_action: 处理建议
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaimrp_shortage_alerts"
        indexes = [
            ("tenant_id",),
            ("alert_no",),
            ("uuid",),
            ("material_id",),
            ("requirement_id",),
            ("shortage_date",),
            ("alert_level",),
            ("alert_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "alert_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    alert_no = fields.CharField(max_length=50, description="预警编号（组织内唯一）")
    material_id = fields.IntField(description="物料ID（关联master-data）")
    requirement_id = fields.IntField(null=True, description="关联需求ID（MaterialRequirement）")
    
    # 缺料信息
    shortage_qty = fields.DecimalField(max_digits=18, decimal_places=4, description="缺料数量")
    shortage_date = fields.DatetimeField(description="缺料日期")
    alert_level = fields.CharField(max_length=20, default="一般", description="预警等级（紧急、重要、一般）")
    alert_reason = fields.TextField(null=True, description="缺料原因")
    
    # 预警状态
    alert_status = fields.CharField(max_length=50, default="待处理", description="预警状态（待处理、处理中、已解决、已关闭）")
    
    # 处理建议
    suggested_action = fields.TextField(null=True, description="处理建议")
    
    # 处理信息
    handler_id = fields.IntField(null=True, description="处理人ID（用户ID）")
    handled_at = fields.DatetimeField(null=True, description="处理时间")
    handle_result = fields.TextField(null=True, description="处理结果")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.alert_no} - 物料{self.material_id}"
