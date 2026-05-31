"""好力 GO — 设备可绑定多个点检方案。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_inspection_param_set" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment" ("id") ON DELETE CASCADE,
            "set_id" INT NOT NULL REFERENCES "haoligo_inspection_param_set" ("id") ON DELETE CASCADE,
            "sort_order" INT NOT NULL DEFAULT 0,
            CONSTRAINT "uid_haoligo_equipment_inspection_param_set_equipment_set"
                UNIQUE ("equipment_id", "set_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_inspection_param_set_tenant"
            ON "haoligo_equipment_inspection_param_set" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_inspection_param_set_equipment"
            ON "haoligo_equipment_inspection_param_set" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_inspection_param_set_set"
            ON "haoligo_equipment_inspection_param_set" ("set_id");

        INSERT INTO "haoligo_equipment_inspection_param_set"
            ("uuid", "tenant_id", "equipment_id", "set_id", "sort_order")
        SELECT
            gen_random_uuid()::text,
            e."tenant_id",
            e."id",
            e."inspection_param_set_id",
            0
        FROM "haoligo_equipment" e
        WHERE e."inspection_param_set_id" IS NOT NULL
          AND e."deleted_at" IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM "haoligo_equipment_inspection_param_set" l
              WHERE l."equipment_id" = e."id" AND l."set_id" = e."inspection_param_set_id"
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_inspection_param_set";
    """
