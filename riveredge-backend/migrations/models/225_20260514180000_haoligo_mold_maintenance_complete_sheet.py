"""好力 GO — 维保完修单表 haoligo_mold_maintenance_complete_sheet。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_maintenance_complete_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_maintenance_sheet_id" INT,
            "source_order_no" VARCHAR(128) NOT NULL,
            "service_type" VARCHAR(16) NOT NULL,
            "clear_total_production" BOOLEAN NOT NULL DEFAULT FALSE,
            "header_attachment_file_uuids" JSONB,
            "line_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mmcs_tenant" ON "haoligo_mold_maintenance_complete_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mmcs_src" ON "haoligo_mold_maintenance_complete_sheet" ("source_order_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mmcs_msid" ON "haoligo_mold_maintenance_complete_sheet" ("source_maintenance_sheet_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_maintenance_complete_sheet" CASCADE;
    """
