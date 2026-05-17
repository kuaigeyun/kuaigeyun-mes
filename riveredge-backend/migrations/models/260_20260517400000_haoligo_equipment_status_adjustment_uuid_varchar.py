"""好力 GO — 设备状态调整单 uuid 列改为 VARCHAR(36)，与 ORM 及其它单据表一致。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'haoligo_equipment_status_adjustment'
                  AND column_name = 'uuid'
                  AND udt_name = 'uuid'
            ) THEN
                ALTER TABLE "haoligo_equipment_status_adjustment"
                    ALTER COLUMN "uuid" TYPE VARCHAR(36) USING "uuid"::text;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_status_adjustment"
            ALTER COLUMN "uuid" TYPE UUID USING "uuid"::uuid;
    """
