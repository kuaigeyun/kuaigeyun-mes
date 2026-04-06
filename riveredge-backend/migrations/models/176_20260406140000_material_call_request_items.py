"""
叫料单明细表：单头 + 多行明细；历史数据回填为每单一行明细；单头物料字段改为可空（多行时由明细承载）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_call_request_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" INT NOT NULL REFERENCES "apps_kuaizhizao_material_call_requests" ("id") ON DELETE CASCADE,
    "line_no" INT NOT NULL DEFAULT 1,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_unit" VARCHAR(20),
    "requested_quantity" DECIMAL(12,4) NOT NULL,
    "delivered_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_mc_items_tenant_request"
    ON "apps_kuaizhizao_material_call_request_items" ("tenant_id", "request_id");
CREATE INDEX IF NOT EXISTS "idx_mc_items_material"
    ON "apps_kuaizhizao_material_call_request_items" ("tenant_id", "material_id");
COMMENT ON TABLE "apps_kuaizhizao_material_call_request_items" IS '快格轻制造 - 叫料单明细';

INSERT INTO "apps_kuaizhizao_material_call_request_items" (
    "uuid", "tenant_id", "created_at", "updated_at", "request_id", "line_no",
    "material_id", "material_code", "material_name", "material_unit",
    "requested_quantity", "delivered_quantity"
)
SELECT
    gen_random_uuid()::text,
    "tenant_id",
    "created_at",
    "updated_at",
    "id",
    1,
    "material_id",
    "material_code",
    "material_name",
    "material_unit",
    "requested_quantity",
    "delivered_quantity"
FROM "apps_kuaizhizao_material_call_requests"
WHERE "deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "apps_kuaizhizao_material_call_request_items" i
    WHERE i.request_id = "apps_kuaizhizao_material_call_requests"."id"
  );

ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_id" DROP NOT NULL;
ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_code" DROP NOT NULL;
ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_name" DROP NOT NULL;

UPDATE "apps_kuaizhizao_material_call_requests"
SET "call_type" = 'CUSTOM_SELECTION'
WHERE "call_type" = 'SINGLE_MATERIAL';

ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "call_type" SET DEFAULT 'CUSTOM_SELECTION';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaizhizao_material_call_request_items";
ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_id" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_code" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_material_call_requests"
    ALTER COLUMN "material_name" SET NOT NULL;
"""
