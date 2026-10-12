"""
继电器自动报工绑定：自动清零开关与预配置（主题 / command_code / 发送连接）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_ind_relay_auto_report_bindings"
            ADD COLUMN IF NOT EXISTS "auto_clear_enabled" BOOL NOT NULL DEFAULT False;
        ALTER TABLE "apps_ind_relay_auto_report_bindings"
            ADD COLUMN IF NOT EXISTS "auto_clear_command_code" VARCHAR(10);
        ALTER TABLE "apps_ind_relay_auto_report_bindings"
            ADD COLUMN IF NOT EXISTS "auto_clear_topic" VARCHAR(255);
        ALTER TABLE "apps_ind_relay_auto_report_bindings"
            ADD COLUMN IF NOT EXISTS "auto_clear_connection_id" INT;
        COMMENT ON COLUMN "apps_ind_relay_auto_report_bindings"."auto_clear_enabled"
            IS '报工成功后是否自动下发产线清零';
        COMMENT ON COLUMN "apps_ind_relay_auto_report_bindings"."auto_clear_command_code"
            IS '预配清零码 t0|c0|z0';
        COMMENT ON COLUMN "apps_ind_relay_auto_report_bindings"."auto_clear_topic"
            IS '清零 MQTT 完整主题';
        COMMENT ON COLUMN "apps_ind_relay_auto_report_bindings"."auto_clear_connection_id"
            IS '发送型 MQTT 连接 ID';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_ind_relay_auto_report_bindings" DROP COLUMN IF EXISTS "auto_clear_connection_id";
        ALTER TABLE "apps_ind_relay_auto_report_bindings" DROP COLUMN IF EXISTS "auto_clear_topic";
        ALTER TABLE "apps_ind_relay_auto_report_bindings" DROP COLUMN IF EXISTS "auto_clear_command_code";
        ALTER TABLE "apps_ind_relay_auto_report_bindings" DROP COLUMN IF EXISTS "auto_clear_enabled";
    """
