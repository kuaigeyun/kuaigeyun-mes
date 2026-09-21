"""同步运行历史日志模型模块。

记录每次同步运行（手动 / 定时 / 增量）的汇总与结果，供「同步历史页」与问题排查使用。
只增不改：一次同步运行仅追加一行，不更新已写入的记录。
"""

from tortoise import fields

from core.models.base import LogBaseModel

# 与各同步服务传入的 entity_type 保持一致
SYNC_ENTITY_TYPES = frozenset(
    {
        "customer",
        "supplier",
        "warehouse",
        "unit",
        "material",
        "material_group",
        "inventory",
        "sales_order",
        "purchase_order",
        "work_order",
        "reporting",
        # 推送任务（与拉取共用表；mode 建议用 push）
        "document_push",
    }
)


class SyncRunLog(LogBaseModel):
    """同步运行历史（由 LogBaseModel 提供 uuid / tenant_id / created_at）。"""

    id = fields.IntField(pk=True, description="主键")
    tenant_id = fields.IntField(db_index=True, description="组织 ID")

    binding_id = fields.IntField(null=True, description="同步绑定主键（跨绑定表通用，不设外键）")
    entity_type = fields.CharField(max_length=50, description="实体类型（customer/supplier/...）")
    mode = fields.CharField(max_length=20, default="full", description="full | incremental")
    status = fields.CharField(max_length=20, default="success", description="success | partial | failed")
    created = fields.IntField(default=0, description="新建条数")
    updated = fields.IntField(default=0, description="更新条数")
    skipped = fields.IntField(default=0, description="跳过条数")
    failed = fields.IntField(default=0, description="失败条数")
    fetched = fields.IntField(default=0, description="源端拉取行数")
    truncated = fields.BooleanField(default=False, description="源端分页未拉完（水位未推进）")
    duration_ms = fields.IntField(default=0, description="耗时（毫秒）")
    error_summary = fields.TextField(null=True, description="错误摘要")
    started_at = fields.DatetimeField(null=True, description="开始时间")
    finished_at = fields.DatetimeField(null=True, description="结束时间")

    class Meta:
        table = "core_sync_run_logs"
        table_description = "同步运行历史日志"
        indexes = [
            ("tenant_id",),
            ("tenant_id", "entity_type"),
            ("tenant_id", "created_at"),
            ("binding_id",),
        ]

    def __str__(self) -> str:
        return f"SyncRunLog({self.entity_type}/{self.status} @ {self.created_at})"