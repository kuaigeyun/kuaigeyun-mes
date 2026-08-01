"""清理 508 安全修复遗留的 guest_auto_* 重复体验账号。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_users" AS orphan
           SET "deleted_at" = NOW(),
               "updated_at" = NOW(),
               "is_active" = FALSE
          FROM "core_users" AS canonical
         WHERE orphan."username" LIKE 'guest_auto_%'
           AND orphan."deleted_at" IS NULL
           AND canonical."username" = 'guest'
           AND canonical."tenant_id" = orphan."tenant_id"
           AND canonical."deleted_at" IS NULL
           AND orphan."id" <> canonical."id";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
