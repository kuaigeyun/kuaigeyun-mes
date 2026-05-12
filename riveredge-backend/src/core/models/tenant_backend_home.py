"""
租户后台首页配置

每个租户至多一条记录：指定某菜单为登录后 Logo/默认入口路径；排他更新。
"""

from tortoise import fields
from tortoise.models import Model


class TenantBackendHome(Model):
    """
    租户级「后台首页」指针，指向 core_menus.uuid 的一条菜单。

    与菜单行分离存储，避免应用菜单同步覆盖字段；删除菜单后读取时回落默认页。
    """

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(unique=True, db_index=True, description="组织 ID（唯一）")
    menu_uuid = fields.CharField(max_length=36, description="菜单 UUID（core_menus.uuid）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")

    class Meta:
        table = "core_tenant_backend_home"
        table_description = "租户后台首页（单菜单指针）"
