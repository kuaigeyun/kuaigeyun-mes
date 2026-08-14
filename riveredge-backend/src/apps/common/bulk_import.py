"""
批量创建导入公共 Schema / 辅助（主数据与业务导入分片共用）。
"""

from typing import Any, Awaitable, Callable, List, Optional, TypeVar

from pydantic import BaseModel, Field, ConfigDict
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError

T = TypeVar("T")
R = TypeVar("R")


class BulkCreateFailedItem(BaseModel):
    """批量创建失败项（index 与请求 items 下标对齐，从 0 起）"""

    index: int = Field(..., description="请求 items 下标（从 0 起）")
    reason: str = Field(..., description="失败原因")

    model_config = ConfigDict(populate_by_name=True)


class BulkCreateResponse(BaseModel):
    """批量创建通用结果"""

    created_count: int = Field(..., alias="createdCount", description="成功数量")
    failed_count: int = Field(..., alias="failedCount", description="失败数量")
    requested_count: int = Field(..., alias="requestedCount", description="请求条目数")
    failed_items: List[BulkCreateFailedItem] = Field(
        default_factory=list,
        alias="failedItems",
        description="失败明细",
    )

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


async def run_bulk_create(
    items: List[T],
    create_one: Callable[[T, int], Awaitable[R]],
) -> BulkCreateResponse:
    """
    顺序执行 create_one；单条失败不中断整批。
    create_one(item, index) 成功即计入 created_count。
    """
    created = 0
    failed: List[BulkCreateFailedItem] = []
    for index, item in enumerate(items):
        try:
            await create_one(item, index)
            created += 1
        except (ValidationError, NotFoundError) as exc:
            failed.append(BulkCreateFailedItem(index=index, reason=str(exc)))
        except Exception as exc:
            logger.exception("bulk_create failed index=%s", index)
            failed.append(BulkCreateFailedItem(index=index, reason=f"创建失败: {exc}"))
    return BulkCreateResponse(
        created_count=created,
        failed_count=len(failed),
        requested_count=len(items),
        failed_items=failed,
    )
