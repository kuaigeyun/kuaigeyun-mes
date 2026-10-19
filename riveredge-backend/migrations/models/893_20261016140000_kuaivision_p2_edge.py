"""快视觉 P2：边缘心跳字段、方案触发、离线超时。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "run_mode" VARCHAR(30) NOT NULL DEFAULT 'local_pipeline';
        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "agent_version" VARCHAR(40);
        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "last_error" TEXT;
        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "buffer_pending_count" INT NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "disk_free_mb" INT;

        ALTER TABLE "apps_kuaivision_recipes"
            ADD COLUMN IF NOT EXISTS "default_camera_code" VARCHAR(50);
        ALTER TABLE "apps_kuaivision_recipes"
            ADD COLUMN IF NOT EXISTS "trigger_mode" VARCHAR(20) NOT NULL DEFAULT 'manual';
        ALTER TABLE "apps_kuaivision_recipes"
            ADD COLUMN IF NOT EXISTS "trigger_interval_seconds" INT;

        ALTER TABLE "apps_kuaivision_settings"
            ADD COLUMN IF NOT EXISTS "offline_timeout_seconds" INT NOT NULL DEFAULT 60;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaivision_settings" DROP COLUMN IF EXISTS "offline_timeout_seconds";
        ALTER TABLE "apps_kuaivision_recipes" DROP COLUMN IF EXISTS "trigger_interval_seconds";
        ALTER TABLE "apps_kuaivision_recipes" DROP COLUMN IF EXISTS "trigger_mode";
        ALTER TABLE "apps_kuaivision_recipes" DROP COLUMN IF EXISTS "default_camera_code";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "disk_free_mb";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "buffer_pending_count";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "last_error";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "agent_version";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "run_mode";
    """
