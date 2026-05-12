"""好力 GO API：租户 + 未软删过滤。"""

from typing import Type, TypeVar

from tortoise.models import Model
from tortoise.queryset import QuerySet

T = TypeVar("T", bound=Model)


def tenant_alive(model: Type[T], tenant_id: int) -> QuerySet[T]:
    return model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
