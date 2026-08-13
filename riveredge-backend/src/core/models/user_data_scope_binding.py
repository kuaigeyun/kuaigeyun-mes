"""用户数据范围绑定（合作方/外协单位等维度，供 DataScopeService 与 SRM/订货扩展）。"""

from tortoise import fields

from core.models.base import BaseModel


class UserDataScopeBinding(BaseModel):
    """
    将登录用户绑定到某数据维度下的一个或多个业务主体编码。

    示例：
    - dimension=outsourced_unit, scope_code=供应商主数据 code → 外协维保单 outsourced_unit_code
    - dimension=supplier, scope_code=... → 将来 SRM 采购订单 supplier_code
    - dimension=manufacturer, scope_code=HaoligoManufacturer.code → 设备验收单 manufacturer_code
    """

    id = fields.IntField(pk=True, description="主键")
    user_id = fields.IntField(description="用户 ID（core_users）")
    dimension = fields.CharField(max_length=64, description="数据维度键，如 outsourced_unit、supplier")
    scope_code = fields.CharField(max_length=64, description="主体编码（组织内与业务单据字段一致）")
    scope_name = fields.CharField(max_length=200, null=True, description="主体名称（冗余展示）")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_user_data_scope_bindings"
        indexes = [
            ("tenant_id", "user_id", "dimension"),
            ("tenant_id", "dimension", "scope_code"),
        ]
        unique_together = [("tenant_id", "user_id", "dimension", "scope_code")]
