"""好力GO — 领用单与数据集的关联配置（以制令单号为查询参数，其余字段由结果行映射）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldBorrowDatasetBinding(HaoligoTenantModel):
    """每个租户一条：数据集 + 制令单号参数名 + 结果列映射。"""

    class Meta:
        table = "haoligo_mold_borrow_dataset_binding"
        table_description = "好力GO - 领用单数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    work_order_param_key = fields.CharField(
        max_length=64,
        null=True,
        description="SQL 查询参数名，与数据集中占位符一致（传入制令单号/来源单号）",
    )
    department_uuid_column = fields.CharField(
        max_length=128,
        null=True,
        description="结果集中领用部门 UUID 列名（可选；无则按部门名称列匹配本系统部门）",
    )
    department_name_column = fields.CharField(max_length=128, null=True, description="结果集中领用部门名称列名")
    mold_code_column = fields.CharField(max_length=128, null=True, description="结果集中模具代号列名")
    mold_name_column = fields.CharField(max_length=128, null=True, description="结果集中模具名称列名")
    finished_product_code_column = fields.CharField(max_length=128, null=True, description="结果集中成品代号列名（可选）")
    finished_product_name_column = fields.CharField(max_length=128, null=True, description="结果集中成品名称列名（可选）")
    planned_qty_column = fields.CharField(max_length=128, null=True, description="结果集中计划数量列名（可选）")
