"""
生产物料库存移动流水

由 InventoryService 在余额变更成功后追加写入，供工单物料轨迹与收发存报表使用。
"""

from tortoise import fields

from core.models.base import BaseModel


class MaterialStockMovement(BaseModel):
    """生产物料库存移动流水（追加式，不改历史行）。"""

    class Meta:
        table = "apps_kuaizhizao_material_stock_movements"
        table_description = "快格轻制造 - 生产物料库存移动流水"
        indexes = [
            ("tenant_id", "work_order_id", "created_at"),
            ("tenant_id", "material_id", "created_at"),
            ("tenant_id", "source_doc_type", "source_doc_id"),
            ("tenant_id", "idempotency_key"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称（过账时落库）")
    batch_no = fields.CharField(max_length=100, null=True, description="批号")

    # staging_to_line | production_issue | production_return | backflush_consume |
    # semi_fg_receipt | fg_receipt | scrap | transfer | outsource_issue |
    # outsource_receipt | adjust | ...
    movement_type = fields.CharField(max_length=50, description="移动类型")
    quantity = fields.DecimalField(
        max_digits=18, decimal_places=4, description="有符号数量（出库负、入库正）"
    )
    qty_before = fields.DecimalField(
        max_digits=18, decimal_places=4, null=True, description="变动前余额"
    )
    qty_after = fields.DecimalField(
        max_digits=18, decimal_places=4, null=True, description="变动后余额"
    )

    from_warehouse_id = fields.IntField(null=True, description="来源仓库ID")
    from_warehouse_name = fields.CharField(max_length=200, null=True, description="来源仓库名称")
    to_warehouse_id = fields.IntField(null=True, description="目标仓库ID")
    to_warehouse_name = fields.CharField(max_length=200, null=True, description="目标仓库名称")
    # 实际发生余额变动的仓库（主仓可为 null）
    balance_warehouse_id = fields.IntField(null=True, description="余额所属仓库ID")

    source_doc_type = fields.CharField(max_length=50, null=True, description="来源单据类型")
    source_doc_id = fields.IntField(null=True, description="来源单据ID")
    source_doc_code = fields.CharField(max_length=64, null=True, description="来源单据编码")

    work_order_id = fields.IntField(null=True, description="关联工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="关联工单编码")

    operator_id = fields.IntField(null=True, description="操作人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人姓名")
    remark = fields.TextField(null=True, description="备注")
    idempotency_key = fields.CharField(
        max_length=200, null=True, description="幂等键（防重复过账）"
    )


# 标准移动类型常量（调用方应优先使用）
MOVEMENT_STAGING_TO_LINE = "staging_to_line"
MOVEMENT_PRODUCTION_ISSUE = "production_issue"
MOVEMENT_PRODUCTION_RETURN = "production_return"
MOVEMENT_BACKFLUSH_CONSUME = "backflush_consume"
MOVEMENT_SEMI_FG_RECEIPT = "semi_fg_receipt"
MOVEMENT_FG_RECEIPT = "fg_receipt"
MOVEMENT_SCRAP = "scrap"
MOVEMENT_TRANSFER = "transfer"
MOVEMENT_OUTSOURCE_ISSUE = "outsource_issue"
MOVEMENT_OUTSOURCE_RECEIPT = "outsource_receipt"
MOVEMENT_ADJUST = "adjust"
MOVEMENT_PURCHASE_RECEIPT = "purchase_receipt"
MOVEMENT_SALES_DELIVERY = "sales_delivery"
MOVEMENT_OTHER_INBOUND = "other_inbound"
MOVEMENT_OTHER_OUTBOUND = "other_outbound"
MOVEMENT_ASSEMBLY_CONSUME = "assembly_consume"
MOVEMENT_ASSEMBLY_RECEIPT = "assembly_receipt"
MOVEMENT_DISASSEMBLY_CONSUME = "disassembly_consume"
MOVEMENT_DISASSEMBLY_RECEIPT = "disassembly_receipt"
