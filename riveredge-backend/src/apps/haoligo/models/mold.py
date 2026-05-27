"""好力GO — 模具主数据（独立表，与 kuaizhizao 模具无关）。"""

from decimal import Decimal

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMold(HaoligoTenantModel):
    """模具资料：编码、名称、状态、总制造数量及台账扩展字段。"""

    class Meta:
        table = "haoligo_mold"
        table_description = "好力GO - 模具主数据"
        unique_together = [("tenant_id", "mold_code")]
        indexes = [("tenant_id",), ("mold_code",), ("status",), ("mold_warehouse_id",)]

    mold_code = fields.CharField(max_length=64, description="模具编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="模具名称")
    unit = fields.CharField(max_length=32, default="", description="单位")
    mold_capacity = fields.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0"),
        description="单模产能",
    )
    processing_time_min = fields.IntField(null=True, description="加工时间（分钟）：领用单与对应还入单创建时间之差的累计，由系统根据单据自动重算")
    service_life_years = fields.IntField(null=True, description="模具寿命（年）")
    usable_times = fields.IntField(null=True, description="额定可用次数（还入单不再扣减）")
    usable_yield = fields.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        description="额定可用产量（还入单不再扣减）",
    )
    used_times = fields.IntField(default=0, description="已使用次数（每笔还入单 +1）")
    used_yield = fields.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0"),
        description="已使用产量（还入单制造数量累计）",
    )
    maintenance_cycle_by_yield = fields.DecimalField(
        max_digits=18, decimal_places=4, null=True, description="维修周期（依产量）"
    )
    maintenance_cycle_by_days = fields.IntField(null=True, description="维修周期（依天数）")
    allow_repeated_borrow = fields.BooleanField(default=True, description="允许重复领用")
    purchase_vendor_name = fields.CharField(max_length=200, null=True, description="购买厂商")
    status = fields.CharField(
        max_length=32,
        default="待用",
        description="状态：待启用/待用/在用/维修/保养/外协维修/报废/停用（与 apps.haoligo.constants.mold_status 一致）",
    )
    total_manufacture_qty = fields.DecimalField(
        max_digits=18,
        decimal_places=0,
        default=Decimal("0"),
        description="总制造数量（累计）",
    )
    mold_warehouse = fields.ForeignKeyField(
        "models.HaoligoMoldWarehouse",
        related_name="molds",
        null=True,
        on_delete=fields.SET_NULL,
        description="所在模具仓库",
    )
    mold_warehouse_code = fields.CharField(max_length=64, null=True, description="所在仓库编号（冗余）")
    mold_warehouse_name = fields.CharField(max_length=200, null=True, description="所在仓库名称（冗余）")
    outsource_vendor_code = fields.CharField(max_length=64, null=True, description="外协厂商代号")
    outsource_vendor_name = fields.CharField(max_length=200, null=True, description="外协厂商名称")
    erp_material_code = fields.CharField(max_length=64, null=True, description="ERP 物料编码（同步引用）")
    ledger_source = fields.CharField(
        max_length=16,
        null=True,
        default=None,
        description="来源：sync=数据集同步，manual=手工创建/导入，NULL=历史或未同步回填",
    )
    remark = fields.TextField(null=True, description="备注")
    trial_pending_notify_user_ids = fields.JSONField(
        default=list,
        description="试模不合格待处理：上次指定的消息提醒人员（按模具记忆）",
    )
