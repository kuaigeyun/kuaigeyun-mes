"""
库存预警数据模型模块

定义库存预警规则和预警记录数据模型，支持低库存预警、高库存预警、过期预警等。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class InventoryAlertRule(BaseModel):
    """
    库存预警规则模型

    用于配置库存预警规则，包括低库存预警、高库存预警、过期预警等。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 预警规则编码
        name: 预警规则名称
        alert_type: 预警类型（low_stock/high_stock/expired）
        material_id: 物料ID（可选，如果为空则适用于所有物料）
        material_code: 物料编码（可选）
        material_name: 物料名称（可选）
        warehouse_id: 仓库ID（可选，如果为空则适用于所有仓库）
        warehouse_name: 仓库名称（可选）
        threshold_type: 阈值类型（quantity/percentage/days）
        threshold_value: 阈值数值
        is_enabled: 是否启用
        notify_users: 通知用户ID列表（JSON格式）
        notify_roles: 通知角色ID列表（JSON格式）
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        updated_by: 更新人ID
        updated_by_name: 更新人姓名
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_inventory_alert_rules"
        indexes = [
            ("tenant_id",),
            ("alert_type",),
            ("material_id",),
            ("warehouse_id",),
            ("is_enabled",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 业务编码
    code = fields.CharField(max_length=50, description="预警规则编码")
    name = fields.CharField(max_length=200, description="预警规则名称")

    # 预警类型
    alert_type = fields.CharField(max_length=20, description="预警类型（low_stock/high_stock/expired）")

    # 物料信息（可选）
    material_id = fields.IntField(null=True, description="物料ID（可选，如果为空则适用于所有物料）")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码（可选）")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称（可选）")

    # 仓库信息（可选）
    warehouse_id = fields.IntField(null=True, description="仓库ID（可选，如果为空则适用于所有仓库）")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称（可选）")

    # 阈值配置
    threshold_type = fields.CharField(max_length=20, description="阈值类型（quantity/percentage/days）")
    threshold_value = fields.DecimalField(max_digits=12, decimal_places=2, description="阈值数值")

    # 状态
    is_enabled = fields.BooleanField(default=True, description="是否启用")

    # 通知配置（JSON格式）
    notify_users = fields.JSONField(null=True, description="通知用户ID列表（JSON格式）")
    notify_roles = fields.JSONField(null=True, description="通知角色ID列表（JSON格式）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.name} - {self.alert_type}"


class InventoryAlert(BaseModel):
    """
    库存预警记录模型

    用于记录库存预警信息，包括预警触发时间、处理状态等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        alert_rule_id: 预警规则ID（关联InventoryAlertRule）
        alert_type: 预警类型（low_stock/high_stock/expired）
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        current_quantity: 当前库存数量
        threshold_value: 阈值数值
        alert_level: 预警级别（info/warning/critical）
        alert_message: 预警消息
        status: 状态（pending/processing/resolved/ignored）
        handled_by: 处理人ID
        handled_by_name: 处理人姓名
        handled_at: 处理时间
        handling_notes: 处理备注
        triggered_at: 触发时间
        resolved_at: 解决时间
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_inventory_alerts"
        indexes = [
            ("tenant_id",),
            ("alert_rule_id",),
            ("alert_type",),
            ("material_id",),
            ("warehouse_id",),
            ("status",),
            ("alert_level",),
            ("triggered_at",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联信息
    alert_rule_id = fields.IntField(null=True, description="预警规则ID（关联InventoryAlertRule）")
    alert_type = fields.CharField(max_length=20, description="预警类型（low_stock/high_stock/expired）")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 仓库信息
    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")

    # 预警信息
    current_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="当前库存数量")
    threshold_value = fields.DecimalField(max_digits=12, decimal_places=2, description="阈值数值")
    alert_level = fields.CharField(max_length=20, default="warning", description="预警级别（info/warning/critical）")
    alert_message = fields.TextField(description="预警消息")

    # 状态
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/processing/resolved/ignored）")

    # 处理信息
    handled_by = fields.IntField(null=True, description="处理人ID")
    handled_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handled_at = fields.DatetimeField(null=True, description="处理时间")
    handling_notes = fields.TextField(null=True, description="处理备注")
    triggered_at = fields.DatetimeField(description="触发时间")
    resolved_at = fields.DatetimeField(null=True, description="解决时间")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.alert_type} - {self.material_name}"

