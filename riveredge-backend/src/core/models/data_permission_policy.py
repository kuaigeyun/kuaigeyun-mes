"""数据权限策略模型（RDBC）。"""

from tortoise import fields

from core.models.base import BaseModel


class DataScopeType:
    ALL = "scope_all"
    DEPARTMENT = "scope_department"
    SELF = "scope_self"
    CUSTOM = "scope_custom"


class DataPermissionPolicy(BaseModel):
    id = fields.IntField(pk=True, description="主键ID")
    role_uuid = fields.CharField(max_length=36, description="角色UUID")
    resource = fields.CharField(max_length=100, description="资源编码（app:resource）")
    scope_type = fields.CharField(
        max_length=30,
        default=DataScopeType.ALL,
        description="数据范围：scope_all/scope_department/scope_self/scope_custom",
    )
    scope_payload = fields.JSONField(null=True, description="自定义范围载荷（如部门/用户ID列表）")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    class Meta:
        table = "core_data_permission_policies"
        unique_together = [("tenant_id", "role_uuid", "resource")]
        indexes = [
            ("tenant_id", "role_uuid"),
            ("tenant_id", "resource"),
            ("tenant_id", "scope_type"),
        ]
