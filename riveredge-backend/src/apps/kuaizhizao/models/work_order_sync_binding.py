"""生产工单与数据接口/数据集的同步绑定（租户一条）。"""

from tortoise import fields

from core.models.base import BaseModel


class WorkOrderSyncBinding(BaseModel):
    """每个租户一条：来源类型 + 接口/数据集 + 字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_kuaizhizao_work_order_sync_binding"
        table_description = "快格轻制造 - 生产工单同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="关联的数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="字段映射：来源列名 -> 目标字段名")
    sources = fields.JSONField(null=True, description="多来源：kind + 接口/数据集 + field_mapping")
    match_key_field = fields.CharField(
        max_length=64,
        default="code",
        description="匹配已有工单的目标字段名（默认 code）",
    )
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
    # 推送：仅存连接身份（映射/单位在 BusinessConfig，编排走 DocumentPushPipeline）
    push_connection_code = fields.CharField(
        max_length=64,
        null=True,
        description="推送选用的应用连接器 code（仅身份，不含 field_map）",
    )
    push_save_api_uuid = fields.CharField(
        max_length=36,
        null=True,
        description="推送选用的接口管理 Save 接口 UUID（仅身份；运行时 body 整包替换模板）",
    )
    push_targets = fields.JSONField(null=True, description="多目标外推：连接器 + Save 接口 + profile")
    trigger_actions = fields.JSONField(null=True, description="触发无感外推的审核动作，如 submit")
    push_sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full",
    )
    push_schedule_interval_minutes = fields.IntField(
        default=15, description="定时推送间隔（分钟）"
    )
    push_last_success_at = fields.DatetimeField(null=True, description="最近一次成功推送时间")
    push_last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试推送时间")
    push_last_error = fields.TextField(null=True, description="最近一次推送错误")
