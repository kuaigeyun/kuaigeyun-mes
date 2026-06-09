"""引用资源 DisplayProvider 注册表。"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from infra.models.user import User


@runtime_checkable
class ReferenceDisplayProvider(Protocol):
    resource_key: str

    async def search(
        self,
        *,
        tenant_id: int,
        user: User,
        page: int,
        page_size: int,
        keyword: str | None,
        is_active: bool | None,
        extra: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """返回 {items, total, page, page_size}。"""

    async def resolve(
        self,
        *,
        tenant_id: int,
        user: User,
        record_ids: list[int] | None,
        record_uuids: list[str] | None,
    ) -> list[dict[str, Any]]:
        ...


_providers: dict[str, ReferenceDisplayProvider] = {}


def register_reference_display_provider(provider: ReferenceDisplayProvider) -> None:
    key = (provider.resource_key or "").strip().lower()
    if not key:
        raise ValueError("ReferenceDisplayProvider.resource_key 不能为空")
    _providers[key] = provider


def get_reference_display_provider(resource_key: str) -> ReferenceDisplayProvider | None:
    return _providers.get((resource_key or "").strip().lower())


def list_registered_reference_providers() -> list[str]:
    return sorted(_providers.keys())
