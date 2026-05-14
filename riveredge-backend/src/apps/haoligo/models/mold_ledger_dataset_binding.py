"""好力GO — 模具台账与数据集的关联配置（同步模具代号/名称/单位/产能）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldLedgerDatasetBinding(HaoligoTenantModel):
    """每个租户一条：一个 ERP 数据集 + 结果列映射；无参执行拉全量后写入/更新模具主数据。"""

    class Meta:
        table = "haoligo_mold_ledger_dataset_binding"
        table_description = "好力GO - 模具台账数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    mold_code_column = fields.CharField(max_length=128, null=True, description="结果集中模具代号列名")
    mold_name_column = fields.CharField(max_length=128, null=True, description="结果集中模具名称列名")
    unit_column = fields.CharField(max_length=128, null=True, description="结果集中单位列名")
    mold_capacity_column = fields.CharField(
        max_length=128, null=True, description="结果集中模具产能列名（可选；与 SQL 别名一致）"
    )
