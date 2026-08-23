"""采购到货延期填报单"""

from tortoise import fields

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
from core.models.base import BaseModel


class PurchaseArrivalDelayReport(BaseModel):
    """采购行延期填报与审核，审核通过后可生成采购变更单。"""

    tenant_id = fields.IntField(description="租户ID")
    report_code = fields.CharField(max_length=50, db_index=True, description="延期填报单号")

    purchase_order_id = fields.IntField(description="采购订单ID")
    purchase_order_item_id = fields.IntField(description="采购订单明细ID")
    order_code = fields.CharField(max_length=50, description="采购订单编码")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")

    planned_arrival_date = fields.DateField(description="原计划到货日")
    delay_reason = fields.CharField(max_length=50, description="延期原因")
    estimated_arrival_date = fields.DateField(description="预计新到货日")
    impact_description = fields.TextField(null=True, description="影响说明")
    impacted_assembly_summary = fields.CharField(max_length=500, null=True, description="影响总成摘要")

    status = fields.CharField(max_length=30, default=DocumentStatus.DRAFT.value, description="单据状态")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING.value, description="审核状态")
    reviewer_id = fields.IntField(null=True)
    reviewer_name = fields.CharField(max_length=100, null=True)
    review_time = fields.DatetimeField(null=True)
    review_remarks = fields.TextField(null=True)

    purchase_order_change_id = fields.IntField(null=True, description="生成的采购变更单ID")
    purchase_order_change_code = fields.CharField(max_length=50, null=True, description="生成的采购变更单号")

    attachments = fields.JSONField(null=True, description="附件")
    notes = fields.TextField(null=True, description="备注")

    created_by = fields.IntField(null=True)
    created_by_name = fields.CharField(max_length=100, null=True)
    updated_by = fields.IntField(null=True)
    updated_by_name = fields.CharField(max_length=100, null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaizhizao_purchase_arrival_delay_reports"
        indexes = [
            ("tenant_id", "purchase_order_item_id"),
            ("tenant_id", "status"),
            ("tenant_id", "report_code"),
        ]
