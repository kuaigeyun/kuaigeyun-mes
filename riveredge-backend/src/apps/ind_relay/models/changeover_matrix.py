from tortoise import fields

from core.models.base import BaseModel


class RelayChangeoverMatrix(BaseModel):
    """料号族换型矩阵。"""

    class Meta:
        table = "apps_ind_relay_changeover_matrix"
        table_description = "继电器行业 - 换型矩阵"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("from_family", "to_family"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    from_family = fields.CharField(max_length=100, description="从料号族")
    to_family = fields.CharField(max_length=100, description="到料号族")
    changeover_minutes = fields.DecimalField(
        max_digits=10, decimal_places=2, default=0, description="换型分钟"
    )
    forbid_same_line = fields.BooleanField(default=False, description="是否禁共线")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)
