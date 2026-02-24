"""
创建状态流转表（StateTransitionRule、StateTransitionLog）

用于单据操作记录、状态流转历史追溯。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
    CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_state_transition_rules" (
        "id" SERIAL NOT NULL PRIMARY KEY,
        "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
        "tenant_id" INT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "entity_type" VARCHAR(50) NOT NULL,
        "from_state" VARCHAR(50) NOT NULL,
        "to_state" VARCHAR(50) NOT NULL,
        "transition_conditions" JSONB,
        "required_permission" VARCHAR(100),
        "required_role" VARCHAR(100),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "description" TEXT
    );
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_rules_tenant_entity_from" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "entity_type", "from_state");
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_rules_tenant_entity_to" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "entity_type", "to_state");
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_rules_tenant_active" ON "apps_kuaizhizao_state_transition_rules" ("tenant_id", "is_active");
    COMMENT ON TABLE "apps_kuaizhizao_state_transition_rules" IS '快格轻制造 - 状态流转规则';

    CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_state_transition_logs" (
        "id" SERIAL NOT NULL PRIMARY KEY,
        "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
        "tenant_id" INT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "entity_type" VARCHAR(50) NOT NULL,
        "entity_id" INT NOT NULL,
        "from_state" VARCHAR(50) NOT NULL,
        "to_state" VARCHAR(50) NOT NULL,
        "transition_reason" VARCHAR(200),
        "transition_comment" TEXT,
        "operator_id" INT NOT NULL,
        "operator_name" VARCHAR(100) NOT NULL,
        "transition_time" TIMESTAMPTZ NOT NULL,
        "related_entity_type" VARCHAR(50),
        "related_entity_id" INT
    );
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_logs_tenant_entity" ON "apps_kuaizhizao_state_transition_logs" ("tenant_id", "entity_type", "entity_id");
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_logs_tenant_operator" ON "apps_kuaizhizao_state_transition_logs" ("tenant_id", "operator_id");
    CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_state_logs_transition_time" ON "apps_kuaizhizao_state_transition_logs" ("transition_time");
    COMMENT ON TABLE "apps_kuaizhizao_state_transition_logs" IS '快格轻制造 - 状态流转日志';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
    DROP TABLE IF EXISTS "apps_kuaizhizao_state_transition_logs";
    DROP TABLE IF EXISTS "apps_kuaizhizao_state_transition_rules";
    """
