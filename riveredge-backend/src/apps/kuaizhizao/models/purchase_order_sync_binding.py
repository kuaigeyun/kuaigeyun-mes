"""采购订单与数据接口/数据集的同步绑定（租户一条）。"""

from tortoise import fields

from core.models.base import BaseModel


class PurchaseOrderSyncBinding(BaseModel):
    """每个租户一条：来源类型 + 接口/数据集 + 字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_kuaizhizao_purchase_order_sync_binding"
        table_description = "快格轻制造 - 采购订单同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="关联的数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="字段映射：来源列名 -> 目标字段名")
    match_key_field = fields.CharField(
        max_length=64,
        default="order_code",
        description="匹配已有订单的目标字段名（默认 order_code）",
    )
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")
