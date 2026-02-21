"""
权限版本服务
"""

from core.models.permission_version import PermissionVersion


class PermissionVersionService:
    @staticmethod
    async def get_version(tenant_id: int, user_id: int | None = None) -> int:
        record = await PermissionVersion.get_or_none(tenant_id=tenant_id, user_id=user_id)
        if not record:
            return 1
        return record.version

    @staticmethod
    async def bump(tenant_id: int, user_id: int | None = None) -> int:
        record = await PermissionVersion.get_or_none(tenant_id=tenant_id, user_id=user_id)
        if not record:
            record = await PermissionVersion.create(
                tenant_id=tenant_id,
                user_id=user_id,
                version=2,
            )
            return record.version
        record.version += 1
        await record.save()
        return record.version
