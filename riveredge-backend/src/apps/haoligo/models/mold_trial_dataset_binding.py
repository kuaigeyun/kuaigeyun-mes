"""好力GO — 试模单与数据集的关联配置（按采购订单号拉取供应商/模具信息）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldTrialDatasetBinding(HaoligoTenantModel):
    """每个租户一条：一个 ERP 数据集 + 结果列映射；列表无参拉取，订单号参数选填用于失焦带出。"""

    class Meta:
        table = "haoligo_mold_trial_dataset_binding"
        table_description = "好力GO - 试模单数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    order_param_key = fields.CharField(
        max_length=64,
        null=True,
        description="SQL 查询参数名，需与数据集中占位符一致（如 os_no 对应 :os_no）",
    )
    supplier_column = fields.CharField(max_length=128, null=True, description="结果集中供应商列名")
    mold_code_column = fields.CharField(max_length=128, null=True, description="结果集中模具代号列名")
    mold_name_column = fields.CharField(max_length=128, null=True, description="结果集中模具名称列名")
    list_dataset_uuid = fields.CharField(
        max_length=36,
        null=True,
        description="已废弃，保存时清空，请仅使用 dataset_uuid",
    )
    purchase_order_column = fields.CharField(
        max_length=128,
        null=True,
        description="结果集中采购订单号列名（从列表选择创建试模单时用于带出订单号）",
    )
