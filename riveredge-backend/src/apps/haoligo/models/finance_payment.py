"""好力 GO 财务 — 付款记录。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoFinancePayment(HaoligoTenantModel):
    """供应商付款登记。"""

    class Meta:
        table = "haoligo_finance_payment"
        table_description = "好力GO - 财务付款记录"
        indexes = [
            ("tenant_id",),
            ("supplier_id",),
            ("payment_date",),
            ("acceptance_id",),
        ]

    supplier = fields.ForeignKeyField(
        "models.HaoligoFinanceSupplier",
        related_name="payments",
        on_delete=fields.RESTRICT,
        description="材料供应商",
    )
    payment_date = fields.DateField(description="付款日期")
    amount = fields.DecimalField(max_digits=18, decimal_places=2, description="付款金额")
    payment_method = fields.CharField(max_length=32, description="付款方式")
    contract_no = fields.CharField(max_length=128, null=True, description="合同号")
    remark = fields.TextField(null=True, description="备注")
    acceptance = fields.ForeignKeyField(
        "models.HaoligoFinanceMaterialAcceptance",
        related_name="payments",
        null=True,
        on_delete=fields.SET_NULL,
        description="可选关联验收单",
    )
    invoice = fields.ForeignKeyField(
        "models.HaoligoFinanceInvoice",
        related_name="payments",
        null=True,
        on_delete=fields.SET_NULL,
        description="可选关联发票",
    )
