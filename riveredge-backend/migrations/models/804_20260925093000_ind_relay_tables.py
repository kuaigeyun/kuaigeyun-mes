"""继电器制造行业包：产线节拍产能 + 换型矩阵建表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_ind_relay_line_capacities" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "production_line_id" INT NOT NULL,
            "production_line_code" VARCHAR(50),
            "production_line_name" VARCHAR(200),
            "takt_seconds" NUMERIC(12,2) NOT NULL DEFAULT 0,
            "daily_capacity_qty" NUMERIC(14,2) NOT NULL DEFAULT 0,
            "changeover_minutes_default" NUMERIC(10,2) NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_line_cap_tenant"
            ON "apps_ind_relay_line_capacities" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_line_cap_line"
            ON "apps_ind_relay_line_capacities" ("production_line_id");
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_line_cap_uuid"
            ON "apps_ind_relay_line_capacities" ("uuid");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_ind_relay_line_cap_active"
            ON "apps_ind_relay_line_capacities" ("tenant_id", "production_line_id")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_ind_relay_line_capacities" IS '继电器行业 - 产线节拍产能';

        CREATE TABLE IF NOT EXISTS "apps_ind_relay_changeover_matrix" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "from_family" VARCHAR(100) NOT NULL,
            "to_family" VARCHAR(100) NOT NULL,
            "changeover_minutes" NUMERIC(10,2) NOT NULL DEFAULT 0,
            "forbid_same_line" BOOL NOT NULL DEFAULT FALSE,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_chg_tenant"
            ON "apps_ind_relay_changeover_matrix" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_chg_family"
            ON "apps_ind_relay_changeover_matrix" ("from_family", "to_family");
        CREATE INDEX IF NOT EXISTS "idx_ind_relay_chg_uuid"
            ON "apps_ind_relay_changeover_matrix" ("uuid");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_ind_relay_chg_active"
            ON "apps_ind_relay_changeover_matrix" ("tenant_id", "from_family", "to_family")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_ind_relay_changeover_matrix" IS '继电器行业 - 换型矩阵';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_ind_relay_changeover_matrix";
        DROP TABLE IF EXISTS "apps_ind_relay_line_capacities";
    """
