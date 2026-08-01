"""演示组织内 guest 设为组织管理员。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_users" AS u
           SET "is_tenant_admin" = TRUE
          FROM "infra_tenants" AS t
         WHERE u."tenant_id" = t."id"
           AND u."username" = 'guest'
           AND u."deleted_at" IS NULL
           AND t."name" IN (
             '无锡快格信息技术有限公司',
             '无锡快格软件有限公司',
             'Kgsoft California Branch'
           );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_users" AS u
           SET "is_tenant_admin" = FALSE
          FROM "infra_tenants" AS t
         WHERE u."tenant_id" = t."id"
           AND u."username" = 'guest'
           AND u."deleted_at" IS NULL
           AND t."name" IN (
             '无锡快格信息技术有限公司',
             '无锡快格软件有限公司',
             'Kgsoft California Branch'
           );
    """
