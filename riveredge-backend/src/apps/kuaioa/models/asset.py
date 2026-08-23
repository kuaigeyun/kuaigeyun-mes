"""固定资产模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaAssetPurchase(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    purchase_code = fields.CharField(max_length=50, description="采买单号")
    title = fields.CharField(max_length=200, description="采买标题")
    asset_category = fields.CharField(max_length=50, null=True, description="资产类别")
    quantity = fields.IntField(default=1, description="数量")
    estimated_amount = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="预估金额")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    purpose = fields.TextField(null=True, description="用途说明")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_asset_purchases"
        table_description = "轻办公 - 固定资产采买申请"
        unique_together = (("tenant_id", "purchase_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "applicant_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaAsset(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    asset_code = fields.CharField(max_length=50, description="资产编号")
    asset_name = fields.CharField(max_length=200, description="资产名称")
    asset_category = fields.CharField(max_length=50, null=True, description="资产类别")
    purchase_id = fields.IntField(null=True, description="关联采买申请")
    purchase_amount = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="采购金额")
    purchase_date = fields.DateField(null=True, description="采购日期")
    custodian_id = fields.IntField(null=True, description="保管人")
    custodian_name = fields.CharField(max_length=100, null=True, description="保管人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="使用部门")
    location = fields.CharField(max_length=200, null=True, description="存放位置")
    status = fields.CharField(max_length=30, default="in_stock", description="状态")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_assets"
        table_description = "轻办公 - 固定资产台账"
        unique_together = (("tenant_id", "asset_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "custodian_id"), ("tenant_id", "purchase_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]
