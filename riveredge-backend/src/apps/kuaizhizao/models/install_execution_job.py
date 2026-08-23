"""安装执行单（客户现场安装调试过程与费用）。"""

from tortoise import fields

from core.models.base import BaseModel


class InstallExecutionJob(BaseModel):
    """安装执行单头"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    job_code = fields.CharField(max_length=50, db_index=True, description="安装执行单号")

    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    sales_order_id = fields.IntField(null=True, description="关联销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")
    sales_delivery_id = fields.IntField(null=True, description="关联销售出库单ID")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="关联销售出库单编码")
    packing_binding_id = fields.IntField(null=True, description="关联装箱绑定ID（可选）")

    # 自制 / 外购 / 混合
    supply_source = fields.CharField(max_length=20, default="自制", description="供给来源")
    site_address = fields.CharField(max_length=500, null=True, description="现场地址")

    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")

    # 待派工 / 进行中 / 待验收 / 已关闭
    status = fields.CharField(max_length=20, default="待派工", description="单据状态")
    current_stage_key = fields.CharField(max_length=50, null=True, description="当前阶段键")

    notes = fields.TextField(null=True, description="备注")
    total_cost_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, null=True, description="费用合计"
    )

    started_at = fields.DatetimeField(null=True, description="开始时间")
    closed_at = fields.DatetimeField(null=True, description="关闭时间")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_install_execution_jobs"
        table_description = "快格轻制造 - 安装执行单"
        indexes = [
            ("tenant_id", "job_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "sales_order_id"),
            ("tenant_id", "sales_delivery_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
