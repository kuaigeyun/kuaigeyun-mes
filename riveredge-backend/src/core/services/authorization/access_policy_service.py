from core.models.access_policy import AccessPolicy
from core.models.policy_binding import PolicyBinding
from core.services.authorization.permission_version_service import PermissionVersionService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AccessPolicyService:
    @staticmethod
    async def list_policies(tenant_id: int) -> list[AccessPolicy]:
        return await AccessPolicy.filter(tenant_id=tenant_id, deleted_at__isnull=True).order_by("priority", "id").all()

    @staticmethod
    async def create_policy(tenant_id: int, data: dict) -> AccessPolicy:
        exists = await AccessPolicy.get_or_none(tenant_id=tenant_id, name=data["name"], deleted_at__isnull=True)
        if exists:
            raise ValidationError("策略名称已存在")
        policy = await AccessPolicy.create(
            tenant_id=tenant_id,
            name=data["name"],
            effect=data.get("effect", "allow"),
            priority=data.get("priority", 100),
            target_resource=data["target_resource"],
            target_action=data["target_action"],
            condition_expr=data.get("condition_expr"),
            enabled=data.get("enabled", True),
        )
        await AccessPolicyService._replace_bindings(policy.id, data.get("bindings") or [])
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)
        return policy

    @staticmethod
    async def update_policy(tenant_id: int, policy_uuid: str, data: dict) -> AccessPolicy:
        policy = await AccessPolicy.get_or_none(uuid=policy_uuid, tenant_id=tenant_id, deleted_at__isnull=True)
        if not policy:
            raise NotFoundError("策略", policy_uuid)
        for key in ["name", "effect", "priority", "target_resource", "target_action", "condition_expr", "enabled"]:
            if key in data and data[key] is not None:
                setattr(policy, key, data[key])
        await policy.save()
        if "bindings" in data and data["bindings"] is not None:
            await AccessPolicyService._replace_bindings(policy.id, data["bindings"])
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)
        return policy

    @staticmethod
    async def delete_policy(tenant_id: int, policy_uuid: str) -> None:
        policy = await AccessPolicy.get_or_none(uuid=policy_uuid, tenant_id=tenant_id, deleted_at__isnull=True)
        if not policy:
            raise NotFoundError("策略", policy_uuid)
        from datetime import datetime

        policy.deleted_at = datetime.now()
        await policy.save()
        await PolicyBinding.filter(policy_id=policy.id).delete()
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)

    @staticmethod
    async def _replace_bindings(policy_id: int, bindings: list[dict]) -> None:
        await PolicyBinding.filter(policy_id=policy_id).delete()
        rows = []
        for b in bindings:
            subject_type = b.get("subject_type")
            subject_id = b.get("subject_id")
            if not subject_type or not subject_id:
                continue
            rows.append(
                PolicyBinding(
                    policy_id=policy_id,
                    subject_type=subject_type,
                    subject_id=int(subject_id),
                )
            )
        if rows:
            await PolicyBinding.bulk_create(rows, ignore_conflicts=True)
