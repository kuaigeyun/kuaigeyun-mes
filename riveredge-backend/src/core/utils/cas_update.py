"""条件更新辅助：WHERE 期望状态/版本，影响行数 0 则业务拒绝。"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from infra.exceptions.exceptions import BusinessLogicError, ConflictError


async def update_where_expected(
    model: Any,
    *,
    filters: Mapping[str, Any],
    expected: Mapping[str, Any],
    values: Mapping[str, Any],
    conflict_message: str = "数据状态已变更，请刷新后重试",
) -> int:
    query = model.filter(**dict(filters)).filter(**dict(expected))
    affected = await query.update(**dict(values))
    n = int(affected or 0)
    if n <= 0:
        raise ConflictError(conflict_message)
    return n


async def assert_row_version(
    row: Any,
    *,
    expected_version: Optional[int],
    version_attr: str = "version",
) -> None:
    if expected_version is None:
        return
    current = getattr(row, version_attr, None)
    if current is None:
        return
    if int(current) != int(expected_version):
        raise BusinessLogicError("数据已被他人修改，请刷新后重试")
