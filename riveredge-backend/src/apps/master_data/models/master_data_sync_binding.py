"""主数据同步绑定（客户 / 供应商 / 仓库 / 物料 / 单位 / 分组）。"""

from tortoise import fields

from core.models.base import BaseModel


class CustomerSyncBinding(BaseModel):
    """每个租户一条：客户同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_customer_sync_binding"
        table_description = "主数据 - 客户同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")


class SupplierSyncBinding(BaseModel):
    """每个租户一条：供应商同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_supplier_sync_binding"
        table_description = "主数据 - 供应商同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")


class WarehouseSyncBinding(BaseModel):
    """每个租户一条：仓库同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_warehouse_sync_binding"
        table_description = "主数据 - 仓库同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")


class MaterialSyncBinding(BaseModel):
    """每个租户一条：物料同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_material_sync_binding"
        table_description = "主数据 - 物料同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="main_code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")


class MaterialUnitSyncBinding(BaseModel):
    """每个租户一条：物料单位同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_material_unit_sync_binding"
        table_description = "主数据 - 物料单位同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")


class MaterialGroupSyncBinding(BaseModel):
    """每个租户一条：物料分组同步来源与字段映射。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "apps_master_data_material_group_sync_binding"
        table_description = "主数据 - 物料分组同步绑定"
        indexes = [("tenant_id",)]

    source_type = fields.CharField(max_length=20, null=True, description="来源类型：api | dataset")
    api_uuid = fields.CharField(max_length=36, null=True, description="数据接口 UUID")
    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    field_mapping = fields.JSONField(null=True, description="来源列 -> 目标字段")
    match_key_field = fields.CharField(max_length=64, default="code", description="匹配键目标字段")
    sync_mode = fields.CharField(
        max_length=32,
        default="manual_full",
        description="manual_full | scheduled_full | scheduled_incremental",
    )
    schedule_interval_minutes = fields.IntField(default=15, description="定时同步间隔（分钟）")
    last_success_at = fields.DatetimeField(null=True, description="最近一次成功同步时间")
    last_attempt_at = fields.DatetimeField(null=True, description="最近一次尝试同步时间")
    last_error = fields.TextField(null=True, description="最近一次同步错误")
