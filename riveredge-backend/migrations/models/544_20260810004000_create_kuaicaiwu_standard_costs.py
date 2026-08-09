"""
创建快财务标准成本表（毛利分析等依赖）。

此前模型已注册但缺少正式迁移，部分环境会报
relation "apps_kuaicaiwu_standard_costs" does not exist。

Author: AI Assistant
Date: 2026-08-10
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_standard_costs" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "target_type" VARCHAR(20) NOT NULL,
            "target_id" INT NOT NULL,
            "target_code" VARCHAR(50),
            "target_name" VARCHAR(200),
            "cost_item_type" VARCHAR(20) NOT NULL,
            "standard_value" NUMERIC(18,4) NOT NULL,
            "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
            "unit" VARCHAR(20),
            "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
            "effective_date" DATE,
            "expiry_date" DATE,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "description" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_by" INT,
            "deleted_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_std_cost_tenant"
            ON "apps_kuaicaiwu_standard_costs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_std_cost_target"
            ON "apps_kuaicaiwu_standard_costs" ("target_type", "target_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_std_cost_active"
            ON "apps_kuaicaiwu_standard_costs" ("is_active");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaicaiwu_standard_costs";
    """
