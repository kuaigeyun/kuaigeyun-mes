"""好力 GO — 厂内维保单表 haoligo_mold_maintenance_sheet。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_maintenance_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "department_uuid" VARCHAR(36),
            "department_name" VARCHAR(200),
            "service_type" VARCHAR(16) NOT NULL,
            "source_order_no" VARCHAR(128),
            "header_attachment_file_uuids" JSONB,
            "line_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mms_tenant" ON "haoligo_mold_maintenance_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mms_svc" ON "haoligo_mold_maintenance_sheet" ("service_type");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mms_dept" ON "haoligo_mold_maintenance_sheet" ("department_uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_maintenance_sheet" CASCADE;
    """
