"""客户主数据补齐创建人/更新人审计字段。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_customers"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "updated_by" INT,
    ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);

-- 通过客户池日志回填更新人（最近一次操作）
UPDATE "apps_master_data_customers" c
SET "updated_by" = l."operator_user_id"
FROM (
    SELECT DISTINCT ON ("customer_id") "customer_id", "operator_user_id"
    FROM "apps_kuaizhizao_customer_pool_logs"
    WHERE "deleted_at" IS NULL
    ORDER BY "customer_id", "created_at" DESC, "id" DESC
) l
WHERE c."id" = l."customer_id"
  AND c."updated_by" IS NULL;

-- 通过客户池日志回填创建人（最早一次操作）
UPDATE "apps_master_data_customers" c
SET "created_by" = l."operator_user_id"
FROM (
    SELECT DISTINCT ON ("customer_id") "customer_id", "operator_user_id"
    FROM "apps_kuaizhizao_customer_pool_logs"
    WHERE "deleted_at" IS NULL
    ORDER BY "customer_id", "created_at" ASC, "id" ASC
) l
WHERE c."id" = l."customer_id"
  AND c."created_by" IS NULL;

-- 通过用户表回填审计姓名
UPDATE "apps_master_data_customers" c
SET "created_by_name" = COALESCE(NULLIF(u."full_name", ''), u."username", c."created_by_name")
FROM "core_users" u
WHERE c."created_by" = u."id"
  AND (
    c."created_by_name" IS NULL
    OR BTRIM(c."created_by_name") = ''
  );

UPDATE "apps_master_data_customers" c
SET "updated_by_name" = COALESCE(NULLIF(u."full_name", ''), u."username", c."updated_by_name")
FROM "core_users" u
WHERE c."updated_by" = u."id"
  AND (
    c."updated_by_name" IS NULL
    OR BTRIM(c."updated_by_name") = ''
  );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "updated_by_name";
ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "created_by_name";
ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "created_by";
    """
