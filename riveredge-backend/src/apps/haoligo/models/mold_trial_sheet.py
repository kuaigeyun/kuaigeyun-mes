"""好力GO — 试模单（模具试模记录）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldTrialSheet(HaoligoTenantModel):
    """试模单：采购订单、供应商、模具信息、附件、试模结果与单据状态。"""

    class Meta:
        table = "haoligo_mold_trial_sheet"
        table_description = "好力GO - 试模单"
        indexes = [("tenant_id",), ("purchase_order_no",), ("sheet_status",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="试模单单号（系统编码规则生成）")
    purchase_order_no = fields.CharField(max_length=128, description="采购订单号")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商")
    mold_code = fields.CharField(max_length=64, null=True, description="模具代号")
    mold_name = fields.CharField(max_length=200, null=True, description="模具名称")
    trial_times = fields.IntField(null=True, description="试模次数")
    result_attachment_file_uuids = fields.JSONField(null=True, description="试模结果附件（文件 UUID 列表）")
    inspection_attachment_file_uuids = fields.JSONField(null=True, description="试模检验附件（文件 UUID 列表）")
    trial_result = fields.CharField(max_length=16, description="试模结果：合格/不合格")
    sheet_status = fields.CharField(
        max_length=32,
        default="草稿",
        description="单据状态：草稿/已提交/待审核/已通过/已驳回/已作废",
    )
