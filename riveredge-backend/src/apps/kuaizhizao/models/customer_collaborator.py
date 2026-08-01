"""
客户池协作人。
"""

from tortoise import fields

from core.models.base import BaseModel


class CustomerCollaborator(BaseModel):
    """客户协作人：可见客户并新建跟进，非归属负责人。"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    customer_id = fields.IntField(description="客户ID（主数据）")
    user_id = fields.IntField(description="协作人用户ID")
    user_name = fields.CharField(max_length=100, description="协作人姓名快照")
    added_by = fields.IntField(description="添加人用户ID")
    added_by_name = fields.CharField(max_length=100, null=True, description="添加人姓名快照")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "apps_kuaizhizao_customer_collaborators"
        table_description = "快格轻制造 - 客户池协作人"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "user_id"),
        ]
