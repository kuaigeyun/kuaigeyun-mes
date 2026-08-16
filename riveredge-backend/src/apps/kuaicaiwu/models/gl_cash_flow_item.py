"""现金流量项目字典"""

from tortoise import fields

from core.models.base import BaseModel


class GlCashFlowItem(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_gl_cash_flow_items"
        table_description = "总账 - 现金流量项目"
        unique_together = (("tenant_id", "item_code"),)

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(description="租户ID")
    item_code = fields.CharField(max_length=64, description="项目编码")
    item_name = fields.CharField(max_length=200, description="项目名称")
    # operating / investing / financing
    category = fields.CharField(max_length=40, default="operating", description="类别")
    # inflow / outflow
    direction = fields.CharField(max_length=20, default="inflow", description="方向")
    sort_order = fields.IntField(default=0, description="排序")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
