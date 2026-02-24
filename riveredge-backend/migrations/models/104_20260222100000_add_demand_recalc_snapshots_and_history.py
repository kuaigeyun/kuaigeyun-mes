"""
需求快照与重算历史表

新增：需求快照、需求重算历史、需求计算快照、需求计算重算历史。

Author: Auto
Date: 2026-02-22
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 需求快照表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_snapshots" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "demand_id" INTEGER NOT NULL,
            "snapshot_type" VARCHAR(32) NOT NULL DEFAULT 'before_recalc',
            "snapshot_at" TIMESTAMPTZ NOT NULL,
            "demand_snapshot" JSONB NOT NULL,
            "demand_items_snapshot" JSONB NOT NULL,
            "trigger_reason" VARCHAR(200)
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_snapshots" IS '快格轻制造 - 需求快照';
        CREATE INDEX IF NOT EXISTS "idx_demand_snapshots_tenant_demand" ON "apps_kuaizhizao_demand_snapshots" ("tenant_id", "demand_id");
        CREATE INDEX IF NOT EXISTS "idx_demand_snapshots_snapshot_at" ON "apps_kuaizhizao_demand_snapshots" ("snapshot_at");

        -- 需求重算历史表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_recalc_history" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "demand_id" INTEGER NOT NULL,
            "recalc_at" TIMESTAMPTZ NOT NULL,
            "trigger_type" VARCHAR(32) NOT NULL,
            "source_type" VARCHAR(50),
            "source_id" INTEGER,
            "trigger_reason" VARCHAR(200),
            "snapshot_id" INTEGER,
            "operator_id" INTEGER,
            "result" VARCHAR(20) NOT NULL,
            "message" TEXT
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_recalc_history" IS '快格轻制造 - 需求重算历史';
        CREATE INDEX IF NOT EXISTS "idx_demand_recalc_hist_tenant_demand" ON "apps_kuaizhizao_demand_recalc_history" ("tenant_id", "demand_id");
        CREATE INDEX IF NOT EXISTS "idx_demand_recalc_hist_recalc_at" ON "apps_kuaizhizao_demand_recalc_history" ("recalc_at");

        -- 需求计算快照表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_computation_snapshots" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "computation_id" INTEGER NOT NULL,
            "snapshot_at" TIMESTAMPTZ NOT NULL,
            "trigger" VARCHAR(64),
            "computation_summary_snapshot" JSONB,
            "items_snapshot" JSONB
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_computation_snapshots" IS '快格轻制造 - 需求计算快照';
        CREATE INDEX IF NOT EXISTS "idx_dc_snapshots_tenant_computation" ON "apps_kuaizhizao_demand_computation_snapshots" ("tenant_id", "computation_id");
        CREATE INDEX IF NOT EXISTS "idx_dc_snapshots_snapshot_at" ON "apps_kuaizhizao_demand_computation_snapshots" ("snapshot_at");

        -- 需求计算重算历史表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_computation_recalc_history" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "computation_id" INTEGER NOT NULL,
            "recalc_at" TIMESTAMPTZ NOT NULL,
            "trigger" VARCHAR(64),
            "operator_id" INTEGER,
            "result" VARCHAR(20) NOT NULL,
            "snapshot_id" INTEGER,
            "message" TEXT
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_computation_recalc_history" IS '快格轻制造 - 需求计算重算历史';
        CREATE INDEX IF NOT EXISTS "idx_dc_recalc_hist_tenant_computation" ON "apps_kuaizhizao_demand_computation_recalc_history" ("tenant_id", "computation_id");
        CREATE INDEX IF NOT EXISTS "idx_dc_recalc_hist_recalc_at" ON "apps_kuaizhizao_demand_computation_recalc_history" ("recalc_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_computation_recalc_history";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_computation_snapshots";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_recalc_history";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_snapshots";
    """
