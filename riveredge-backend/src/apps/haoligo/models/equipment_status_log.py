"""好力 GO — 设备运行状态变更审计（仅 operational_status）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentOperationalStatusLog(HaoligoTenantModel):
    """设备 operational_status 变更记录。"""

    class Meta:
        table = "haoligo_equipment_operational_status_log"
        table_description = "好力GO - 设备运行状态变更日志"
        indexes = [("tenant_id",), ("equipment_id",), ("created_at",)]

    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="operational_status_logs",
        on_delete=fields.CASCADE,
        description="设备",
    )
    old_status = fields.CharField(max_length=16, null=True, description="变更前状态")
    new_status = fields.CharField(max_length=16, description="变更后状态")
    changed_by_user_id = fields.IntField(description="操作人用户 ID")
