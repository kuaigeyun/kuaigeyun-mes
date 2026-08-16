"""
总账账套参数（单租户单账套）
"""

from tortoise import fields

from core.models.base import BaseModel


class GlBookSettings(BaseModel):
    """账套级总账参数。"""

    class Meta:
        table = "apps_kuaicaiwu_gl_book_settings"
        table_description = "总账 - 账套参数"
        unique_together = (("tenant_id",),)

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    account_code_rule = fields.CharField(max_length=32, default="4-2-2-2", description="科目级次规则")
    base_currency = fields.CharField(max_length=10, default="CNY", description="本位币")
    require_reviewer_different = fields.BooleanField(default=True, description="制单审核分离")
    deficit_control = fields.BooleanField(default=False, description="赤字控制")
    allow_gl_entry_on_controlled = fields.BooleanField(default=False, description="受控科目允许总账制单")
    cash_account_ids = fields.JSONField(default=list, description="指定现金总账科目ID列表")
    bank_account_ids = fields.JSONField(default=list, description="指定银行总账科目ID列表")
    enable_voucher_words = fields.BooleanField(default=True, description="启用收付转凭证字")
    require_transfer_before_close = fields.BooleanField(
        default=False, description="结账前须执行必跑转账/摊销"
    )
    initialized = fields.BooleanField(default=False, description="是否已结束初始化/开账")
    current_year = fields.IntField(null=True, description="当前会计年度")
    current_month = fields.IntField(null=True, description="当前会计月份")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
