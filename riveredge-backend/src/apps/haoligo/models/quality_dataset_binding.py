"""好力 GO — 品质单据制令单与 ERP 数据集关联（按制令单号查询并映射字段）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoQualityDatasetBinding(HaoligoTenantModel):
    """每个租户一条：数据集 + 制令单号参数名 + 结果列映射。"""

    class Meta:
        table = "haoligo_quality_dataset_binding"
        table_description = "好力GO - 品质制令单数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    work_order_param_key = fields.CharField(
        max_length=64,
        null=True,
        description="SQL 查询参数名，与数据集中占位符一致（传入制令单号）",
    )
    workshop_name_column = fields.CharField(max_length=128, null=True, description="结果集中车间名称列名")
    production_line_column = fields.CharField(max_length=128, null=True, description="结果集中产线列名（可选）")
    equipment_asset_code_column = fields.CharField(
        max_length=128,
        null=True,
        description="结果集中设备资产编号列名（可选）",
    )
    mold_code_column = fields.CharField(max_length=128, null=True, description="结果集中模具代号列名（可选）")
    finished_product_code_column = fields.CharField(
        max_length=128,
        null=True,
        description="结果集中成品/物料代号列名（可选）",
    )
    finished_product_name_column = fields.CharField(
        max_length=128,
        null=True,
        description="结果集中成品/型号名称列名（可选）",
    )
