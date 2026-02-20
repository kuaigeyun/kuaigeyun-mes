"""
采购申请模型

提供采购申请数据模型定义，作为需求计算与采购订单之间的可选中间层。

Author: RiverEdge Team
Date: 2025-02-01
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus


class PurchaseRequisition(BaseModel):
    """
    采购申请头

    支持审批、合并、选供应商等操作。是否经采购申请由流程开关 require_purchase_requisition 控制。
    """
    tenant_id = fields.IntField(description="租户ID")
    requisition_code = fields.CharField(max_length=50, unique=True, description="申请编码")

    # 基本信息
    requisition_name = fields.CharField(max_length=200, null=True, description="申请名称")
    status = fields.CharField(max_length=20, default=DocumentStatus.DRAFT.value, description="状态：草稿/待审核/已驳回/已通过/部分转单/全部转单")
    applicant_id = fields.IntField(null=True, description="申请人ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    requisition_date = fields.DateField(null=True, description="申请日期")
    required_date = fields.DateField(null=True, description="要求到货日期")

    # 来源
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（DemandComputation）")
    source_id = fields.IntField(null=True, description="来源ID（computation_id）")
    source_code = fields.CharField(max_length=50, null=True, description="来源编码")

    # 紧急采购
    is_urgent = fields.BooleanField(default=False, description="是否紧急采购")
    urgent_reason = fields.TextField(null=True, description="紧急原因")
    urgent_operator_id = fields.IntField(null=True, description="紧急操作人ID")
    urgent_operated_at = fields.DatetimeField(null=True, description="紧急操作时间")

    # 审核
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING.value, description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    notes = fields.TextField(null=True, description="备注")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    items: fields.ReverseRelation["PurchaseRequisitionItem"]

    class Meta:
        table = "apps_kuaizhizao_purchase_requisitions"
        table_description = "快格轻制造 - 采购申请"


class PurchaseRequisitionItem(BaseModel):
    """
    采购申请行

    记录每个物料的申请数量、建议单价、要求到货日期等。转单后记录 purchase_order_id、purchase_order_item_id。
    """
    tenant_id = fields.IntField(description="租户ID")
    requisition_id = fields.IntField(description="采购申请ID")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    unit = fields.CharField(max_length=20, default="件", description="单位")

    # 数量与价格
    quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="申请数量")
    suggested_unit_price = fields.DecimalField(max_digits=10, decimal_places=4, default=0, description="建议单价")
    required_date = fields.DateField(null=True, description="要求到货日期")

    # 来源
    demand_computation_item_id = fields.IntField(null=True, description="需求计算明细ID")

    # 转单后
    purchase_order_id = fields.IntField(null=True, description="已转采购订单ID")
    purchase_order_item_id = fields.IntField(null=True, description="已转采购订单行ID")
    supplier_id = fields.IntField(null=True, description="供应商ID（用于合并转单分组）")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_requisition_items"
        table_description = "快格轻制造 - 采购申请明细"
        indexes = [
            ("tenant_id", "requisition_id"),
            ("tenant_id", "supplier_id"),
            ("purchase_order_id",),
        ]
