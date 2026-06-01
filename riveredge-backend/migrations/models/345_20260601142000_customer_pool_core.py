"""客户池核心能力：客户状态字段、流转日志、回收规则。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers"
            ADD COLUMN IF NOT EXISTS "pool_status" VARCHAR(20) NOT NULL DEFAULT 'pool',
            ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "last_follow_up_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "recycle_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "apps_master_data_customers"."pool_status" IS '客户池状态：pool=公海，owned=已领取';
        COMMENT ON COLUMN "apps_master_data_customers"."assigned_at" IS '最近领取/分配时间';
        COMMENT ON COLUMN "apps_master_data_customers"."last_follow_up_at" IS '最近跟进时间';
        COMMENT ON COLUMN "apps_master_data_customers"."recycle_at" IS '计划回收时间';
        CREATE INDEX IF NOT EXISTS "idx_customer_tenant_pool_status"
            ON "apps_master_data_customers" ("tenant_id", "pool_status");
        CREATE INDEX IF NOT EXISTS "idx_customer_tenant_recycle_at"
            ON "apps_master_data_customers" ("tenant_id", "recycle_at");

        UPDATE "apps_master_data_customers"
           SET "pool_status"='owned',
               "assigned_at"=COALESCE("assigned_at", "updated_at")
         WHERE "deleted_at" IS NULL
           AND "salesman_id" IS NOT NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_pool_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "customer_id" INT NOT NULL,
            "customer_uuid" VARCHAR(64),
            "action" VARCHAR(30) NOT NULL,
            "from_salesman_id" INT,
            "to_salesman_id" INT,
            "operator_user_id" INT NOT NULL,
            "reason" VARCHAR(200),
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_customer_pool_logs" IS '快格轻制造 - 客户池归属流转日志';
        CREATE INDEX IF NOT EXISTS "idx_customer_pool_log_customer"
            ON "apps_kuaizhizao_customer_pool_logs" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_customer_pool_log_action"
            ON "apps_kuaizhizao_customer_pool_logs" ("tenant_id", "action");
        CREATE INDEX IF NOT EXISTS "idx_customer_pool_log_created_at"
            ON "apps_kuaizhizao_customer_pool_logs" ("tenant_id", "created_at");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_pool_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "recycle_enabled" BOOL NOT NULL DEFAULT TRUE,
            "recycle_after_days" INT NOT NULL DEFAULT 15,
            "max_owned_customers" INT NOT NULL DEFAULT 0,
            "allow_claim_others" BOOL NOT NULL DEFAULT FALSE,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_customer_pool_rules" IS '快格轻制造 - 客户池回收规则';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_pool_rule_tenant"
            ON "apps_kuaizhizao_customer_pool_rules" ("tenant_id")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_pool_rules";
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_pool_logs";
        ALTER TABLE "apps_master_data_customers"
            DROP COLUMN IF EXISTS "recycle_at",
            DROP COLUMN IF EXISTS "last_follow_up_at",
            DROP COLUMN IF EXISTS "assigned_at",
            DROP COLUMN IF EXISTS "pool_status";
    """

