"""即时库存同步绑定（租户一条）。"""
from tortoise import fields
from core.models.base import BaseModel


class InventorySyncBinding(BaseModel):
    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_kuaizhizao_inventory_sync_binding"
        table_description = "快格轻制造 - 即时库存同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    sources = fields.JSONField(null=True, description="多来源：kind + 接口/数据集 + field_mapping")
    push_targets = fields.JSONField(null=True, description="多目标外推")
    trigger_actions = fields.JSONField(null=True, description="触发无感外推的审核动作")
    match_key_field = fields.CharField(max_length=64, default="material_code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    sync_direction = fields.CharField(
        max_length=20,
        default="pull",
        description="pull | push | bidirectional",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")
