"""
绩效数据模型迁移

创建假期、技能表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建假期表
        CREATE TABLE IF NOT EXISTS "seed_master_data_holidays" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "holiday_date" DATE NOT NULL,
            "holiday_type" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_holidays_tenant_id" ON "seed_master_data_holidays" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_holidays_uuid" ON "seed_master_data_holidays" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_holidays_holiday_date" ON "seed_master_data_holidays" ("holiday_date");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_holidays_holiday_type" ON "seed_master_data_holidays" ("holiday_type");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_holidays_created_at" ON "seed_master_data_holidays" ("created_at");

        -- 创建技能表
        CREATE TABLE IF NOT EXISTS "seed_master_data_skills" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_skills_tenant_code" ON "seed_master_data_skills" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_skills_tenant_id" ON "seed_master_data_skills" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_skills_code" ON "seed_master_data_skills" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_skills_uuid" ON "seed_master_data_skills" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_skills_category" ON "seed_master_data_skills" ("category");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_skills_created_at" ON "seed_master_data_skills" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除技能表
        DROP TABLE IF EXISTS "seed_master_data_skills" CASCADE;

        -- 删除假期表
        DROP TABLE IF EXISTS "seed_master_data_holidays" CASCADE;
    """

