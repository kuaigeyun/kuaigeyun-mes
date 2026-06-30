"""模具报废申请表"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_ops_scrap_applications" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "application_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
            "reason" TEXT NOT NULL,
            "scrap_date" DATE NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "attachments" JSONB NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_mold_ops_scrap_applications_tenant_application_no"
                UNIQUE ("tenant_id", "application_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_ops_scrap_applications_mold_id"
            ON "apps_kuaizhizao_mold_ops_scrap_applications" ("mold_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_ops_scrap_applications_tenant_id"
            ON "apps_kuaizhizao_mold_ops_scrap_applications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_ops_scrap_applications_status"
            ON "apps_kuaizhizao_mold_ops_scrap_applications" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_mold_ops_scrap_applications" IS '快格轻制造 - 模具报废申请';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_ops_scrap_applications";
    """
