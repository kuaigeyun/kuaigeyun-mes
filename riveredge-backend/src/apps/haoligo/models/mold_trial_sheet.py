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
    purchase_order_no = fields.CharField(max_length=128, null=True, description="采购订单号（从待启用模具试模时可空）")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商")
    supplier_code = fields.CharField(max_length=64, null=True, description="供应商编码（冗余，数据范围隔离）")
    mold_code = fields.CharField(max_length=64, null=True, description="模具代号")
    mold_name = fields.CharField(max_length=200, null=True, description="模具名称")
    trial_times = fields.IntField(null=True, description="试模次数")
    trial_user_id = fields.IntField(null=True, description="试模人员用户 ID（core_users）")
    trial_user_name = fields.CharField(max_length=100, null=True, description="试模人员显示名（冗余）")
    failure_handling = fields.CharField(
        max_length=16,
        null=True,
        description="试模不合格处理方式：待处理/立即送修/已发出/已收回",
    )
    pending_notify_user_ids = fields.JSONField(
        default=list,
        description="待处理：消息提醒接收人用户 ID 列表",
    )
    repair_warehouse_id = fields.IntField(
        null=True,
        description="立即送修/待处理已发出：目标模具仓库 ID（供应商外部仓）",
    )
    dispatch_origin_warehouse_id = fields.IntField(
        null=True,
        description="待处理发出前模具所在仓库 ID（收回时还原）",
    )
    result_attachment_file_uuids = fields.JSONField(null=True, description="试模结果附件（文件 UUID 列表）")
    inspection_attachment_file_uuids = fields.JSONField(null=True, description="试模检验附件（文件 UUID 列表）")
    trial_result = fields.CharField(max_length=16, description="试模结果：合格/不合格")
    sheet_status = fields.CharField(
        max_length=32,
        default="待审核",
        description="审核状态：待审核/已通过/已驳回（历史草稿/已提交已迁移）",
    )
    audited_at = fields.DatetimeField(null=True, description="审核时间")
    audited_by_user_id = fields.IntField(null=True, description="审核人用户 ID")
