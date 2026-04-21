"""
默认关闭预设审批流程。

将存量租户中由系统预设创建的审批流程统一置为停用，
确保“审核仅在业务主动开启后生效”。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


PRESET_CODES = (
    "simple_approval",
    "purchase_order",
    "sales_order",
    "work_order",
    "amount_tier_approval",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    codes = "', '".join(PRESET_CODES)
    return f"""
        UPDATE "core_approval_processes"
        SET "is_active" = FALSE
        WHERE "deleted_at" IS NULL
          AND "code" IN ('{codes}');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
