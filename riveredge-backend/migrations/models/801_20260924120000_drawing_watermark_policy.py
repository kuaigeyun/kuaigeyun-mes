"""工程图纸：打印水印策略（租户级）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_drawing_watermark_policies" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "is_enabled" BOOL NOT NULL DEFAULT TRUE,
            "force_on_print" BOOL NOT NULL DEFAULT TRUE,
            "opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
            "angle" INT NOT NULL DEFAULT -25,
            "font_size" INT NOT NULL DEFAULT 48,
            "color" VARCHAR(32) NOT NULL DEFAULT 'rgba(200,0,0,1)',
            "position" VARCHAR(20) NOT NULL DEFAULT 'diagonal',
            "template_public" TEXT,
            "template_internal" TEXT,
            "template_secret" TEXT,
            "template_confidential" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_drawing_watermark_policies_tenant_id"
            ON "apps_master_data_drawing_watermark_policies" ("tenant_id");
        COMMENT ON TABLE "apps_master_data_drawing_watermark_policies"
            IS '基础数据管理 - 图纸打印水印策略';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_drawing_watermark_policies";
    """
