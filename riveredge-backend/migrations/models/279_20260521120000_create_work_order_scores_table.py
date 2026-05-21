from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_work_order_scores" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_order_id" INT NOT NULL,
            "scenario" VARCHAR(32) NOT NULL,
            "composite_score" DECIMAL(6,2) NOT NULL,
            "rank_band" VARCHAR(4),
            "breakdown" JSONB NOT NULL,
            "config_version" VARCHAR(64) NOT NULL DEFAULT 'default-v1',
            "computed_at" TIMESTAMPTZ NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_wo_score_tenant_wo_scenario"
            ON "apps_kuaizhizao_work_order_scores" ("tenant_id", "work_order_id", "scenario");
        CREATE INDEX IF NOT EXISTS "idx_wo_score_tenant_scenario_score"
            ON "apps_kuaizhizao_work_order_scores" ("tenant_id", "scenario", "composite_score" DESC);
        CREATE INDEX IF NOT EXISTS "idx_wo_score_computed_at"
            ON "apps_kuaizhizao_work_order_scores" ("computed_at");

        COMMENT ON TABLE "apps_kuaizhizao_work_order_scores" IS '快格轻制造 - 工单综合打分快照';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_work_order_scores" CASCADE;
    """
