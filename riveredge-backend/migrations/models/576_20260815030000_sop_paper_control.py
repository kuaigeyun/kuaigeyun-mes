"""
SOP 纸质文控：头表字段、修订履历、受控份；工位确认绑定修订号；存量回填 electronic + effective。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_sop"
    ADD COLUMN IF NOT EXISTS "carrier" VARCHAR(20) NOT NULL DEFAULT 'electronic',
    ADD COLUMN IF NOT EXISTS "control_status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS "current_revision" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "storage_plant_id" INT,
    ADD COLUMN IF NOT EXISTS "storage_location" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "keeper_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "page_count" INT,
    ADD COLUMN IF NOT EXISTS "paper_size" VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "change_reason" TEXT,
    ADD COLUMN IF NOT EXISTS "effective_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "obsolete_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "approved_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "qms_document_uuid" VARCHAR(36);

UPDATE "apps_master_data_sop"
   SET "carrier" = 'electronic',
       "control_status" = 'effective',
       "current_revision" = COALESCE(NULLIF(TRIM("version"), ''), '1.0')
 WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_sop_control_status"
    ON "apps_master_data_sop" ("tenant_id", "control_status");
CREATE INDEX IF NOT EXISTS "idx_sop_carrier"
    ON "apps_master_data_sop" ("tenant_id", "carrier");

CREATE TABLE IF NOT EXISTS "apps_master_data_sop_revisions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "sop_id" INT NOT NULL REFERENCES "apps_master_data_sop" ("id") ON DELETE CASCADE,
    "revision" VARCHAR(20) NOT NULL,
    "carrier" VARCHAR(20) NOT NULL DEFAULT 'electronic',
    "content" TEXT,
    "attachments" JSONB,
    "flow_config" JSONB,
    "form_config" JSONB,
    "storage_location" VARCHAR(200),
    "change_reason" TEXT,
    "effective_at" TIMESTAMPTZ,
    "obsolete_at" TIMESTAMPTZ,
    "published_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "uidx_sop_rev_tenant_sop_revision"
        UNIQUE ("tenant_id", "sop_id", "revision")
);
CREATE INDEX IF NOT EXISTS "idx_sop_rev_tenant" ON "apps_master_data_sop_revisions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sop_rev_sop" ON "apps_master_data_sop_revisions" ("sop_id");

CREATE TABLE IF NOT EXISTS "apps_master_data_sop_controlled_copies" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "sop_id" INT NOT NULL REFERENCES "apps_master_data_sop" ("id") ON DELETE CASCADE,
    "copy_no" VARCHAR(20) NOT NULL,
    "location_type" VARCHAR(20) NOT NULL,
    "station_id" INT,
    "holder_user_id" INT,
    "location_note" VARCHAR(200),
    "revision" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ,
    "issued_by_name" VARCHAR(100),
    "retrieved_at" TIMESTAMPTZ,
    "retrieved_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "uidx_sop_copy_tenant_sop_no"
        UNIQUE ("tenant_id", "sop_id", "copy_no")
);
CREATE INDEX IF NOT EXISTS "idx_sop_copy_tenant" ON "apps_master_data_sop_controlled_copies" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sop_copy_sop_status" ON "apps_master_data_sop_controlled_copies" ("sop_id", "status");

INSERT INTO "apps_master_data_sop_revisions" (
    "uuid", "tenant_id", "sop_id", "revision", "carrier",
    "content", "attachments", "flow_config", "form_config",
    "storage_location", "effective_at", "published_by_name",
    "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    s."tenant_id",
    s."id",
    COALESCE(s."current_revision", '1.0'),
    COALESCE(s."carrier", 'electronic'),
    s."content",
    s."attachments",
    s."flow_config",
    s."form_config",
    s."storage_location",
    s."effective_at",
    s."updated_by_name",
    NOW(),
    NOW()
FROM "apps_master_data_sop" s
WHERE s."deleted_at" IS NULL
  AND s."control_status" = 'effective'
  AND NOT EXISTS (
      SELECT 1 FROM "apps_master_data_sop_revisions" r
       WHERE r."tenant_id" = s."tenant_id"
         AND r."sop_id" = s."id"
         AND r."revision" = COALESCE(s."current_revision", '1.0')
         AND r."deleted_at" IS NULL
  );

ALTER TABLE "apps_kuaizhizao_station_sop_acknowledgments"
    ADD COLUMN IF NOT EXISTS "sop_revision" VARCHAR(20);

UPDATE "apps_kuaizhizao_station_sop_acknowledgments" a
   SET "sop_revision" = COALESCE(
       (SELECT s."current_revision" FROM "apps_master_data_sop" s
         WHERE s."uuid" = a."sop_uuid" AND s."tenant_id" = a."tenant_id"
           AND s."deleted_at" IS NULL LIMIT 1),
       '1.0'
   )
 WHERE a."deleted_at" IS NULL AND a."sop_revision" IS NULL;

ALTER TABLE "apps_kuaizhizao_station_sop_acknowledgments"
    DROP CONSTRAINT IF EXISTS "uid_apps_kuaizhizao_station_sop_acknowledg_7a8b9c0d1e2f";

ALTER TABLE "apps_kuaizhizao_station_sop_acknowledgments"
    DROP CONSTRAINT IF EXISTS "apps_kuaizhizao_station_sop_acknowledg_tenant_id_work_order_id_4a5b6c7d8e9f";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'uid_apps_kuaizhizao_station_sop_acknowledgments_tenant_id_work_order_id_operation_id_sop_uuid_worker_id'
    ) THEN
        ALTER TABLE "apps_kuaizhizao_station_sop_acknowledgments"
            DROP CONSTRAINT "uid_apps_kuaizhizao_station_sop_acknowledgments_tenant_id_work_order_id_operation_id_sop_uuid_worker_id";
    END IF;
END $$;

ALTER TABLE "apps_kuaizhizao_station_sop_acknowledgments"
    ADD CONSTRAINT "uid_station_sop_ack_wo_op_sop_rev_worker"
        UNIQUE ("tenant_id", "work_order_id", "operation_id", "sop_uuid", "sop_revision", "worker_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: SOP paper control schema is not reverted"
