"""好力 GO — 外协维保单表 haoligo_mold_outsource_maintenance_sheet。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_outsource_maintenance_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "outsourced_unit_code" VARCHAR(64),
            "outsourced_unit_name" VARCHAR(200) NOT NULL,
            "service_type" VARCHAR(16) NOT NULL,
            "source_order_no" VARCHAR(128),
            "header_attachment_file_uuids" JSONB,
            "line_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_moms_tenant" ON "haoligo_mold_outsource_maintenance_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_moms_unit" ON "haoligo_mold_outsource_maintenance_sheet" ("outsourced_unit_name");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_moms_svc" ON "haoligo_mold_outsource_maintenance_sheet" ("service_type");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_outsource_maintenance_sheet" CASCADE;
    """
