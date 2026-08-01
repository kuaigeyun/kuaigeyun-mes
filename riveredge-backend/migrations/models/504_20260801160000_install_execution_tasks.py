from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_install_execution_tasks" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "job_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "stage_key" VARCHAR(50) NOT NULL,
            "task_title" VARCHAR(200) NOT NULL,
            "executor_id" INT,
            "executor_name" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT '待处理',
            "planned_at" TIMESTAMPTZ,
            "actual_at" TIMESTAMPTZ,
            "notes" TEXT,
            "attachments" JSONB
        );
        COMMENT ON TABLE "apps_kuaizhizao_install_execution_tasks" IS '快格轻制造 - 安装执行任务';
        CREATE INDEX IF NOT EXISTS "idx_install_task_job"
            ON "apps_kuaizhizao_install_execution_tasks" ("tenant_id", "job_id");
        CREATE INDEX IF NOT EXISTS "idx_install_task_job_stage"
            ON "apps_kuaizhizao_install_execution_tasks" ("tenant_id", "job_id", "stage_key");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_install_execution_tasks";
    """
